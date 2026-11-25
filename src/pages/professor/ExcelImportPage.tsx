import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { PageHeader, StatusBadge } from '../../components/ui/CommonUi';

interface EvaluatedRow {
  rowNumber: number;
  enrollmentNumber: string;
  studentId: string | null;
  studentName: string;
  importedMarks: number | null;
  existingMarks: number | null;
  hasConflict: boolean;
  errors: string[];
  status: 'READY' | 'CONFLICT' | 'ERROR';
}

interface PreviewResponse {
  subject: { id: string; code: string; name: string; maxMarks: number };
  rows: EvaluatedRow[];
  summary: {
    totalRows: number;
    readyCount: number;
    conflictCount: number;
    errorCount: number;
    missingStudentsCount: number;
  };
  missingStudents: Array<{ studentId: string; enrollmentNumber: string; studentName: string }>;
}

export function ExcelImportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: classesData } = useQuery({
    queryKey: ['professor-classes'],
    queryFn: () =>
      apiRequest<{
        subjects: Array<{
          id: string;
          code: string;
          name: string;
          class_name: string;
          max_marks: number;
          submission_status: string;
        }>;
      }>('/api/professor/classes'),
  });

  const selectedSubjectId = searchParams.get('subjectId') || classesData?.subjects[0]?.id || '';
  const selectedSubject = classesData?.subjects.find((s) => s.id === selectedSubjectId);

  const { data: marksData } = useQuery({
    queryKey: ['professor-marks', selectedSubjectId],
    queryFn: () =>
      apiRequest<{
        subject: { code: string; name: string; max_marks: number };
        students: Array<{ enrollmentNumber: string; studentName: string; obtainedMarks: number | null }>;
      }>(`/api/professor/subjects/${selectedSubjectId}/marks`),
    enabled: Boolean(selectedSubjectId),
  });

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, unknown>>>([]);
  const [enrCol, setEnrCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [marksCol, setMarksCol] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [overwriteMap, setOverwriteMap] = useState<Record<string, boolean>>({});
  const [parseError, setParseError] = useState<string | null>(null);

  const downloadTemplate = () => {
    const rows = (marksData?.students ?? []).map((s) => ({
      'Enrollment Number': s.enrollmentNumber,
      'Student Name': s.studentName,
      'Obtained Marks': s.obtainedMarks ?? '',
    }));
    const sheet = XLSX.utils.json_to_sheet(
      rows.length > 0
        ? rows
        : [{ 'Enrollment Number': 'GIT23CE001', 'Student Name': 'Sample Student', 'Obtained Marks': 42 }]
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Marks');
    XLSX.writeFile(wb, `CAMPUSCORE_${selectedSubject?.code ?? 'Subject'}_Marks_Template.xlsx`);
    toast('success', 'Excel template downloaded');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      if (json.length === 0) {
        setParseError('The uploaded worksheet is empty.');
        return;
      }

      const headers = Object.keys(json[0]);
      setRawHeaders(headers);
      setRawRows(json);

      const guessedEnr = headers.find((h) => /enroll|roll|reg|id/i.test(h)) ?? headers[0] ?? '';
      const guessedName =
        headers.find((h) => /name|student/i.test(h) && h !== guessedEnr) ?? '';
      const guessedMarks =
        headers.find((h) => /mark|score|obtain|total/i.test(h)) ?? headers[headers.length - 1] ?? '';

      setEnrCol(guessedEnr);
      setNameCol(guessedName);
      setMarksCol(guessedMarks);
      toast('info', `Loaded ${json.length} rows from ${file.name}`, 'Review column mappings and click Validate Preview.');
    } catch {
      setParseError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls workbook.');
    } finally {
      e.target.value = '';
    }
  };

  const previewMutation = useMutation({
    mutationFn: () => {
      const mapped = rawRows.map((row, idx) => ({
        rowNumber: idx + 2,
        enrollmentNumber: String(row[enrCol] ?? ''),
        studentName: nameCol ? String(row[nameCol] ?? '') : '',
        marksRaw: (row[marksCol] as string | number | null) ?? '',
      }));
      return apiRequest<PreviewResponse>(
        `/api/professor/subjects/${selectedSubjectId}/import-preview`,
        {
          method: 'POST',
          body: { rows: mapped },
        }
      );
    },
    onSuccess: (res) => {
      setPreview(res);
      // Default conflict strategy: keep existing (false) — NEVER silently overwrite!
      const defaults: Record<string, boolean> = {};
      for (const r of res.rows) {
        if (r.hasConflict && r.studentId) defaults[r.studentId] = false;
      }
      setOverwriteMap(defaults);
    },
    onError: (err: unknown) =>
      toast('error', 'Validation failed', err instanceof Error ? err.message : undefined),
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('No validated preview.');
      const validEntries = preview.rows
        .filter((r) => r.errors.length === 0 && r.studentId && r.importedMarks !== null)
        .map((r) => ({
          studentId: r.studentId!,
          obtainedMarks: r.importedMarks!,
          overwrite: r.hasConflict ? Boolean(overwriteMap[r.studentId!]) : false,
        }));

      return apiRequest<{ created: number; overwritten: number; skipped: number }>(
        `/api/professor/subjects/${selectedSubjectId}/import-confirm`,
        {
          method: 'POST',
          body: { entries: validEntries },
        }
      );
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['professor-marks', selectedSubjectId] });
      queryClient.invalidateQueries({ queryKey: ['professor-classes'] });
      queryClient.invalidateQueries({ queryKey: ['professor-dashboard'] });
      toast(
        'success',
        'Excel marks imported',
        `${res.created} added · ${res.overwritten} overwritten · ${res.skipped} preserved/skipped.`
      );
      setPreview(null);
      setRawRows([]);
      setRawHeaders([]);
    },
    onError: (err: unknown) =>
      toast('error', 'Import failed', err instanceof Error ? err.message : undefined),
  });

  const isLocked = selectedSubject?.submission_status === 'LOCKED';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Excel Marks Import"
        description="Upload XLSX or XLS sheets, map columns, inspect row-level validation errors, and resolve conflicts explicitly."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSearchParams({ subjectId: e.target.value });
                setPreview(null);
                setRawRows([]);
              }}
              className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A]"
            >
              {(classesData?.subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.class_name})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={!selectedSubjectId}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F8F9FC]"
            >
              <Download className="h-3.5 w-3.5 text-[#5146D8]" />
              <span>Download XLSX Template</span>
            </button>
          </div>
        }
      />

      {isLocked && (
        <div className="rounded-2xl border border-[#D99A32]/30 bg-[#D99A32]/10 p-4 text-xs text-[#20243A]">
          This subject is currently <strong>LOCKED</strong>. Excel imports are disabled unless
          unlocked by the HOD.
        </div>
      )}

      {/* Upload Box */}
      <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#CFD2E2] bg-[#F8F9FC] px-6 py-8 text-center">
          <FileSpreadsheet className="h-8 w-8 text-[#5146D8]" />
          <p className="mt-3 text-sm font-semibold text-[#20243A]">
            Upload Excel Marks Workbook (.xlsx, .xls)
          </p>
          <p className="mt-1 text-xs text-[#777D91]">
            Existing saved marks are never overwritten without your explicit conflict resolution.
          </p>
          <label
            className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4237C2] ${
              isLocked ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Select Spreadsheet File</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={isLocked}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {parseError && <p className="mt-3 text-xs text-[#D95364]">{parseError}</p>}
        </div>

        {/* Column Mapping Step */}
        {rawHeaders.length > 0 && (
          <div className="mt-6 border-t border-[#E4E5ED] pt-5">
            <h3 className="font-heading text-sm font-bold text-[#20243A]">
              Map Spreadsheet Columns ({rawRows.length} rows detected)
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Enrollment Number Column *
                </label>
                <select
                  value={enrCol}
                  onChange={(e) => setEnrCol(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs"
                >
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Student Name Column (Optional)
                </label>
                <select
                  value={nameCol}
                  onChange={(e) => setNameCol(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs"
                >
                  <option value="">None</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Obtained Marks Column *
                </label>
                <select
                  value={marksCol}
                  onChange={(e) => setMarksCol(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs"
                >
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="rounded-xl bg-[#20243A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#313654]"
              >
                {previewMutation.isPending ? 'Validating...' : 'Validate & Check Conflicts'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Validation & Conflict Resolution Screen */}
      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#E4E5ED] bg-white p-4">
              <p className="text-xs text-[#777D91]">Ready to Import</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#21966B] tabular-nums">
                {preview.summary.readyCount}
              </p>
            </div>
            <div className="rounded-xl border border-[#E4E5ED] bg-white p-4">
              <p className="text-xs text-[#777D91]">Conflicts Detected</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#D99A32] tabular-nums">
                {preview.summary.conflictCount}
              </p>
            </div>
            <div className="rounded-xl border border-[#E4E5ED] bg-white p-4">
              <p className="text-xs text-[#777D91]">Row Errors</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#D95364] tabular-nums">
                {preview.summary.errorCount}
              </p>
            </div>
            <div className="rounded-xl border border-[#E4E5ED] bg-white p-4">
              <p className="text-xs text-[#777D91]">Missing Class Students</p>
              <p className="mt-1 font-mono text-xl font-bold text-[#20243A] tabular-nums">
                {preview.summary.missingStudentsCount}
              </p>
            </div>
          </div>

          {preview.summary.conflictCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D99A32]/35 bg-[#D99A32]/10 p-4 text-xs text-[#20243A]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#D99A32]" />
                <span>
                  {preview.summary.conflictCount} student(s) already have saved marks. Choose
                  whether to keep existing marks or overwrite each conflict below.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const m: Record<string, boolean> = {};
                    preview.rows.forEach((r) => {
                      if (r.hasConflict && r.studentId) m[r.studentId] = false;
                    });
                    setOverwriteMap(m);
                  }}
                  className="rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1 font-semibold"
                >
                  Keep All Existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const m: Record<string, boolean> = {};
                    preview.rows.forEach((r) => {
                      if (r.hasConflict && r.studentId) m[r.studentId] = true;
                    });
                    setOverwriteMap(m);
                  }}
                  className="rounded-lg bg-[#D99A32] px-2.5 py-1 font-semibold text-white"
                >
                  Overwrite All Conflicts
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] font-semibold text-[#777D91]">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Enrollment</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 text-right">Existing</th>
                    <th className="px-4 py-3 text-right">Imported</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Resolution / Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E5ED]">
                  {preview.rows.map((r) => (
                    <tr key={`${r.rowNumber}-${r.enrollmentNumber}`}>
                      <td className="px-4 py-2.5 font-mono text-[#777D91]">{r.rowNumber}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#20243A]">
                        {r.enrollmentNumber || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[#20243A]">{r.studentName || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#777D91]">
                        {r.existingMarks ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[#5146D8]">
                        {r.importedMarks ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {r.errors.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-[#D95364]">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{r.errors.join(' ')}</span>
                          </div>
                        ) : r.hasConflict && r.studentId ? (
                          <select
                            value={overwriteMap[r.studentId] ? 'overwrite' : 'keep'}
                            onChange={(e) =>
                              setOverwriteMap((prev) => ({
                                ...prev,
                                [r.studentId!]: e.target.value === 'overwrite',
                              }))
                            }
                            className="rounded-lg border border-[#D99A32]/50 bg-white px-2.5 py-1 text-xs font-medium"
                          >
                            <option value="keep">Keep existing ({r.existingMarks})</option>
                            <option value="overwrite">Overwrite with {r.importedMarks}</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#21966B]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Valid</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.missingStudents.length > 0 && (
              <div className="border-t border-[#E4E5ED] bg-[#F8F9FC] px-4 py-3 text-xs text-[#777D91]">
                Enrolled students not in this file:{' '}
                <span className="font-mono text-[#20243A]">
                  {preview.missingStudents.map((m) => m.enrollmentNumber).join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-[#E4E5ED] px-5 py-4">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-xl border border-[#E4E5ED] px-4 py-2 text-xs font-semibold text-[#20243A]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  confirmMutation.isPending ||
                  preview.summary.readyCount + preview.summary.conflictCount === 0
                }
                onClick={() => confirmMutation.mutate()}
                className="rounded-xl bg-[#5146D8] px-5 py-2 text-xs font-semibold text-white hover:bg-[#4237C2] disabled:opacity-50"
              >
                {confirmMutation.isPending
                  ? 'Importing...'
                  : `Confirm Import (${preview.summary.readyCount + preview.summary.conflictCount} valid rows)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

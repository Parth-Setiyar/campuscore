import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Modal, PageHeader } from '../../components/ui/CommonUi';

interface HodMeta {
  departments: Array<{ id: string; code: string; name: string; college: string }>;
  professors: Array<{ id: string; faculty_id: string; full_name: string; email: string }>;
}

interface SubjectDraft {
  code: string;
  name: string;
  maxMarks: number;
  assessmentType: string;
  assignedProfessorId: string;
}

interface RosterDraft {
  enrollmentNumber: string;
  rosterName: string;
}

export function CreateClassPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: meta } = useQuery({
    queryKey: ['hod-meta'],
    queryFn: () => apiRequest<HodMeta>('/api/hod/meta'),
  });

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [departmentId, setDepartmentId] = useState('dept_ce_demo');
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [semester, setSemester] = useState(5);
  const [division, setDivision] = useState('A');
  const [batch, setBatch] = useState('2023-2027');
  const [name, setName] = useState('');
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(30);

  const [subjects, setSubjects] = useState<SubjectDraft[]>([
    {
      code: 'CE501',
      name: 'Software Engineering',
      maxMarks: 50,
      assessmentType: 'Mid-Semester Examination',
      assignedProfessorId: '',
    },
  ]);

  const [roster, setRoster] = useState<RosterDraft[]>([]);
  const [newEnrollment, setNewEnrollment] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [createdResult, setCreatedResult] = useState<{
    classId: string;
    classCode: string;
    invitation: { id: string; token: string; expiresAt: string };
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<{
        classId: string;
        classCode: string;
        invitation: { id: string; token: string; expiresAt: string };
      }>('/api/hod/classes', {
        method: 'POST',
        body: {
          departmentId: departmentId || meta?.departments[0]?.id,
          academicYear,
          semester: Number(semester),
          division,
          batch,
          name: name.trim(),
          inviteExpiresInDays: Number(inviteExpiresInDays),
          subjects: subjects.map((s) => ({
            ...s,
            maxMarks: Number(s.maxMarks),
            assignedProfessorId: s.assignedProfessorId || null,
          })),
          roster,
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['hod-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['hod-classes'] });
      queryClient.invalidateQueries({ queryKey: ['hod-invitations'] });
      setCreatedResult(res);
      toast('success', 'Class created successfully', `Invitation code ${res.invitation.token} generated.`);
    },
    onError: (err: unknown) => {
      toast('error', 'Failed to create class', err instanceof Error ? err.message : undefined);
    },
  });

  const addSubjectRow = () => {
    setSubjects((prev) => [
      ...prev,
      {
        code: '',
        name: '',
        maxMarks: 50,
        assessmentType: 'Mid-Semester Examination',
        assignedProfessorId: '',
      },
    ]);
  };

  const updateSubject = (idx: number, field: keyof SubjectDraft, value: string | number) => {
    setSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const removeSubject = (idx: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  };

  const addManualStudent = () => {
    setRosterError(null);
    const enr = newEnrollment.trim().toUpperCase();
    if (enr.length < 3) {
      setRosterError('Enrollment number must be at least 3 characters.');
      return;
    }
    if (roster.some((r) => r.enrollmentNumber === enr)) {
      setRosterError(`Duplicate enrollment number detected: ${enr}`);
      return;
    }
    setRoster((prev) => [...prev, { enrollmentNumber: enr, rosterName: newStudentName.trim() }]);
    setNewEnrollment('');
    setNewStudentName('');
  };

  const handleRosterFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setRosterError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      const existingSet = new Set(roster.map((r) => r.enrollmentNumber));
      const added: RosterDraft[] = [];
      const duplicates: string[] = [];

      for (const row of rows) {
        const keys = Object.keys(row);
        const enrKey =
          keys.find((k) => /enroll|roll|id|reg/i.test(k)) ?? keys[0];
        const nameKey = keys.find((k) => /name|student/i.test(k) && k !== enrKey);

        const rawEnr = String(row[enrKey] ?? '').trim().toUpperCase();
        if (!rawEnr) continue;
        if (existingSet.has(rawEnr)) {
          duplicates.push(rawEnr);
          continue;
        }
        existingSet.add(rawEnr);
        added.push({
          enrollmentNumber: rawEnr,
          rosterName: nameKey ? String(row[nameKey] ?? '').trim() : '',
        });
      }

      if (added.length === 0 && duplicates.length === 0) {
        setRosterError('No valid enrollment numbers found in the uploaded file.');
        return;
      }

      setRoster((prev) => [...prev, ...added]);
      toast(
        'success',
        `Imported ${added.length} enrollment number(s)`,
        duplicates.length > 0 ? `${duplicates.length} duplicate(s) skipped.` : undefined
      );
    } catch {
      setRosterError('Unable to parse spreadsheet. Please upload a valid .xlsx, .xls, or .csv file.');
    } finally {
      e.target.value = '';
    }
  };

  const validateBeforeReview = () => {
    if (!name.trim() || name.trim().length < 3) {
      toast('error', 'Please enter a valid Class Name.');
      return;
    }
    if (subjects.length === 0) {
      toast('error', 'Add at least one subject.');
      return;
    }
    const seenCodes = new Set<string>();
    for (const s of subjects) {
      const code = s.code.trim().toUpperCase();
      if (!code || !s.name.trim() || Number(s.maxMarks) <= 0) {
        toast('error', 'Complete code, name, and maximum marks for all subjects.');
        return;
      }
      if (seenCodes.has(code)) {
        toast('error', `Duplicate subject code: ${code}`);
        return;
      }
      seenCodes.add(code);
    }
    if (roster.length === 0) {
      toast('error', 'Add or import at least one student enrollment number in the class roster.');
      return;
    }
    setStep('review');
  };

  const inviteUrl = createdResult
    ? `${window.location.origin}/join/${createdResult.invitation.token}`
    : '';

  const copyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('success', 'Invitation link copied');
  };

  return (
    <div>
      <PageHeader
        title="Create New Class"
        description="Configure academic cohort metadata, subjects, and authorized enrollment roster to generate secure QR invitations."
      />

      {step === 'form' ? (
        <div className="space-y-6">
          {/* Section 1: Class Metadata */}
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
            <h2 className="font-heading text-base font-bold text-[#20243A]">
              1. Academic Cohort Details
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                >
                  {(meta?.departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. CE Semester 5 — Division A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Academic Year</label>
                <input
                  type="text"
                  placeholder="2025-26"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Semester</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Division</label>
                <input
                  type="text"
                  placeholder="A"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm uppercase outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Batch</label>
                <input
                  type="text"
                  placeholder="2023-2027"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Invitation Validity (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={inviteExpiresInDays}
                  onChange={(e) => setInviteExpiresInDays(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Subject List */}
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-bold text-[#20243A]">
                  2. Subject List ({subjects.length})
                </h2>
                <p className="text-xs text-[#777D91]">
                  Assign faculty now or leave unassigned for professors to request access via class QR.
                </p>
              </div>
              <button
                type="button"
                onClick={addSubjectRow}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3.5 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#EFECFF] hover:text-[#5146D8]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Subject</span>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {subjects.map((sub, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4 sm:grid-cols-12"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#777D91]">Code</label>
                    <input
                      type="text"
                      placeholder="CE501"
                      value={sub.code}
                      onChange={(e) => updateSubject(idx, 'code', e.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-2 font-mono text-xs uppercase outline-none focus:border-[#5146D8]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#777D91]">Subject Name</label>
                    <input
                      type="text"
                      placeholder="Software Engineering"
                      value={sub.name}
                      onChange={(e) => updateSubject(idx, 'name', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#5146D8]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#777D91]">Max Marks</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={sub.maxMarks}
                      onChange={(e) => updateSubject(idx, 'maxMarks', Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-2 font-mono text-xs outline-none focus:border-[#5146D8]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#777D91]">Assessment</label>
                    <input
                      type="text"
                      value={sub.assessmentType}
                      onChange={(e) => updateSubject(idx, 'assessmentType', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#5146D8]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#777D91]">Professor</label>
                    <select
                      value={sub.assignedProfessorId}
                      onChange={(e) => updateSubject(idx, 'assignedProfessorId', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-2 text-xs outline-none focus:border-[#5146D8]"
                    >
                      <option value="">Unassigned</option>
                      {(meta?.professors ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeSubject(idx)}
                      disabled={subjects.length === 1}
                      className="rounded-lg p-2 text-[#D95364] hover:bg-[#D95364]/10 disabled:opacity-30"
                      aria-label="Remove subject"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Authorized Student Enrollment Roster */}
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-bold text-[#20243A]">
                  3. Authorized Enrollment Roster ({roster.length})
                </h2>
                <p className="text-xs text-[#777D91]">
                  Students can only join this class if their enrollment number exists in this verified list.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3.5 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#EFECFF] hover:text-[#5146D8]">
                <Upload className="h-3.5 w-3.5" />
                <span>Import Excel / CSV Roster</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleRosterFileImport}
                  className="hidden"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="text"
                placeholder="Enrollment No. (e.g. GIT23CE011)"
                value={newEnrollment}
                onChange={(e) => setNewEnrollment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualStudent();
                  }
                }}
                className="flex-1 rounded-xl border border-[#E4E5ED] px-3.5 py-2 font-mono text-sm uppercase outline-none focus:border-[#5146D8]"
              />
              <input
                type="text"
                placeholder="Student Name (optional)"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualStudent();
                  }
                }}
                className="flex-1 rounded-xl border border-[#E4E5ED] px-3.5 py-2 text-sm outline-none focus:border-[#5146D8]"
              />
              <button
                type="button"
                onClick={addManualStudent}
                className="rounded-xl bg-[#20243A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#323756]"
              >
                Add Student
              </button>
            </div>

            {rosterError && (
              <div className="mt-3 flex items-center gap-2 text-xs text-[#D95364]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{rosterError}</span>
              </div>
            )}

            {roster.length > 0 && (
              <div className="mt-4 max-h-60 overflow-y-auto rounded-xl border border-[#E4E5ED]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-[#E4E5ED] bg-[#F8F9FC] text-[#777D91]">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Enrollment Number</th>
                      <th className="px-4 py-2.5">Roster Name</th>
                      <th className="px-4 py-2.5 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E5ED]">
                    {roster.map((r, idx) => (
                      <tr key={r.enrollmentNumber}>
                        <td className="px-4 py-2 font-mono text-[#777D91]">{idx + 1}</td>
                        <td className="px-4 py-2 font-mono font-semibold text-[#20243A]">
                          {r.enrollmentNumber}
                        </td>
                        <td className="px-4 py-2 text-[#5A6078]">{r.rosterName || '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setRoster((prev) =>
                                prev.filter((item) => item.enrollmentNumber !== r.enrollmentNumber)
                              )
                            }
                            className="text-[#D95364] hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={validateBeforeReview}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4237C2]"
            >
              <span>Review Class Before Creation</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Review Step */
        <div className="space-y-6 rounded-2xl border border-[#E4E5ED] bg-white p-6">
          <div className="flex items-center justify-between border-b border-[#E4E5ED] pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-[#20243A]">
                Review Class Configuration
              </h2>
              <p className="text-xs text-[#777D91]">
                Confirm cohort metadata, subject structure, and enrollment roster before creating.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] px-3.5 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F3F4F8]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#F8F9FC] p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#777D91]">Class Name</p>
              <p className="mt-0.5 font-semibold text-[#20243A]">{name}</p>
            </div>
            <div>
              <p className="text-xs text-[#777D91]">Academic Year</p>
              <p className="mt-0.5 font-semibold text-[#20243A]">{academicYear}</p>
            </div>
            <div>
              <p className="text-xs text-[#777D91]">Semester / Division</p>
              <p className="mt-0.5 font-semibold text-[#20243A]">
                Sem {semester} · Div {division.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#777D91]">Batch</p>
              <p className="mt-0.5 font-semibold text-[#20243A]">{batch}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#20243A]">Subjects ({subjects.length})</h3>
            <div className="mt-2 divide-y divide-[#E4E5ED] rounded-xl border border-[#E4E5ED]">
              {subjects.map((s) => (
                <div key={s.code} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span>
                    <strong className="font-mono text-[#5146D8]">{s.code}</strong> — {s.name} (
                    {s.assessmentType})
                  </span>
                  <span className="font-mono text-[#777D91]">Max {s.maxMarks}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#20243A]">
              Authorized Roster ({roster.length} students)
            </h3>
            <p className="mt-1 font-mono text-xs text-[#5A6078]">
              {roster.map((r) => r.enrollmentNumber).join(', ')}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E4E5ED] pt-4">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="rounded-xl border border-[#E4E5ED] px-4 py-2.5 text-xs font-semibold text-[#20243A]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#4237C2] disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{createMutation.isPending ? 'Creating Class...' : 'Create Class & Generate QR'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Modal showing generated QR and Invite URL */}
      <Modal
        open={Boolean(createdResult)}
        onClose={() => {
          setCreatedResult(null);
          navigate('/hod/manage-classes');
        }}
        title="Class Created & Invitation Generated"
        description="Share this QR code or invitation link with authorized faculty and students. Private student data is never exposed in the invitation."
      >
        {createdResult && (
          <div className="space-y-5">
            <div className="flex flex-col items-center rounded-2xl border border-[#E4E5ED] bg-[#F8F9FC] p-6">
              <QRCodeSVG value={inviteUrl} size={184} level="M" />
              <p className="mt-4 font-mono text-base font-bold tracking-wider text-[#5146D8]">
                {createdResult.invitation.token}
              </p>
              <p className="mt-1 text-xs text-[#777D91]">Class Code: {createdResult.classCode}</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3 py-2 font-mono text-xs text-[#20243A]"
              />
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#5146D8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4237C2]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCreatedResult(null);
                  navigate('/hod/qr-invitations');
                }}
                className="rounded-xl border border-[#E4E5ED] px-4 py-2 text-xs font-semibold text-[#20243A]"
              >
                Manage All Invitations
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedResult(null);
                  navigate('/hod/manage-classes');
                }}
                className="rounded-xl bg-[#20243A] px-4 py-2 text-xs font-semibold text-white"
              >
                Go to Manage Classes
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

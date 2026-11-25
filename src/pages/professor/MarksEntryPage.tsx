import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Trophy,
  Save,
  Lock,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmptyState, PageHeader, StatusBadge, TableSkeleton } from '../../components/ui/CommonUi';

interface MarksResponse {
  subject: {
    id: string;
    code: string;
    name: string;
    max_marks: number;
    class_name: string;
    submission_status: string;
    is_published: number;
    is_archived: number;
  };
  students: Array<{
    serialNo: number;
    studentId: string;
    enrollmentNumber: string;
    studentName: string;
    maxMarks: number;
    obtainedMarks: number | null;
    status: string;
  }>;
  topper: {
    highestMarks: number | null;
    toppers: Array<{ studentId: string; studentName: string; enrollmentNumber: string; marks: number }>;
    isTie: boolean;
  };
  summary: {
    totalStudents: number;
    enteredCount: number;
    missingCount: number;
  };
}

export function MarksEntryPage() {
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
          submission_status: string;
        }>;
      }>('/api/professor/classes'),
  });

  const selectedSubjectId =
    searchParams.get('subjectId') || classesData?.subjects[0]?.id || '';

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Entered' | 'Pending'>('ALL');
  const [sortBy, setSortBy] = useState<'enrollment' | 'marksDesc' | 'marksAsc'>('enrollment');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const autosaveTimerRef = useRef<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['professor-marks', selectedSubjectId],
    queryFn: () => apiRequest<MarksResponse>(`/api/professor/subjects/${selectedSubjectId}/marks`),
    enabled: Boolean(selectedSubjectId),
  });

  useEffect(() => {
    if (data) {
      const init: Record<string, string> = {};
      for (const s of data.students) {
        init[s.studentId] = s.obtainedMarks !== null ? String(s.obtainedMarks) : '';
      }
      setDrafts(init);
      setFieldErrors({});
      setSaveState('idle');
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (entries: Array<{ studentId: string; obtainedMarks: number }>) =>
      apiRequest(`/api/professor/subjects/${selectedSubjectId}/marks`, {
        method: 'PUT',
        body: { entries },
      }),
    onMutate: () => setSaveState('saving'),
    onSuccess: () => {
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['professor-marks', selectedSubjectId] });
      queryClient.invalidateQueries({ queryKey: ['professor-classes'] });
      queryClient.invalidateQueries({ queryKey: ['professor-dashboard'] });
    },
    onError: (err: unknown) => {
      setSaveState('error');
      toast('error', 'Failed to save marks', err instanceof Error ? err.message : undefined);
    },
  });

  const isReadOnly =
    data?.subject.submission_status === 'LOCKED' ||
    data?.subject.is_published === 1 ||
    data?.subject.is_archived === 1;

  const validateValue = (raw: string, maxMarks: number): string | null => {
    if (raw.trim() === '') return null;
    const num = Number(raw);
    if (Number.isNaN(num) || !Number.isFinite(num)) return 'Enter a valid number.';
    if (num < 0) return 'Cannot be negative.';
    if (num > maxMarks) return `Max allowed is ${maxMarks}.`;
    return null;
  };

  const handleMarkChange = (studentId: string, rawVal: string) => {
    if (!data || isReadOnly) return;
    setDrafts((prev) => ({ ...prev, [studentId]: rawVal }));
    const err = validateValue(rawVal, data.subject.max_marks);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[studentId] = err;
      else delete next[studentId];
      return next;
    });

    // Debounced autosave for valid numeric change
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    if (!err && rawVal.trim() !== '') {
      const num = Number(rawVal);
      autosaveTimerRef.current = window.setTimeout(() => {
        saveMutation.mutate([{ studentId, obtainedMarks: num }]);
      }, 750);
    }
  };

  const handleSaveAll = () => {
    if (!data || isReadOnly) return;
    const entries: Array<{ studentId: string; obtainedMarks: number }> = [];
    for (const s of data.students) {
      const raw = drafts[s.studentId] ?? '';
      if (raw.trim() === '') continue;
      const err = validateValue(raw, data.subject.max_marks);
      if (err) {
        toast('error', `Fix invalid marks for ${s.enrollmentNumber}`, err);
        return;
      }
      const num = Number(raw);
      if (num !== s.obtainedMarks) {
        entries.push({ studentId: s.studentId, obtainedMarks: num });
      }
    }
    if (entries.length === 0) {
      toast('info', 'All marks are already saved');
      return;
    }
    saveMutation.mutate(entries, {
      onSuccess: () => toast('success', `Saved ${entries.length} marks entry(s)`),
    });
  };

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const list = data.students.filter((s) => {
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.enrollmentNumber.toLowerCase().includes(q) ||
        s.studentName.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });

    if (sortBy === 'marksDesc') {
      return [...list].sort((a, b) => (b.obtainedMarks ?? -1) - (a.obtainedMarks ?? -1));
    }
    if (sortBy === 'marksAsc') {
      return [...list].sort((a, b) => (a.obtainedMarks ?? 99999) - (b.obtainedMarks ?? 99999));
    }
    return list;
  }, [data, search, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pagedStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks Entry"
        description="Inline student marks entry with numeric validation, automatic saving, and live topper tracking."
        actions={
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSearchParams({ subjectId: e.target.value });
              setPage(1);
            }}
            className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A] outline-none focus:border-[#5146D8]"
          >
            {(classesData?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name} ({s.class_name})
              </option>
            ))}
          </select>
        }
      />

      {!selectedSubjectId ? (
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" />}
          title="No assigned subjects"
          description="Request access to a class subject from Join Class to begin marks entry."
        />
      ) : isLoading ? (
        <TableSkeleton rows={8} />
      ) : error || !data ? (
        <div className="rounded-2xl border border-[#D95364]/25 bg-white p-6 text-sm text-[#D95364]">
          {error instanceof Error ? error.message : 'Unable to load subject marks.'}
        </div>
      ) : (
        <>
          {/* Top Summary + Fixed Top-Right Topper Widget */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-5 lg:col-span-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#5146D8]">
                      {data.subject.code}
                    </span>
                    <StatusBadge status={data.subject.submission_status} />
                  </div>
                  <h2 className="mt-1 font-heading text-lg font-bold text-[#20243A]">
                    {data.subject.name}
                  </h2>
                  <p className="text-xs text-[#777D91]">
                    {data.subject.class_name} · Maximum Marks:{' '}
                    <span className="font-mono font-semibold text-[#20243A]">
                      {data.subject.max_marks}
                    </span>
                  </p>
                </div>

                {/* Autosave Indicator & Manual Save */}
                <div className="flex items-center gap-3">
                  {saveState === 'saving' && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#777D91]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5146D8]" />
                      <span>Saving...</span>
                    </span>
                  )}
                  {saveState === 'saved' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#21966B]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>All changes saved</span>
                    </span>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleSaveAll}
                      disabled={saveMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4237C2] disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </button>
                  )}
                </div>
              </div>

              {isReadOnly && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#21966B]/25 bg-[#21966B]/8 px-3.5 py-2.5 text-xs text-[#20243A]">
                  <Lock className="h-4 w-4 shrink-0 text-[#21966B]" />
                  <span>
                    This subject is locked. Normal editing is disabled; contact the HOD if an
                    authorized correction unlock is required.
                  </span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E5ED] pt-3 text-xs text-[#777D91]">
                <span>
                  Progress:{' '}
                  <strong className="font-mono text-[#20243A] tabular-nums">
                    {data.summary.enteredCount} / {data.summary.totalStudents}
                  </strong>{' '}
                  entered ({data.summary.missingCount} remaining)
                </span>
                {!isReadOnly && data.summary.missingCount === 0 && data.summary.totalStudents > 0 && (
                  <Link
                    to={`/professor/lock-submit?subjectId=${data.subject.id}`}
                    className="font-semibold text-[#5146D8] hover:underline"
                  >
                    Proceed to Lock &amp; Submit →
                  </Link>
                )}
              </div>
            </div>

            {/* Dynamic Top-Right Topper Widget (Handles Ties Explicitly!) */}
            <div className="rounded-2xl border border-[#5146D8]/25 bg-[#EFECFF]/55 p-5 lg:col-span-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5146D8]">
                  <Trophy className="h-4 w-4" />
                  <span>Subject Topper</span>
                </span>
                {data.topper.isTie && (
                  <span className="rounded-md bg-[#5146D8] px-2 py-0.5 text-[11px] font-semibold text-white">
                    {data.topper.toppers.length}-Way Tie
                  </span>
                )}
              </div>

              {data.topper.highestMarks === null ? (
                <p className="mt-4 text-xs text-[#777D91]">
                  Topper updates automatically once marks are saved.
                </p>
              ) : (
                <div className="mt-3">
                  <p className="font-mono text-2xl font-bold text-[#20243A] tabular-nums">
                    {data.topper.highestMarks}
                    <span className="text-sm font-normal text-[#777D91]">
                      {' '}
                      / {data.subject.max_marks}
                    </span>
                  </p>
                  <div className="mt-2.5 max-h-24 space-y-1.5 overflow-y-auto">
                    {data.topper.toppers.map((t) => (
                      <div
                        key={t.studentId}
                        className="flex items-center justify-between rounded-lg bg-white/85 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-semibold text-[#20243A] truncate">{t.studentName}</span>
                        <span className="font-mono text-[11px] text-[#5146D8]">
                          {t.enrollmentNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search, Filter & Sort Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777D91]" />
              <input
                type="text"
                placeholder="Search student or enrollment number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-[#E4E5ED] bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-[#5146D8]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-[#E4E5ED] bg-[#E9EAF2]/60 p-1">
                {(['ALL', 'Entered', 'Pending'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab);
                      setPage(1);
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      statusFilter === tab
                        ? 'bg-white text-[#5146D8] shadow-2xs'
                        : 'text-[#5A6078]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSortBy((prev) =>
                    prev === 'enrollment'
                      ? 'marksDesc'
                      : prev === 'marksDesc'
                        ? 'marksAsc'
                        : 'enrollment'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F8F9FC]"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-[#5146D8]" />
                <span>
                  Sort:{' '}
                  {sortBy === 'enrollment'
                    ? 'Enrollment'
                    : sortBy === 'marksDesc'
                      ? 'Highest Marks'
                      : 'Lowest Marks'}
                </span>
              </button>
            </div>
          </div>

          {/* Marks Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                  <tr>
                    <th className="px-5 py-3.5 w-16">Sr.</th>
                    <th className="px-4 py-3.5">Enrollment No.</th>
                    <th className="px-4 py-3.5">Student Name</th>
                    <th className="px-4 py-3.5 text-right">Max Marks</th>
                    <th className="px-4 py-3.5 text-right w-44">Obtained Marks</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E5ED]">
                  {pagedStudents.map((stu) => {
                    const errMsg = fieldErrors[stu.studentId];
                    const isTopper = data.topper.toppers.some((t) => t.studentId === stu.studentId);
                    return (
                      <tr key={stu.studentId} className="hover:bg-[#F8F9FC]">
                        <td className="px-5 py-3 font-mono text-xs text-[#777D91] tabular-nums">
                          {stu.serialNo}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#5146D8]">
                          {stu.enrollmentNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#20243A]">
                          <span>{stu.studentName}</span>
                          {isTopper && (
                            <span className="ml-2 text-[11px] font-semibold text-[#5146D8]">
                              · Topper
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[#777D91]">
                          {stu.maxMarks}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex flex-col items-end">
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={stu.maxMarks}
                              disabled={isReadOnly}
                              placeholder="—"
                              value={drafts[stu.studentId] ?? ''}
                              onChange={(e) => handleMarkChange(stu.studentId, e.target.value)}
                              className={`w-28 rounded-lg border px-2.5 py-1.5 text-right font-mono text-sm font-semibold tabular-nums outline-none transition-colors ${
                                errMsg
                                  ? 'border-[#D95364] bg-[#D95364]/6 text-[#D95364]'
                                  : 'border-[#E4E5ED] bg-white text-[#20243A] focus:border-[#5146D8]'
                              } disabled:bg-[#F3F4F8] disabled:text-[#777D91]`}
                            />
                            {errMsg && (
                              <span className="mt-0.5 text-[11px] text-[#D95364]">{errMsg}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <StatusBadge status={stu.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#E4E5ED] bg-[#F8F9FC] px-5 py-3 text-xs text-[#777D91]">
                <span>
                  Page {page} of {totalPages} ({filteredStudents.length} students)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1 text-[#20243A] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1 text-[#20243A] disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Search,
  History,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';

/* ========================= 1. VERIFY & PUBLISH FINAL RESULT ========================= */
interface PublishPreview {
  classInfo: {
    id: string;
    name: string;
    class_code: string;
    academic_year: string;
    semester: number;
    division: string;
    is_published: number;
    department_name: string;
    college: string;
  };
  subjects: Array<{
    id: string;
    code: string;
    name: string;
    max_marks: number;
    status: string;
    professor_name: string | null;
  }>;
  enrolledCount: number;
  pendingSubjects: Array<{ id: string; code: string; name: string; status: string }>;
  missingMarksCount: number;
  canPublish: boolean;
  statusMessage: string;
  combinedRows: Array<{
    studentId: string;
    enrollmentNumber: string;
    studentName: string;
    subjectMarks: Record<string, number | null>;
    totalObtained: number;
    totalMax: number;
    percentage: number;
    grade: string;
    resultStatus: string;
  }>;
  publication: {
    id: string;
    version: number;
    published_at: string;
    published_by_name: string;
    notes: string | null;
  } | null;
}

export function PublishResultsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: classesData } = useQuery({
    queryKey: ['hod-classes'],
    queryFn: () =>
      apiRequest<{
        classes: Array<{
          id: string;
          name: string;
          is_published: number;
          locked_subjects: number;
          total_subjects: number;
        }>;
      }>('/api/hod/classes'),
  });

  const [selectedClassId, setSelectedClassId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');

  useEffect(() => {
    if (!selectedClassId && classesData?.classes.length) {
      // Default to first unpublished class so the HOD sees live verification status immediately
      const preferred =
        classesData.classes.find(
          (c) => c.is_published === 0 && c.locked_subjects === c.total_subjects && c.total_subjects > 0
        ) ??
        classesData.classes.find((c) => c.is_published === 0) ??
        classesData.classes[0];
      setSelectedClassId(preferred.id);
    }
  }, [classesData, selectedClassId]);

  const { data: preview, isLoading } = useQuery({
    queryKey: ['hod-publish-preview', selectedClassId],
    queryFn: () =>
      apiRequest<PublishPreview>(`/api/hod/classes/${selectedClassId}/publish-preview`),
    enabled: Boolean(selectedClassId),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      apiRequest<{
        publicationId: string;
        version: number;
        reportCardsGenerated: number;
      }>(`/api/hod/classes/${selectedClassId}/publish`, {
        method: 'POST',
        body: { notes: publishNotes },
      }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      setPublishNotes('');
      queryClient.invalidateQueries({ queryKey: ['hod-publish-preview', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['hod-classes'] });
      queryClient.invalidateQueries({ queryKey: ['hod-dashboard'] });
      toast(
        'success',
        'Final Results Atomically Published',
        `Version ${res.version} released ${res.reportCardsGenerated} official student report cards simultaneously.`
      );
    },
    onError: (err: unknown) => {
      setConfirmOpen(false);
      toast('error', 'Publication blocked', err instanceof Error ? err.message : undefined);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify & Publish Final Results"
        description="Synchronized atomic release gate. Results can only be published once every required subject is locked."
        actions={
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A] outline-none focus:border-[#5146D8]"
          >
            {(classesData?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.is_published === 1 ? 'Published' : `${c.locked_subjects}/${c.total_subjects} locked`})
              </option>
            ))}
          </select>
        }
      />

      {isLoading || !preview ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          {/* Gate Status Banner */}
          <div
            className={`rounded-2xl border p-6 ${
              preview.classInfo.is_published === 1
                ? 'border-[#21966B]/30 bg-[#21966B]/6'
                : preview.canPublish
                  ? 'border-[#21966B]/30 bg-white'
                  : 'border-[#D99A32]/35 bg-white'
            }`}
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    preview.classInfo.is_published === 1 || preview.canPublish
                      ? 'bg-[#21966B]/15 text-[#21966B]'
                      : 'bg-[#D99A32]/15 text-[#D99A32]'
                  }`}
                >
                  {preview.classInfo.is_published === 1 || preview.canPublish ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="font-heading text-base font-bold text-[#20243A]">
                    {preview.statusMessage}
                  </h2>
                  {preview.classInfo.is_published === 1 && preview.publication ? (
                    <p className="mt-1 text-xs text-[#5A6078]">
                      Published v{preview.publication.version} by {preview.publication.published_by_name}{' '}
                      on {format(new Date(preview.publication.published_at), 'dd MMM yyyy, hh:mm a')}.
                    </p>
                  ) : preview.pendingSubjects.length > 0 ? (
                    <p className="mt-1 text-xs text-[#5A6078]">
                      Pending lock:{' '}
                      <span className="font-mono font-semibold text-[#20243A]">
                        {preview.pendingSubjects.map((s) => `${s.code} (${s.status})`).join(', ')}
                      </span>
                      . Students cannot see any partial subject marks until publication.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[#5A6078]">
                      All {preview.subjects.length} subjects are locked across {preview.enrolledCount}{' '}
                      enrolled students. Review the combined table below before atomic publication.
                    </p>
                  )}
                </div>
              </div>

              {preview.classInfo.is_published === 0 && (
                <button
                  type="button"
                  disabled={!preview.canPublish}
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5146D8] px-5 py-3 text-xs font-bold tracking-wide text-white transition-colors hover:bg-[#4237C2] disabled:cursor-not-allowed disabled:bg-[#C6C9D8] whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>VERIFY &amp; PUBLISH RESULT</span>
                </button>
              )}
            </div>

            {/* Subject Lock Pills Row */}
            <div className="mt-5 grid grid-cols-1 gap-2.5 border-t border-[#E4E5ED] pt-4 sm:grid-cols-3">
              {preview.subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-mono font-semibold text-[#20243A]">{sub.code}</p>
                    <p className="truncate text-[#777D91]">{sub.name}</p>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Combined Marks Verification Report */}
          <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
            <div className="border-b border-[#E4E5ED] px-5 py-4">
              <h3 className="font-heading text-base font-bold text-[#20243A]">
                Combined Class Verification Sheet ({preview.enrolledCount} Students)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                  <tr>
                    <th className="px-5 py-3">Enrollment No.</th>
                    <th className="px-4 py-3">Student Name</th>
                    {preview.subjects.map((sub) => (
                      <th key={sub.id} className="px-3 py-3 text-right font-mono">
                        {sub.code} (/{sub.max_marks})
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">%</th>
                    <th className="px-5 py-3 text-right">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E5ED]">
                  {preview.combinedRows.map((row) => (
                    <tr key={row.studentId} className="hover:bg-[#F8F9FC]">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-[#5146D8]">
                        {row.enrollmentNumber}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#20243A]">
                        {row.studentName}
                      </td>
                      {preview.subjects.map((sub) => {
                        const val = row.subjectMarks[sub.code];
                        return (
                          <td
                            key={sub.id}
                            className="px-3 py-3 text-right font-mono text-xs tabular-nums"
                          >
                            {val === null ? (
                              <span className="text-[#D95364]">Missing</span>
                            ) : (
                              <span className="text-[#20243A]">{val}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                        {row.totalObtained}/{row.totalMax}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-[#5146D8]">
                        {row.percentage.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-[#20243A]">
                        {row.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => publishMutation.mutate()}
            title={`Verify & Publish Results for ${preview.classInfo.name}?`}
            description={`This executes a single atomic database transaction generating official report cards for all ${preview.enrolledCount} enrolled students simultaneously and archives this class.`}
            confirmLabel="VERIFY & PUBLISH RESULT"
            tone="success"
            isLoading={publishMutation.isPending}
          />
        </>
      )}
    </div>
  );
}

/* ========================= 2. APPEND-ONLY AUDIT LOGS ========================= */
interface AuditResponse {
  logs: Array<{
    id: string;
    action: string;
    actor_role: string;
    actor_name: string;
    actor_email: string;
    entity_type: string;
    subject_code: string | null;
    subject_name: string | null;
    student_enrollment: string | null;
    previous_value: string | null;
    new_value: string | null;
    details: string | null;
    created_at: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
  availableActions: string[];
}

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['hod-audit-logs', search, action, role, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(search ? { search } : {}),
        ...(action ? { action } : {}),
        ...(role ? { role } : {}),
      });
      return apiRequest<AuditResponse>(`/api/hod/audit-logs?${qs.toString()}`);
    },
  });

  const clearFilters = () => {
    setSearch('');
    setAction('');
    setRole('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Immutable Audit Logs"
        description="Append-only institutional record of marks entries, edits, locks, HOD unlocks, and result publications."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-xs font-medium text-[#777D91]">
            <Lock className="h-3.5 w-3.5 text-[#5146D8]" />
            <span>Read-Only Append Log</span>
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777D91]" />
          <input
            type="text"
            placeholder="Search actor, enrollment, subject, details..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-[#E4E5ED] bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-[#5146D8]"
          />
        </div>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs font-medium text-[#20243A]"
        >
          <option value="">All Actions</option>
          {(data?.availableActions ?? []).map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs font-medium text-[#20243A]"
        >
          <option value="">All Roles</option>
          <option value="HOD">HOD</option>
          <option value="PROFESSOR">Professor</option>
          <option value="STUDENT">Student</option>
        </select>
        {(search || action || role) && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs font-semibold text-[#5146D8] hover:bg-[#EFECFF]"
          >
            Clear Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : !data || data.logs.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="No matching audit events"
          description="Try clearing your filters to view the full institutional audit history."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] font-semibold text-[#777D91]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Subject / Student</th>
                  <th className="px-4 py-3">Previous → New</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E5ED]">
                {data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8F9FC]">
                    <td className="px-4 py-3 font-mono text-[#777D91] whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#20243A]">{log.actor_name}</p>
                      <p className="text-[11px] text-[#777D91]">{log.actor_role}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#5146D8] whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#20243A]">
                      {log.subject_code && <div>{log.subject_code}</div>}
                      {log.student_enrollment && (
                        <div className="text-[#777D91]">{log.student_enrollment}</div>
                      )}
                      {!log.subject_code && !log.student_enrollment && '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {log.previous_value || log.new_value ? (
                        <span>
                          <span className="text-[#777D91]">{log.previous_value ?? 'None'}</span>
                          {' → '}
                          <span className="font-semibold text-[#20243A]">{log.new_value ?? '—'}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-[#5A6078]">{log.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#E4E5ED] bg-[#F8F9FC] px-4 py-3 text-xs text-[#777D91]">
            <span>
              Showing page {data.page} of {data.totalPages} ({data.total} events)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1 font-medium text-[#20243A] disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1 font-medium text-[#20243A] disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Check,
  X,
  BookOpenCheck,
  UserCheck,
  Lock,
  Unlock,
  BellRing,
  Search,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  EmptyState,
  Modal,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';

/* ========================= 1. SUBJECT PERMISSIONS ========================= */
interface SubjectReqRow {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
  faculty_id: string;
  professor_name: string;
  professor_email: string;
  class_name: string;
  academic_year: string;
  semester: number;
  division: string;
  subject_code: string;
  subject_name: string;
}

export function SubjectPermissionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['hod-subject-requests'],
    queryFn: () => apiRequest<{ requests: SubjectReqRow[] }>('/api/hod/subject-requests'),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      apiRequest(`/api/hod/subject-requests/${id}/decide`, {
        method: 'POST',
        body: { decision },
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hod-subject-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hod-dashboard'] });
      toast('success', `Faculty request ${vars.decision.toLowerCase()}`);
    },
    onError: (err: unknown) =>
      toast('error', 'Action failed', err instanceof Error ? err.message : undefined),
  });

  const requests = (data?.requests ?? []).filter(
    (r) => statusFilter === 'ALL' || r.status === statusFilter
  );

  return (
    <div>
      <PageHeader
        title="Subject Permissions"
        description="Authorize professors requesting marks-entry access to specific class subjects."
      />

      <div className="mb-4 inline-flex items-center gap-1 rounded-xl border border-[#E4E5ED] bg-[#E9EAF2]/60 p-1">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === tab
                ? 'bg-white text-[#5146D8] shadow-2xs'
                : 'text-[#5A6078] hover:text-[#20243A]'
            }`}
          >
            {tab === 'ALL' ? 'All Requests' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<BookOpenCheck className="h-5 w-5" />}
          title="No faculty subject requests"
          description="When professors request access to a class subject via invitation code, their requests will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                <tr>
                  <th className="px-5 py-3.5">Professor</th>
                  <th className="px-4 py-3.5">Faculty ID</th>
                  <th className="px-4 py-3.5">Requested Class</th>
                  <th className="px-4 py-3.5">Requested Subject</th>
                  <th className="px-4 py-3.5">Request Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E5ED]">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8F9FC]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#20243A]">{r.professor_name}</p>
                      <p className="text-xs text-[#777D91]">{r.professor_email}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#20243A]">{r.faculty_id}</td>
                    <td className="px-4 py-3.5 text-xs text-[#20243A]">
                      <p className="font-medium">{r.class_name}</p>
                      <p className="text-[#777D91]">
                        {r.academic_year} · Sem {r.semester} Div {r.division}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <p className="font-semibold text-[#5146D8]">{r.subject_code}</p>
                      <p className="text-[#20243A]">{r.subject_name}</p>
                      {r.note && <p className="mt-0.5 text-[11px] text-[#777D91]">{r.note}</p>}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#777D91]">
                      {format(new Date(r.created_at), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {r.status === 'PENDING' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decideMutation.mutate({ id: r.id, decision: 'APPROVED' })}
                            disabled={decideMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#21966B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1A7D58]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => decideMutation.mutate({ id: r.id, decision: 'REJECTED' })}
                            disabled={decideMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#D95364]/30 bg-[#D95364]/10 px-3 py-1.5 text-xs font-semibold text-[#D95364] hover:bg-[#D95364]/20"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#777D91]">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= 2. STUDENT ENROLLMENT REQUESTS ========================= */
interface EnrollmentReqRow {
  id: string;
  enrollment_number: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  student_name: string;
  student_email: string;
  class_name: string;
  academic_year: string;
  semester: number;
  division: string;
  in_roster: number;
}

export function EnrollmentRequestsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['hod-enrollment-requests'],
    queryFn: () => apiRequest<{ requests: EnrollmentReqRow[] }>('/api/hod/enrollment-requests'),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      apiRequest(`/api/hod/enrollment-requests/${id}/decide`, {
        method: 'POST',
        body: { decision },
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hod-enrollment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hod-dashboard'] });
      toast('success', `Student enrollment ${vars.decision.toLowerCase()}`);
    },
    onError: (err: unknown) =>
      toast('error', 'Decision failed', err instanceof Error ? err.message : undefined),
  });

  const filtered = (data?.requests ?? []).filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesSearch =
      r.enrollment_number.toLowerCase().includes(search.toLowerCase()) ||
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.class_name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div>
      <PageHeader
        title="Student Enrollment Requests"
        description="Verify roster-matched students joining through class invitations before granting class access."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777D91]" />
          <input
            type="text"
            placeholder="Search enrollment or student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#E4E5ED] bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-[#5146D8]"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#E4E5ED] bg-[#E9EAF2]/60 p-1">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab
                  ? 'bg-white text-[#5146D8] shadow-2xs'
                  : 'text-[#5A6078] hover:text-[#20243A]'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-5 w-5" />}
          title="No student enrollment requests"
          description="Requests submitted by students using your class QR codes or invitation URLs will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                <tr>
                  <th className="px-5 py-3.5">Enrollment No.</th>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Target Class</th>
                  <th className="px-4 py-3.5">Roster Match</th>
                  <th className="px-4 py-3.5">Requested On</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E5ED]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8F9FC]">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#5146D8]">
                      {r.enrollment_number}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-[#20243A]">{r.student_name}</p>
                      <p className="text-xs text-[#777D91]">{r.student_email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#20243A]">
                      <p className="font-medium">{r.class_name}</p>
                      <p className="text-[#777D91]">Sem {r.semester} · Div {r.division}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {r.in_roster > 0 ? (
                        <span className="font-medium text-[#21966B]">Verified on Roster</span>
                      ) : (
                        <span className="font-medium text-[#D95364]">Not in Roster</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#777D91]">
                      {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {r.status === 'PENDING' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decideMutation.mutate({ id: r.id, decision: 'APPROVED' })}
                            disabled={decideMutation.isPending || r.in_roster === 0}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#21966B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1A7D58] disabled:opacity-40"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => decideMutation.mutate({ id: r.id, decision: 'REJECTED' })}
                            disabled={decideMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#D95364]/30 bg-[#D95364]/10 px-3 py-1.5 text-xs font-semibold text-[#D95364] hover:bg-[#D95364]/20"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#777D91]">
                          {r.decided_at ? format(new Date(r.decided_at), 'dd MMM') : 'Done'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= 3. SUBJECT LOCK STATUS TRACKER ========================= */
interface LockTrackerResponse {
  classInfo: {
    id: string;
    name: string;
    class_code: string;
    academic_year: string;
    semester: number;
    division: string;
    is_published: number;
    department_name: string;
  };
  totalStudents: number;
  totalSubjects: number;
  lockedCount: number;
  progressPercent: number;
  subjects: Array<{
    id: string;
    code: string;
    name: string;
    max_marks: number;
    professor_name: string | null;
    faculty_id: string | null;
    status: string;
    locked_at: string | null;
    last_updated: string | null;
    marks_submitted: number;
    total_students: number;
  }>;
}

export function SubjectLockTrackerPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: classesData } = useQuery({
    queryKey: ['hod-classes'],
    queryFn: () =>
      apiRequest<{
        classes: Array<{ id: string; name: string; is_published: number }>;
      }>('/api/hod/classes'),
  });

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [unlockTarget, setUnlockTarget] = useState<{ id: string; code: string; name: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  useEffect(() => {
    if (!selectedClassId && classesData?.classes.length) {
      setSelectedClassId(classesData.classes[0].id);
    }
  }, [classesData, selectedClassId]);

  const { data: tracker, isLoading } = useQuery({
    queryKey: ['hod-lock-tracker', selectedClassId],
    queryFn: () => apiRequest<LockTrackerResponse>(`/api/hod/classes/${selectedClassId}/lock-tracker`),
    enabled: Boolean(selectedClassId),
  });

  const remindMutation = useMutation({
    mutationFn: (subjectId: string) =>
      apiRequest<{ message: string }>(`/api/hod/subjects/${subjectId}/remind`, { method: 'POST' }),
    onSuccess: (res) => toast('success', res.message),
    onError: (err: unknown) =>
      toast('error', 'Could not send reminder', err instanceof Error ? err.message : undefined),
  });

  const unlockMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/hod/subjects/${unlockTarget!.id}/unlock`, {
        method: 'POST',
        body: { reason: unlockReason },
      }),
    onSuccess: () => {
      setUnlockTarget(null);
      setUnlockReason('');
      queryClient.invalidateQueries({ queryKey: ['hod-lock-tracker', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['hod-dashboard'] });
      toast('success', 'Subject unlocked for authorized correction');
    },
    onError: (err: unknown) =>
      toast('error', 'Unlock failed', err instanceof Error ? err.message : undefined),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subject Lock Status Tracker"
        description="Monitor faculty submission progress across every subject in a class before result verification."
        actions={
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A] outline-none focus:border-[#5146D8]"
          >
            {(classesData?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_published === 1 ? '(Published)' : ''}
              </option>
            ))}
          </select>
        }
      />

      {isLoading || !tracker ? (
        <TableSkeleton rows={4} />
      ) : (
        <>
          {/* Progress Bar Card */}
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-base font-bold text-[#20243A]">
                  {tracker.classInfo.name}
                </h2>
                <p className="mt-0.5 text-xs text-[#777D91]">
                  {tracker.classInfo.department_name} · {tracker.totalStudents} enrolled students ·{' '}
                  {tracker.lockedCount} of {tracker.totalSubjects} subjects locked
                </p>
              </div>
              <span className="font-mono text-lg font-bold text-[#5146D8] tabular-nums">
                {tracker.progressPercent}% Locked
              </span>
            </div>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#E9EAF2]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  tracker.progressPercent === 100 ? 'bg-[#21966B]' : 'bg-[#5146D8]'
                }`}
                style={{ width: `${tracker.progressPercent}%` }}
              />
            </div>
          </div>

          {/* Subjects Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                  <tr>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-4 py-3.5">Assigned Professor</th>
                    <th className="px-4 py-3.5 text-right">Marks Submitted</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Last Updated</th>
                    <th className="px-5 py-3.5 text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E5ED]">
                  {tracker.subjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#F8F9FC]">
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-semibold text-[#5146D8]">{sub.code}</p>
                        <p className="font-semibold text-[#20243A]">{sub.name}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <p className="font-medium text-[#20243A]">
                          {sub.professor_name ?? 'Unassigned'}
                        </p>
                        {sub.faculty_id && (
                          <p className="font-mono text-[#777D91]">{sub.faculty_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-[#20243A]">
                        {sub.marks_submitted} / {sub.total_students}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={sub.status} />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#777D91]">
                        {sub.locked_at
                          ? `Locked ${format(new Date(sub.locked_at), 'dd MMM, HH:mm')}`
                          : sub.last_updated
                            ? format(new Date(sub.last_updated), 'dd MMM, HH:mm')
                            : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {tracker.classInfo.is_published === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[#21966B]">
                            <Lock className="h-3.5 w-3.5" />
                            <span>Published</span>
                          </span>
                        ) : sub.status === 'LOCKED' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setUnlockTarget({ id: sub.id, code: sub.code, name: sub.name })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D99A32]/35 bg-[#D99A32]/10 px-3 py-1.5 text-xs font-semibold text-[#B37A1E] hover:bg-[#D99A32]/20"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span>Authorized Unlock</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => remindMutation.mutate(sub.id)}
                            disabled={!sub.professor_name || remindMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E5ED] bg-white px-3 py-1.5 text-xs font-semibold text-[#20243A] hover:border-[#5146D8]/40 hover:text-[#5146D8] disabled:opacity-40"
                          >
                            <BellRing className="h-3.5 w-3.5" />
                            <span>Send Reminder</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* HOD Authorized Unlock Modal */}
      <Modal
        open={Boolean(unlockTarget)}
        onClose={() => {
          setUnlockTarget(null);
          setUnlockReason('');
        }}
        title={`Authorize Correction Unlock — ${unlockTarget?.code ?? ''}`}
        description="Unlocking a finalized subject permits the assigned professor to apply corrections. Original marks and this unlock reason are permanently recorded in the audit log."
        maxWidthClass="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            unlockMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-[#20243A]">
              Audit Reason for Unlocking
            </label>
            <textarea
              required
              minLength={5}
              rows={3}
              placeholder="e.g. Approved re-evaluation adjustment for Question 3B."
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] p-3 text-sm outline-none focus:border-[#5146D8]"
            />
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setUnlockTarget(null)}
              className="rounded-xl border border-[#E4E5ED] px-4 py-2 text-xs font-semibold text-[#20243A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={unlockMutation.isPending}
              className="rounded-xl bg-[#D99A32] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B88022]"
            >
              {unlockMutation.isPending ? 'Unlocking...' : 'Confirm Unlock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

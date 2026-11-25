import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BookOpen,
  Building2,
  Clock,
  Lock,
  QrCode,
  Camera,
  ArrowRight,
  Archive,
  Eye,
  FileSpreadsheet,
  Sparkles,
  PenLine,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  EmptyState,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';
import { QrScannerModal } from '../../components/ui/QrScannerModal';

interface AssignedSubjectCard {
  id: string;
  code: string;
  name: string;
  max_marks: number;
  assessment_type: string;
  class_id: string;
  class_name: string;
  class_code?: string;
  academic_year: string;
  semester: number;
  division: string;
  department_name: string;
  submission_status: string;
  locked_at: string | null;
  published_at?: string | null;
  student_count: number;
  marks_entered: number;
}

/* ========================= 1. PROFESSOR OVERVIEW ========================= */
export function ProfessorOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['professor-dashboard'],
    queryFn: () =>
      apiRequest<{
        stats: {
          assignedClasses: number;
          assignedSubjects: number;
          pendingSubmissions: number;
          lockedSubmissions: number;
          pendingRequests: number;
        };
        activeSubjects: AssignedSubjectCard[];
      }>('/api/professor/dashboard'),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Faculty Overview" description="Loading your assigned subjects..." />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Workspace Overview"
        description="Manage marks entry, spreadsheet imports, constructive academic remarks, and final subject locking."
        actions={
          <Link
            to="/professor/join-class"
            className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4237C2]"
          >
            <QrCode className="h-4 w-4" />
            <span>Join Class via QR / Invite</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assigned Classes"
          value={data.stats.assignedClasses}
          icon={<Building2 className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Assigned Subjects"
          value={data.stats.assignedSubjects}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label="Pending Submissions"
          value={data.stats.pendingSubmissions}
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Locked Submissions"
          value={data.stats.lockedSubmissions}
          icon={<Lock className="h-4 w-4" />}
          tone="success"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-[#20243A]">
            Active Subject Assignments
          </h2>
          <Link to="/professor/classes" className="text-xs font-semibold text-[#5146D8] hover:underline">
            View all classes
          </Link>
        </div>

        {data.activeSubjects.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No active subjects assigned"
            description="Scan a class QR code or paste an invitation link from your HOD to request subject access."
            action={
              <Link
                to="/professor/join-class"
                className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-semibold text-white"
              >
                <QrCode className="h-4 w-4" />
                <span>Join Class</span>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.activeSubjects.map((sub) => (
              <div
                key={sub.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#5146D8]">{sub.code}</p>
                      <h3 className="mt-0.5 font-heading text-base font-bold text-[#20243A]">
                        {sub.name}
                      </h3>
                    </div>
                    <StatusBadge status={sub.submission_status} />
                  </div>
                  <p className="mt-2 text-xs text-[#777D91]">
                    {sub.class_name} · {sub.department_name} · Sem {sub.semester} Div {sub.division}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[#5A6078]">
                      Marks progress:{' '}
                      <strong className="font-mono text-[#20243A] tabular-nums">
                        {sub.marks_entered} / {sub.student_count}
                      </strong>
                    </span>
                    <span className="font-mono text-[#777D91]">Max {sub.max_marks}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E4E5ED] pt-4">
                  <Link
                    to={`/professor/marks?subjectId=${sub.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#5146D8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4237C2]"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    <span>{sub.submission_status === 'LOCKED' ? 'View Marks' : 'Enter Marks'}</span>
                  </Link>
                  <Link
                    to={`/professor/excel-import?subjectId=${sub.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] px-3 py-1.5 text-xs font-medium text-[#20243A] hover:bg-[#F3F4F8]"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Excel Import</span>
                  </Link>
                  <Link
                    to={`/professor/ai-remarks?subjectId=${sub.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] px-3 py-1.5 text-xs font-medium text-[#20243A] hover:bg-[#F3F4F8]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#7966E8]" />
                    <span>AI Remarks</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================= 2. JOIN CLASS ========================= */
export function ProfessorJoinClassPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inviteInput, setInviteInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [note, setNote] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupData, setLookupData] = useState<{
    classInfo: {
      class_name: string;
      department_name: string;
      academic_year: string;
      semester: number;
      division: string;
      token: string;
    };
    subjects: Array<{
      id: string;
      code: string;
      name: string;
      max_marks: number;
      assigned_professor_name: string | null;
    }>;
  } | null>(null);

  const { data: myRequests } = useQuery({
    queryKey: ['professor-my-requests'],
    queryFn: () =>
      apiRequest<{
        requests: Array<{
          id: string;
          status: string;
          note: string | null;
          created_at: string;
          class_name: string;
          subject_code: string;
          subject_name: string;
        }>;
      }>('/api/professor/my-requests'),
  });

  const performLookup = async (codeText: string) => {
    setLookupError(null);
    if (!codeText.trim()) return;
    try {
      const res = await apiRequest<NonNullable<typeof lookupData>>(
        `/api/professor/invitations/lookup?code=${encodeURIComponent(codeText.trim())}`
      );
      setLookupData(res);
      setSelectedSubjectId(res.subjects[0]?.id ?? '');
    } catch (err: unknown) {
      setLookupData(null);
      setLookupError(err instanceof Error ? err.message : 'Unable to verify invitation.');
    }
  };

  const requestMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ message: string }>('/api/professor/join-request', {
        method: 'POST',
        body: {
          inviteCode: inviteInput,
          subjectId: selectedSubjectId,
          note,
        },
      }),
    onSuccess: (res) => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['professor-my-requests'] });
      toast('success', 'Access request submitted', res.message);
    },
    onError: (err: unknown) =>
      toast('error', 'Request failed', err instanceof Error ? err.message : undefined),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Join Class & Request Subject Access"
        description="Scan a class QR code, paste an invitation URL, or enter an invitation code from your HOD."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-7">
          <h2 className="font-heading text-base font-bold text-[#20243A]">
            Verify Class Invitation
          </h2>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              placeholder="Paste invitation link or enter code (e.g. GIT-CE4A-2026)"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              className="flex-1 rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[#5146D8]"
            />
            <button
              type="button"
              onClick={() => performLookup(inviteInput)}
              className="rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4237C2]"
            >
              Lookup Class
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-4 py-2.5 text-xs font-semibold text-[#20243A] hover:bg-[#EFECFF] hover:text-[#5146D8]"
            >
              <Camera className="h-4 w-4" />
              <span>Scan QR</span>
            </button>
          </div>

          {lookupError && <p className="mt-3 text-xs text-[#D95364]">{lookupError}</p>}

          {lookupData && (
            <div className="mt-5 space-y-4 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4">
              <div>
                <p className="text-xs text-[#777D91]">{lookupData.classInfo.department_name}</p>
                <h3 className="font-heading text-base font-bold text-[#20243A]">
                  {lookupData.classInfo.class_name}
                </h3>
                <p className="text-xs text-[#777D91]">
                  Academic Year {lookupData.classInfo.academic_year} · Sem{' '}
                  {lookupData.classInfo.semester} · Div {lookupData.classInfo.division}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Select Requested Subject
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                >
                  {lookupData.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} — {sub.name} (Max {sub.max_marks})
                      {sub.assigned_professor_name
                        ? ` [Assigned: ${sub.assigned_professor_name}]`
                        : ' [Unassigned]'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Note to HOD (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assigned faculty for Semester 4 Division A"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>

              <button
                type="button"
                onClick={() => requestMutation.mutate()}
                disabled={!selectedSubjectId || requestMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4237C2] disabled:opacity-50"
              >
                <span>{requestMutation.isPending ? 'Submitting...' : 'Submit Access Request'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* My Requests */}
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-5">
          <h2 className="font-heading text-base font-bold text-[#20243A]">My Access Requests</h2>
          <div className="mt-4 space-y-3">
            {(myRequests?.requests ?? []).length === 0 ? (
              <p className="text-xs text-[#777D91]">No subject access requests submitted yet.</p>
            ) : (
              myRequests!.requests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-3.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-semibold text-[#5146D8]">{r.subject_code}</p>
                      <p className="font-semibold text-[#20243A]">{r.subject_name}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-[#777D91]">{r.class_name}</p>
                  <p className="mt-1 text-[11px] text-[#777D91]">
                    Requested {format(new Date(r.created_at), 'dd MMM yyyy')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={(decoded) => {
          setInviteInput(decoded);
          performLookup(decoded);
        }}
      />
    </div>
  );
}

/* ========================= 3. MY CLASSES ========================= */
export function ProfessorMyClassesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['professor-classes'],
    queryFn: () => apiRequest<{ subjects: AssignedSubjectCard[] }>('/api/professor/classes'),
  });

  return (
    <div>
      <PageHeader
        title="My Assigned Classes"
        description="Active semester subjects authorized by your department HOD."
      />

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : (data?.subjects ?? []).length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No active assigned classes"
          description="Use Join Class to scan a class QR code and request authorization for your subject."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {data!.subjects.map((sub) => (
            <div
              key={sub.id}
              className="flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#5146D8]">{sub.code}</span>
                  <StatusBadge status={sub.submission_status} />
                </div>
                <h3 className="mt-2 font-heading text-base font-bold text-[#20243A]">{sub.name}</h3>
                <p className="mt-1 text-xs font-medium text-[#5A6078]">{sub.class_name}</p>

                <dl className="mt-4 space-y-1.5 border-t border-[#E4E5ED] pt-3 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#777D91]">Department</dt>
                    <dd className="font-medium text-[#20243A]">{sub.department_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#777D91]">Semester / Div</dt>
                    <dd className="font-medium text-[#20243A]">
                      Sem {sub.semester} · Div {sub.division}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#777D91]">Academic Year</dt>
                    <dd className="font-mono text-[#20243A]">{sub.academic_year}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#777D91]">Students Graded</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#20243A]">
                      {sub.marks_entered} / {sub.student_count}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <Link
                  to={`/professor/marks?subjectId=${sub.id}`}
                  className="flex-1 rounded-xl bg-[#5146D8] py-2 text-center text-xs font-semibold text-white hover:bg-[#4237C2]"
                >
                  {sub.submission_status === 'LOCKED' ? 'Inspect Marks' : 'Enter Marks'}
                </Link>
                <Link
                  to={`/professor/lock-submit?subjectId=${sub.id}`}
                  className="rounded-xl border border-[#E4E5ED] px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F3F4F8]"
                >
                  Lock
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================= 4. PREVIOUS CLASSES ARCHIVE (READ-ONLY) ========================= */
export function ProfessorArchivePage() {
  const [inspectId, setInspectId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['professor-archive'],
    queryFn: () => apiRequest<{ subjects: AssignedSubjectCard[] }>('/api/professor/archive'),
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['professor-archive-detail', inspectId],
    queryFn: () =>
      apiRequest<{
        subject: { code: string; name: string; class_name: string; max_marks: number };
        students: Array<{
          serialNo: number;
          enrollmentNumber: string;
          studentName: string;
          obtainedMarks: number | null;
          remarkText: string;
        }>;
      }>(`/api/professor/subjects/${inspectId}/marks`),
    enabled: Boolean(inspectId),
  });

  return (
    <div>
      <PageHeader
        title="Previous Classes Archive"
        description="Read-only historical records of published semesters you instructed."
      />

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : (data?.subjects ?? []).length === 0 ? (
        <EmptyState
          icon={<Archive className="h-5 w-5" />}
          title="No archived classes yet"
          description="Completed classes appear here automatically once their official results are published by the HOD."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data!.subjects.map((sub) => (
            <div
              key={sub.id}
              className="flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#5146D8]">{sub.code}</span>
                  <StatusBadge status="PUBLISHED" />
                </div>
                <h3 className="mt-2 font-heading text-base font-bold text-[#20243A]">{sub.name}</h3>
                <p className="mt-1 text-xs text-[#5A6078]">
                  {sub.class_name} · {sub.academic_year}
                </p>
                <p className="mt-2 text-xs text-[#777D91]">
                  {sub.student_count} students · Read-only archival record
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectId(sub.id)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] py-2 text-xs font-semibold text-[#20243A] hover:border-[#5146D8]/40 hover:text-[#5146D8]"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect Historical Marks</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(inspectId)}
        onClose={() => setInspectId(null)}
        title={detail ? `${detail.subject.code} — ${detail.subject.name}` : 'Archived Subject Record'}
        description={
          detail
            ? `${detail.subject.class_name} · Read-only historical snapshot (Max ${detail.subject.max_marks})`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {loadingDetail || !detail ? (
          <TableSkeleton rows={5} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E4E5ED]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-[#777D91]">
                <tr>
                  <th className="px-3.5 py-2.5">#</th>
                  <th className="px-3.5 py-2.5">Enrollment</th>
                  <th className="px-3.5 py-2.5">Student Name</th>
                  <th className="px-3.5 py-2.5 text-right">Marks</th>
                  <th className="px-3.5 py-2.5">Saved Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E5ED]">
                {detail.students.map((s) => (
                  <tr key={s.enrollmentNumber}>
                    <td className="px-3.5 py-2.5 font-mono text-[#777D91]">{s.serialNo}</td>
                    <td className="px-3.5 py-2.5 font-mono font-semibold text-[#20243A]">
                      {s.enrollmentNumber}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-[#20243A]">{s.studentName}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold tabular-nums text-[#5146D8]">
                      {s.obtainedMarks ?? '—'} / {detail.subject.max_marks}
                    </td>
                    <td className="max-w-xs px-3.5 py-2.5 text-[#5A6078]">{s.remarkText || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

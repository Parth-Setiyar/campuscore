import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Award,
  BookOpenCheck,
  Clock,
  FileText,
  GraduationCap,
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';
import { QrScannerModal } from '../../components/ui/QrScannerModal';

/* ========================= 1. STUDENT OVERVIEW ========================= */
interface StudentDashboardData {
  profile: {
    id: string;
    enrollment_number: string;
    current_semester: number;
    batch: string;
    full_name: string;
    email: string;
    department_name: string;
    department_code: string;
    college: string;
  };
  latestReportCard: {
    id: string;
    report_code: string;
    total_max_marks: number;
    total_obtained: number;
    percentage: number;
    grade: string;
    result_status: string;
    published_at: string;
    class_name: string;
    academic_year: string;
    semester: number;
    division: string;
  } | null;
  pendingClasses: Array<{
    id: string;
    name: string;
    academic_year: string;
    semester: number;
    division: string;
    total_subjects: number;
    locked_subjects: number;
  }>;
  history: Array<{
    id: string;
    semester: number;
    academic_year: string;
    class_name: string;
    percentage: number;
    grade: string;
    result_status: string;
    published_at: string;
  }>;
}

export function StudentOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => apiRequest<StudentDashboardData>('/api/student/dashboard'),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student Portal" description="Loading your academic record..." />
        <TableSkeleton rows={5} />
      </div>
    );
  }

  const { profile, latestReportCard, pendingClasses, history } = data;
  const chartData = history.map((h) => ({
    label: `Sem ${h.semester}`,
    percentage: h.percentage,
    grade: h.grade,
  }));

  return (
    <div className="space-y-6">
      {/* Student Identity Header */}
      <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EFECFF] text-[#5146D8]">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#5146D8]">{profile.college}</p>
              <h1 className="mt-0.5 font-heading text-2xl font-bold tracking-tight text-[#20243A]">
                {profile.full_name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#777D91]">
                <span>
                  Enrollment:{' '}
                  <strong className="font-mono text-[#20243A]">{profile.enrollment_number}</strong>
                </span>
                <span>{profile.department_name}</span>
                <span>Semester {profile.current_semester}</span>
                <span>Batch {profile.batch}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              to="/student/join-class"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5ED] bg-white px-4 py-2.5 text-xs font-semibold text-[#20243A] transition-colors hover:bg-[#F3F4F8]"
            >
              <QrCode className="h-4 w-4 text-[#5146D8]" />
              <span>Join Class via QR</span>
            </Link>
            <Link
              to="/student/report-cards"
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2]"
            >
              <FileText className="h-4 w-4" />
              <span>View Report Cards</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Latest Published Result"
          value={latestReportCard ? `${latestReportCard.percentage.toFixed(1)}%` : 'Pending'}
          sublabel={
            latestReportCard
              ? `Sem ${latestReportCard.semester} · ${latestReportCard.total_obtained}/${latestReportCard.total_max_marks} marks`
              : 'No published semester yet'
          }
          icon={<Award className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Latest Grade & Standing"
          value={latestReportCard ? latestReportCard.grade : '—'}
          sublabel={latestReportCard ? latestReportCard.result_status : 'Awaiting release'}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Published Semesters"
          value={history.length}
          sublabel="Permanent verified archive"
          icon={<BookOpenCheck className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Active In-Progress Classes"
          value={pendingClasses.length}
          sublabel="Results released atomically"
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
        />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Historical Trend Chart */}
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-bold text-[#20243A]">
                Published Academic Performance
              </h2>
              <p className="mt-0.5 text-xs text-[#777D91]">
                Verified semester percentages across your permanent record
              </p>
            </div>
            <Link
              to="/student/insights"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5146D8] hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Open AI Insights</span>
            </Link>
          </div>

          {chartData.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#D6D8E4] bg-[#F8F9FC] p-8 text-center">
              <p className="text-sm font-medium text-[#20243A]">No published semesters yet</p>
              <p className="mt-1 text-xs text-[#777D91]">
                Your performance chart will populate automatically once your HOD publishes official semester results.
              </p>
            </div>
          ) : (
            <div className="mt-6 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="studentPerfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5146D8" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#5146D8" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E5ED" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#777D91', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#777D91', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E4E5ED',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown) => [`${Number(val).toFixed(2)}%`, 'Percentage']}
                  />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="#5146D8"
                    strokeWidth={2.5}
                    fill="url(#studentPerfFill)"
                    dot={{ r: 4, fill: '#5146D8', strokeWidth: 2, stroke: '#FFFFFF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Active Unpublished Classes (ZERO partial marks shown) */}
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-base font-bold text-[#20243A]">
                Ongoing Semester Status
              </h2>
              <p className="mt-0.5 text-xs text-[#777D91]">
                Marks stay private until all subjects are locked &amp; published
              </p>
            </div>
            <Link
              to="/student/result-status"
              className="text-xs font-semibold text-[#5146D8] hover:underline"
            >
              Details
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {pendingClasses.length === 0 ? (
              <div className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-5 text-center">
                <p className="text-xs font-medium text-[#20243A]">No pending unpublished classes</p>
                <p className="mt-1 text-xs text-[#777D91]">
                  Have a new semester QR code from your HOD? Join the class to track publication.
                </p>
                <Link
                  to="/student/join-class"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#5146D8] hover:underline"
                >
                  <span>Join Class via QR / Code</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              pendingClasses.map((cls) => {
                const pct =
                  cls.total_subjects > 0
                    ? Math.round((cls.locked_subjects / cls.total_subjects) * 100)
                    : 0;
                return (
                  <div
                    key={cls.id}
                    className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#20243A]">{cls.name}</p>
                        <p className="text-xs text-[#777D91]">
                          {cls.academic_year} · Sem {cls.semester} Div {cls.division}
                        </p>
                      </div>
                      <StatusBadge status="AWAITING_ALL_SUBJECTS" />
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#777D91]">Subject lock progress</span>
                        <span className="font-mono font-semibold text-[#20243A] tabular-nums">
                          {cls.locked_subjects}/{cls.total_subjects} finalized
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E4E5ED]">
                        <div
                          className="h-full rounded-full bg-[#5146D8] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#E4E5ED] bg-[#EFECFF]/45 p-3.5 text-xs text-[#454A63]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5146D8]" />
            <span>
              Your academic records are strictly private. Only your authenticated account can access your verified report cards.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================= 2. JOIN CLASS VIA QR / CODE ========================= */
interface InviteLookupResult {
  classInfo: {
    id: string;
    class_id: string;
    token: string;
    class_name: string;
    class_code: string;
    academic_year: string;
    semester: number;
    division: string;
    batch: string;
    department_name: string;
    college: string;
    expires_at: string;
  };
  rosterStatus: {
    inRoster: boolean;
    alreadyEnrolled: boolean;
    existingRequestStatus: string | null;
  };
}

interface EnrollmentRequestItem {
  id: string;
  status: string;
  created_at: string;
  decided_at: string | null;
  class_id: string;
  class_name: string;
  academic_year: string;
  semester: number;
  division: string;
  department_name: string;
}

export function StudentJoinClassPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [codeInput, setCodeInput] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState<InviteLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { data: requestsData, isLoading: reqLoading } = useQuery({
    queryKey: ['student-enrollment-requests'],
    queryFn: () => apiRequest<{ requests: EnrollmentRequestItem[] }>('/api/student/enrollment-requests'),
  });

  const lookupMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest<InviteLookupResult>(`/api/student/invitations/lookup?code=${encodeURIComponent(code)}`),
    onSuccess: (res) => {
      setLookupError(null);
      setLookupResult(res);
    },
    onError: (err: unknown) => {
      setLookupResult(null);
      setLookupError(err instanceof Error ? err.message : 'Unable to find invitation code.');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (inviteCode: string) =>
      apiRequest<{ status: string; className: string; message: string }>('/api/student/join-class', {
        method: 'POST',
        body: { inviteCode },
      }),
    onSuccess: (res) => {
      toast('success', 'Enrollment Request Submitted', res.message);
      setLookupResult(null);
      setCodeInput('');
      queryClient.invalidateQueries({ queryKey: ['student-enrollment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
    onError: (err: unknown) => {
      toast('error', 'Enrollment request blocked', err instanceof Error ? err.message : undefined);
    },
  });

  const handleLookup = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!codeInput.trim()) return;
    lookupMutation.mutate(codeInput.trim());
  };

  const handleScan = (decodedText: string) => {
    setCodeInput(decodedText);
    lookupMutation.mutate(decodedText);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Join Class via QR / Code"
        description="Scan your HOD's class invitation QR code or paste the invite link/code to verify your roster slot and request enrollment."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Invite Lookup Card */}
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-base font-bold text-[#20243A]">
              Class Invitation Verification
            </h2>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#EFECFF] px-3.5 py-2 text-xs font-semibold text-[#5146D8] transition-colors hover:bg-[#E2DCFF]"
            >
              <QrCode className="h-4 w-4" />
              <span>Scan QR Code</span>
            </button>
          </div>

          <form onSubmit={handleLookup} className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-[#777D91]">
              Invitation Code or Full Join Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="e.g. GIT-CE4A-2026 or https://.../join/GIT-CE4A-2026"
                className="w-full rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2.5 font-mono text-sm text-[#20243A] outline-none focus:border-[#5146D8]"
              />
              <button
                type="submit"
                disabled={lookupMutation.isPending || !codeInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2] disabled:opacity-50 whitespace-nowrap"
              >
                <Search className="h-3.5 w-3.5" />
                <span>{lookupMutation.isPending ? 'Checking...' : 'Verify'}</span>
              </button>
            </div>
            <p className="text-xs text-[#777D91]">
              Demo class codes: <span className="font-mono text-[#20243A]">GIT-CE4A-2026</span> or{' '}
              <span className="font-mono text-[#20243A]">GIT-CE4B-2026</span>
            </p>
          </form>

          {lookupError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D95364]/30 bg-[#D95364]/8 p-3.5 text-xs text-[#20243A]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D95364]" />
              <span>{lookupError}</span>
            </div>
          )}

          {lookupResult && (
            <div className="mt-5 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-[#5146D8]">
                    {lookupResult.classInfo.class_code}
                  </p>
                  <h3 className="font-heading text-base font-bold text-[#20243A]">
                    {lookupResult.classInfo.class_name}
                  </h3>
                  <p className="text-xs text-[#777D91]">
                    {lookupResult.classInfo.department_name} · {lookupResult.classInfo.academic_year} ·
                    Sem {lookupResult.classInfo.semester} Div {lookupResult.classInfo.division}
                  </p>
                </div>
                {lookupResult.rosterStatus.alreadyEnrolled ? (
                  <StatusBadge status="APPROVED" />
                ) : lookupResult.rosterStatus.existingRequestStatus ? (
                  <StatusBadge status={lookupResult.rosterStatus.existingRequestStatus} />
                ) : lookupResult.rosterStatus.inRoster ? (
                  <StatusBadge status="READY" />
                ) : (
                  <StatusBadge status="REJECTED" />
                )}
              </div>

              {lookupResult.rosterStatus.alreadyEnrolled ? (
                <p className="text-xs font-medium text-[#21966B]">
                  You are already officially enrolled in this class.
                </p>
              ) : !lookupResult.rosterStatus.inRoster ? (
                <p className="text-xs font-medium text-[#D95364]">
                  Your enrollment number is not listed on the HOD-uploaded roster for this class. Please contact your department HOD.
                </p>
              ) : lookupResult.rosterStatus.existingRequestStatus === 'PENDING' ? (
                <p className="text-xs font-medium text-[#D99A32]">
                  Your enrollment request is already pending HOD verification.
                </p>
              ) : (
                <div className="pt-1">
                  <p className="mb-3 text-xs text-[#454A63]">
                    Your enrollment number matches the authorized class roster. Submit your enrollment request for HOD approval.
                  </p>
                  <button
                    type="button"
                    disabled={joinMutation.isPending}
                    onClick={() => joinMutation.mutate(lookupResult.classInfo.token)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {joinMutation.isPending ? 'Submitting...' : 'Submit Enrollment Request'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enrollment Request History */}
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-6">
          <h2 className="font-heading text-base font-bold text-[#20243A]">
            My Enrollment Requests
          </h2>
          <p className="mt-0.5 text-xs text-[#777D91]">
            Status of class enrollment requests submitted via QR or invitation code
          </p>

          <div className="mt-4">
            {reqLoading ? (
              <TableSkeleton rows={3} />
            ) : !requestsData || requestsData.requests.length === 0 ? (
              <EmptyState
                icon={<QrCode className="h-5 w-5" />}
                title="No enrollment requests yet"
                description="Use an invitation QR code or token from your HOD to join an active semester class."
              />
            ) : (
              <div className="divide-y divide-[#E4E5ED] rounded-xl border border-[#E4E5ED]">
                {requestsData.requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">{req.class_name}</p>
                      <p className="text-xs text-[#777D91]">
                        {req.department_name} · {req.academic_year} · Sem {req.semester} Div {req.division}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[#777D91]">
                        Requested {format(new Date(req.created_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScan}
      />
    </div>
  );
}

/* ========================= 3. RESULT STATUS (ZERO PARTIAL LEAKAGE) ========================= */
interface ClassResultStatus {
  classId: string;
  className: string;
  classCode: string;
  departmentName: string;
  academicYear: string;
  semester: number;
  division: string;
  isPublished: boolean;
  statusLabel: string;
  publishedAt: string | null;
  reportCardId: string | null;
  totalSubjects: number;
  lockedSubjects: number;
  progressPercent: number;
  subjectsProgress: Array<{
    code: string;
    name: string;
    status: string;
  }>;
}

export function ResultStatusPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-result-status'],
    queryFn: () => apiRequest<{ statuses: ClassResultStatus[] }>('/api/student/result-status'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Status"
        description="Synchronized publication status for your enrolled classes. Individual subject marks remain hidden until every subject is locked and published by the HOD."
      />

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !data || data.statuses.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="No enrolled classes yet"
          description="Once your HOD approves your class enrollment, you can monitor subject finalization and official result publication here."
          action={
            <Link
              to="/student/join-class"
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4237C2]"
            >
              <QrCode className="h-4 w-4" />
              <span>Join Class via QR</span>
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {data.statuses.map((cls) => (
            <div
              key={cls.classId}
              className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-[#E4E5ED] bg-[#F8F9FC] px-6 py-5 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-[#5146D8]">
                      {cls.classCode}
                    </span>
                    <StatusBadge status={cls.isPublished ? 'PUBLISHED' : 'AWAITING_ALL_SUBJECTS'} />
                  </div>
                  <h2 className="mt-1 font-heading text-lg font-bold text-[#20243A]">
                    {cls.className}
                  </h2>
                  <p className="text-xs text-[#777D91]">
                    {cls.departmentName} · {cls.academicYear} · Semester {cls.semester} Div {cls.division}
                  </p>
                </div>

                {cls.isPublished && cls.reportCardId ? (
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {cls.publishedAt && (
                      <span className="text-xs text-[#777D91]">
                        Published {format(new Date(cls.publishedAt), 'dd MMM yyyy, hh:mm a')}
                      </span>
                    )}
                    <Link
                      to={`/student/report-cards?id=${cls.reportCardId}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#21966B] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1A7D58]"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Open Official Report Card</span>
                    </Link>
                  </div>
                ) : (
                  <div className="min-w-[200px]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#777D91]">Finalization Progress</span>
                      <span className="font-mono font-bold text-[#20243A] tabular-nums">
                        {cls.lockedSubjects}/{cls.totalSubjects} ({cls.progressPercent}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E4E5ED]">
                      <div
                        className="h-full rounded-full bg-[#5146D8]"
                        style={{ width: `${cls.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6">
                {!cls.isPublished && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#D99A32]/30 bg-[#D99A32]/8 p-3.5 text-xs text-[#20243A]">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#D99A32]" />
                    <span>
                      <strong>AWAITING ALL SUBJECTS:</strong> Partial marks, subject averages, grades,
                      and rankings are withheld until all faculty lock their subjects and the HOD
                      executes atomic publication.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cls.subjectsProgress.map((sp) => (
                    <div
                      key={sp.code}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#E4E5ED] bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-[#5146D8]">{sp.code}</p>
                        <p className="truncate text-xs font-medium text-[#20243A]">{sp.name}</p>
                      </div>
                      <StatusBadge status={sp.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

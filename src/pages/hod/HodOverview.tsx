import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Building2,
  Users,
  BookOpenCheck,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  QrCode,
  FileCheck2,
  ArrowRight,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { PageHeader, StatCard, StatusBadge, TableSkeleton } from '../../components/ui/CommonUi';

interface HodDashboardResponse {
  stats: {
    totalClasses: number;
    totalStudents: number;
    totalProfessors: number;
    subjectsPending: number;
    resultsPublished: number;
    pendingApprovals: number;
    pendingSubjectRequests: number;
    pendingEnrollmentRequests: number;
  };
  classesSummary: Array<{
    id: string;
    class_code: string;
    name: string;
    academic_year: string;
    semester: number;
    division: string;
    batch: string;
    is_published: number;
    department_name: string;
    total_subjects: number;
    locked_subjects: number;
    enrolled_students: number;
    roster_count: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    actor_name: string;
    actor_role: string;
    details: string | null;
    student_enrollment: string | null;
    created_at: string;
  }>;
}

export function HodOverview() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hod-dashboard'],
    queryFn: () => apiRequest<HodDashboardResponse>('/api/hod/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="HOD Overview" description="Loading department metrics..." />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[#D95364]/25 bg-white p-6 text-center">
        <p className="text-sm font-medium text-[#D95364]">
          {error instanceof Error ? error.message : 'Unable to load dashboard.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const { stats, classesSummary, recentActivity } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Overview"
        description="Real-time governance across classes, faculty lock status, enrollment requests, and official result publications."
        actions={
          <>
            <Link
              to="/hod/create-class"
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2]"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Class</span>
            </Link>
            <Link
              to="/hod/publish-results"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5ED] bg-white px-4 py-2.5 text-xs font-semibold text-[#20243A] transition-colors hover:bg-[#F8F9FC]"
            >
              <FileCheck2 className="h-4 w-4 text-[#21966B]" />
              <span>Publish Results</span>
            </Link>
          </>
        }
      />

      {/* 6 Real Database Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Classes"
          value={stats.totalClasses}
          sublabel="Active & historical academic cohorts"
          icon={<Building2 className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Registered Students"
          value={stats.totalStudents}
          sublabel="Verified student accounts"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Department Professors"
          value={stats.totalProfessors}
          sublabel="Authorized faculty members"
          icon={<BookOpenCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Subjects Pending Submission"
          value={stats.subjectsPending}
          sublabel="Awaiting faculty lock in active classes"
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Results Published"
          value={stats.resultsPublished}
          sublabel="Verified official publication releases"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Pending Approval Requests"
          value={stats.pendingApprovals}
          sublabel={`${stats.pendingSubjectRequests} faculty · ${stats.pendingEnrollmentRequests} student`}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone={stats.pendingApprovals > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          to="/hod/qr-invitations"
          className="flex items-center justify-between rounded-2xl border border-[#E4E5ED] bg-white px-4 py-3.5 text-sm font-medium text-[#20243A] transition-colors hover:border-[#5146D8]/40"
        >
          <span className="flex items-center gap-2.5">
            <QrCode className="h-4 w-4 text-[#5146D8]" />
            <span>Manage QR &amp; Invitations</span>
          </span>
          <ArrowRight className="h-4 w-4 text-[#777D91]" />
        </Link>
        <Link
          to="/hod/subject-permissions"
          className="flex items-center justify-between rounded-2xl border border-[#E4E5ED] bg-white px-4 py-3.5 text-sm font-medium text-[#20243A] transition-colors hover:border-[#5146D8]/40"
        >
          <span className="flex items-center gap-2.5">
            <BookOpenCheck className="h-4 w-4 text-[#4387D9]" />
            <span>Faculty Subject Requests ({stats.pendingSubjectRequests})</span>
          </span>
          <ArrowRight className="h-4 w-4 text-[#777D91]" />
        </Link>
        <Link
          to="/hod/enrollment-requests"
          className="flex items-center justify-between rounded-2xl border border-[#E4E5ED] bg-white px-4 py-3.5 text-sm font-medium text-[#20243A] transition-colors hover:border-[#5146D8]/40"
        >
          <span className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-[#21966B]" />
            <span>Student Enrollments ({stats.pendingEnrollmentRequests})</span>
          </span>
          <ArrowRight className="h-4 w-4 text-[#777D91]" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Classes Lock Progress Table */}
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#E4E5ED] px-5 py-4">
            <h2 className="font-heading text-base font-bold text-[#20243A]">
              Classes &amp; Lock Readiness
            </h2>
            <Link to="/hod/lock-tracker" className="text-xs font-semibold text-[#5146D8] hover:underline">
              Open Lock Tracker
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                <tr>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Subjects Locked</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E5ED]">
                {classesSummary.map((cls) => {
                  const pct =
                    cls.total_subjects > 0
                      ? Math.round((cls.locked_subjects / cls.total_subjects) * 100)
                      : 0;
                  const ready = cls.is_published === 0 && cls.total_subjects > 0 && cls.locked_subjects === cls.total_subjects;
                  return (
                    <tr key={cls.id} className="hover:bg-[#F8F9FC]">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[#20243A]">{cls.name}</p>
                        <p className="text-xs text-[#777D91]">
                          {cls.academic_year} · Sem {cls.semester} · Div {cls.division}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-[#20243A]">
                        {cls.enrolled_students} / {cls.roster_count}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#E9EAF2]">
                            <div
                              className="h-full rounded-full bg-[#5146D8]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-[#777D91]">
                            {cls.locked_subjects}/{cls.total_subjects}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StatusBadge
                          status={cls.is_published === 1 ? 'PUBLISHED' : ready ? 'READY' : 'IN_PROGRESS'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Activity */}
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#E4E5ED] px-5 py-4">
            <h2 className="font-heading text-base font-bold text-[#20243A]">Recent Activity</h2>
            <Link to="/hod/audit-logs" className="text-xs font-semibold text-[#5146D8] hover:underline">
              Full Audit Log
            </Link>
          </div>
          <div className="divide-y divide-[#E4E5ED]">
            {recentActivity.map((act) => (
              <div key={act.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#20243A]">{act.actor_name}</span>
                  <span className="text-[#777D91]">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#5A6078]">
                  {act.details || act.action}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

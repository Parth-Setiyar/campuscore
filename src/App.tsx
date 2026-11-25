import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  PlusCircle,
  BookOpen,
  QrCode,
  UserCheck,
  Users,
  Lock,
  ShieldCheck,
  History,
  Bell,
  User,
  FileSpreadsheet,
  Sparkles,
  Award,
  Archive,
  Clock,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { DashboardLayout, type NavItemConfig } from './layouts/DashboardLayout';
import { apiRequest } from './services/api';
import type { UserRole } from './types';

// Public & Auth Pages
import { LandingPage } from './pages/LandingPage';
import { RoleLoginPage, StudentInviteRegisterPage } from './pages/auth/RoleLoginPage';

// Common Pages
import { NotificationsPage } from './pages/common/NotificationsPage';
import { ProfilePage } from './pages/common/ProfilePage';

// HOD Pages
import { HodOverview } from './pages/hod/HodOverview';
import { CreateClassPage } from './pages/hod/CreateClassPage';
import { ManageClassesPage } from './pages/hod/ManageClassesPage';
import { QrInvitationsPage } from './pages/hod/QrInvitationsPage';
import {
  SubjectPermissionsPage,
  EnrollmentRequestsPage,
  SubjectLockTrackerPage,
} from './pages/hod/ApprovalsAndTrackerPages';
import { PublishResultsPage, AuditLogsPage } from './pages/hod/PublishAndAuditPages';

// Professor Pages
import {
  ProfessorOverview,
  ProfessorJoinClassPage,
  ProfessorMyClassesPage,
  ProfessorArchivePage,
} from './pages/professor/ProfessorClassesPages';
import { MarksEntryPage } from './pages/professor/MarksEntryPage';
import { ExcelImportPage } from './pages/professor/ExcelImportPage';
import { AiRemarksPage, LockSubmitPage } from './pages/professor/AiRemarksAndLockPages';

// Student Pages
import {
  StudentOverview,
  StudentJoinClassPage,
  ResultStatusPage,
} from './pages/student/StudentDashboardPages';
import {
  MyReportCardsPage,
  PreviousSemestersPage,
  AiInsightsPage,
} from './pages/student/StudentReportsAndInsightsPages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function roleHomePath(role: UserRole): string {
  if (role === 'HOD') return '/hod';
  if (role === 'PROFESSOR') return '/professor';
  return '/student';
}

function roleLoginPath(role: UserRole): string {
  if (role === 'HOD') return '/login/hod';
  if (role === 'PROFESSOR') return '/login/professor';
  return '/login/student';
}

function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to={roleLoginPath(role)} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return <>{children}</>;
}

function HodShell() {
  const { data } = useQuery({
    queryKey: ['hod-dashboard'],
    queryFn: () =>
      apiRequest<{
        stats: {
          pendingSubjectRequests: number;
          pendingEnrollmentRequests: number;
        };
      }>('/api/hod/dashboard'),
  });

  const navItems: NavItemConfig[] = [
    { label: 'Dashboard Overview', to: '/hod', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Create New Class', to: '/hod/create-class', icon: <PlusCircle className="h-4 w-4" /> },
    { label: 'Manage Classes', to: '/hod/classes', icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Class QR & Invitations', to: '/hod/invitations', icon: <QrCode className="h-4 w-4" /> },
    {
      label: 'Subject Permissions',
      to: '/hod/subject-permissions',
      icon: <UserCheck className="h-4 w-4" />,
      badgeCount: data?.stats.pendingSubjectRequests ?? 0,
    },
    {
      label: 'Enrollment Requests',
      to: '/hod/enrollment-requests',
      icon: <Users className="h-4 w-4" />,
      badgeCount: data?.stats.pendingEnrollmentRequests ?? 0,
    },
    { label: 'Subject Lock Tracker', to: '/hod/lock-tracker', icon: <Lock className="h-4 w-4" /> },
    {
      label: 'Verify & Publish Result',
      to: '/hod/publish',
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    { label: 'Audit Logs', to: '/hod/audit-logs', icon: <History className="h-4 w-4" /> },
    { label: 'Notifications', to: '/hod/notifications', icon: <Bell className="h-4 w-4" /> },
    { label: 'Profile', to: '/hod/profile', icon: <User className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout
      roleLabel="HOD / Admin Portal"
      navItems={navItems}
      notificationsPath="/hod/notifications"
      profilePath="/hod/profile"
    />
  );
}

function ProfessorShell() {
  const navItems: NavItemConfig[] = [
    {
      label: 'Dashboard Overview',
      to: '/professor',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: 'Join Class via QR / Code',
      to: '/professor/join-class',
      icon: <QrCode className="h-4 w-4" />,
    },
    {
      label: 'My Assigned Classes',
      to: '/professor/classes',
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      label: 'Marks Entry & Topper',
      to: '/professor/marks',
      icon: <Award className="h-4 w-4" />,
    },
    {
      label: 'Import Marks (Excel)',
      to: '/professor/import',
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      label: 'AI Academic Remarks',
      to: '/professor/remarks',
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      label: 'Lock & Submit Subject',
      to: '/professor/lock',
      icon: <Lock className="h-4 w-4" />,
    },
    {
      label: 'Past Semesters Archive',
      to: '/professor/archive',
      icon: <Archive className="h-4 w-4" />,
    },
    {
      label: 'Notifications',
      to: '/professor/notifications',
      icon: <Bell className="h-4 w-4" />,
    },
    { label: 'Profile', to: '/professor/profile', icon: <User className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout
      roleLabel="Professor Workspace"
      navItems={navItems}
      notificationsPath="/professor/notifications"
      profilePath="/professor/profile"
    />
  );
}

function StudentShell() {
  const navItems: NavItemConfig[] = [
    {
      label: 'Dashboard Overview',
      to: '/student',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: 'Join Class via QR / Code',
      to: '/student/join-class',
      icon: <QrCode className="h-4 w-4" />,
    },
    {
      label: 'Result Status',
      to: '/student/result-status',
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: 'My Report Cards',
      to: '/student/report-cards',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: 'Previous Semesters',
      to: '/student/previous-semesters',
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      label: 'AI Performance Insights',
      to: '/student/insights',
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      label: 'Notifications',
      to: '/student/notifications',
      icon: <Bell className="h-4 w-4" />,
    },
    { label: 'Profile', to: '/student/profile', icon: <User className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout
      roleLabel="Student Portal"
      navItems={navItems}
      notificationsPath="/student/notifications"
      profilePath="/student/profile"
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* Public Landing & Role Auth */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login/hod" element={<RoleLoginPage role="HOD" />} />
              <Route path="/login/professor" element={<RoleLoginPage role="PROFESSOR" />} />
              <Route path="/login/student" element={<RoleLoginPage role="STUDENT" />} />
              <Route path="/register/student" element={<StudentInviteRegisterPage />} />
              <Route path="/join/:token" element={<StudentInviteRegisterPage />} />

              {/* HOD / Administrator Workspace */}
              <Route
                path="/hod"
                element={
                  <RequireRole role="HOD">
                    <HodShell />
                  </RequireRole>
                }
              >
                <Route index element={<HodOverview />} />
                <Route path="create-class" element={<CreateClassPage />} />
                <Route path="classes" element={<ManageClassesPage />} />
                <Route path="invitations" element={<QrInvitationsPage />} />
                <Route path="subject-permissions" element={<SubjectPermissionsPage />} />
                <Route path="enrollment-requests" element={<EnrollmentRequestsPage />} />
                <Route path="lock-tracker" element={<SubjectLockTrackerPage />} />
                <Route path="publish" element={<PublishResultsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Professor Workspace */}
              <Route
                path="/professor"
                element={
                  <RequireRole role="PROFESSOR">
                    <ProfessorShell />
                  </RequireRole>
                }
              >
                <Route index element={<ProfessorOverview />} />
                <Route path="join-class" element={<ProfessorJoinClassPage />} />
                <Route path="classes" element={<ProfessorMyClassesPage />} />
                <Route path="marks" element={<MarksEntryPage />} />
                <Route path="import" element={<ExcelImportPage />} />
                <Route path="remarks" element={<AiRemarksPage />} />
                <Route path="lock" element={<LockSubmitPage />} />
                <Route path="archive" element={<ProfessorArchivePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Student Workspace */}
              <Route
                path="/student"
                element={
                  <RequireRole role="STUDENT">
                    <StudentShell />
                  </RequireRole>
                }
              >
                <Route index element={<StudentOverview />} />
                <Route path="join-class" element={<StudentJoinClassPage />} />
                <Route path="result-status" element={<ResultStatusPage />} />
                <Route path="report-cards" element={<MyReportCardsPage />} />
                <Route path="previous-semesters" element={<PreviousSemestersPage />} />
                <Route path="insights" element={<AiInsightsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

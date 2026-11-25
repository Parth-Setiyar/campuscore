import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ShieldUser,
  BookOpenCheck,
  GraduationCap,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  KeyRound,
  QrCode,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../services/api';
import { BrandLogo } from '../../components/ui/CommonUi';
import type { UserRole } from '../../types';

const loginSchema = z.object({
  identifier: z.string().trim().min(2, 'This field is required.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ROLE_CONFIG: Record<
  UserRole,
  {
    title: string;
    subtitle: string;
    idLabel: string;
    idPlaceholder: string;
    icon: typeof ShieldUser;
    accentClass: string;
    dashboardPath: string;
    demoAccounts: Array<{ label: string; id: string; password: string }>;
  }
> = {
  HOD: {
    title: 'HOD / Administrator Login',
    subtitle: 'Manage department classes, faculty authorizations, subject locking, and official result publication.',
    idLabel: 'HOD ID or Institutional Email',
    idPlaceholder: 'HOD-CE-001 or hod.ce@git-demo.edu',
    icon: ShieldUser,
    accentClass: 'bg-[#EFECFF] text-[#5146D8]',
    dashboardPath: '/hod',
    demoAccounts: [
      { label: 'Dr. Vikram Patel (CE HOD)', id: 'HOD-CE-001', password: 'Hod@2026!' },
    ],
  },
  PROFESSOR: {
    title: 'Professor Portal Login',
    subtitle: 'Access your authorized subjects, enter or import student marks, and submit verified evaluations.',
    idLabel: 'Faculty ID or Institutional Email',
    idPlaceholder: 'FAC-CE-101 or ananya.sharma@git-demo.edu',
    icon: BookOpenCheck,
    accentClass: 'bg-[#4387D9]/12 text-[#4387D9]',
    dashboardPath: '/professor',
    demoAccounts: [
      { label: 'Prof. Ananya Sharma (CE401 Locked)', id: 'FAC-CE-101', password: 'Prof@2026!' },
      { label: 'Prof. Rajesh Mehta (CE402 In Progress)', id: 'FAC-CE-102', password: 'Prof@2026!' },
      { label: 'Prof. Sneha Desai (CE403 Pending)', id: 'FAC-CE-103', password: 'Prof@2026!' },
    ],
  },
  STUDENT: {
    title: 'Student Portal Login',
    subtitle: 'Access your private published report cards, semester archives, and academic progress insights.',
    idLabel: 'Enrollment Number',
    idPlaceholder: 'GIT23CE001',
    icon: GraduationCap,
    accentClass: 'bg-[#21966B]/12 text-[#21966B]',
    dashboardPath: '/student',
    demoAccounts: [
      { label: 'Aarav Shah (Sem 3 Published + Sem 4 Active)', id: 'GIT23CE001', password: 'Student@2026!' },
      { label: 'Diya Trivedi (Sem 3 Distinction)', id: 'GIT23CE002', password: 'Student@2026!' },
    ],
  },
};

export function RoleLoginPage({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  const navigate = useNavigate();
  const { loginHod, loginProfessor, loginStudent, sessionExpiredNotice, clearSessionNotice } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    clearSessionNotice();
    try {
      if (role === 'HOD') {
        await loginHod(values.identifier, values.password);
      } else if (role === 'PROFESSOR') {
        await loginProfessor(values.identifier, values.password);
      } else {
        await loginStudent(values.identifier, values.password);
      }
      toast('success', 'Signed in successfully');
      navigate(cfg.dashboardPath, { replace: true });
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F8]">
      <header className="border-b border-[#E4E5ED] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <BrandLogo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A6078] hover:text-[#20243A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        {sessionExpiredNotice && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#D99A32]/30 bg-[#D99A32]/10 p-3.5 text-xs text-[#20243A]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D99A32]" />
            <span>{sessionExpiredNotice}</span>
          </div>
        )}

        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 shadow-xs sm:p-8">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cfg.accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-heading text-xl font-bold text-[#20243A]">{cfg.title}</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#777D91]">{cfg.subtitle}</p>

          {serverError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D95364]/25 bg-[#D95364]/8 p-3 text-xs text-[#D95364]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#20243A]">{cfg.idLabel}</label>
              <input
                type="text"
                autoComplete="username"
                placeholder={cfg.idPlaceholder}
                {...register('identifier')}
                className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2.5 text-sm text-[#20243A] outline-none transition-colors focus:border-[#5146D8] focus:ring-2 focus:ring-[#5146D8]/15"
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-[#D95364]">{errors.identifier.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#20243A]">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className="w-full rounded-xl border border-[#E4E5ED] bg-white py-2.5 pl-3.5 pr-10 text-sm text-[#20243A] outline-none transition-colors focus:border-[#5146D8] focus:ring-2 focus:ring-[#5146D8]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#777D91] hover:text-[#20243A]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-[#D95364]">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#5146D8] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4237C2] disabled:opacity-60"
            >
              {isSubmitting ? 'Verifying Credentials...' : `Sign In to ${role} Portal`}
            </button>
          </form>

          {role === 'STUDENT' && (
            <div className="mt-5 border-t border-[#E4E5ED] pt-4 text-center text-xs text-[#777D91]">
              New student with a class invitation?{' '}
              <Link to="/register/student" className="font-semibold text-[#5146D8] hover:underline">
                Establish credentials via Invite Code
              </Link>
            </div>
          )}

          {role === 'HOD' && (
            <p className="mt-5 border-t border-[#E4E5ED] pt-4 text-xs text-[#777D91]">
              HOD accounts are provisioned securely by the institution and cannot be self-registered.
            </p>
          )}
        </div>

        {/* Clearly Labeled Demo Credentials Helper */}
        <div className="mt-5 rounded-2xl border border-[#E4E5ED] bg-[#FFFFFF] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#20243A]">
            <KeyRound className="h-3.5 w-3.5 text-[#5146D8]" />
            <span>Demo Environment — Gujarat Institute of Technology</span>
          </div>
          <p className="mt-1 text-[11px] text-[#777D91]">
            Click a demo account below to prefill credentials for evaluation:
          </p>
          <div className="mt-2.5 space-y-1.5">
            {cfg.demoAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  setValue('identifier', acc.id, { shouldValidate: true });
                  setValue('password', acc.password, { shouldValidate: true });
                  setServerError(null);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3 py-2 text-left text-xs transition-colors hover:border-[#5146D8]/40 hover:bg-[#EFECFF]/40"
              >
                <span className="font-medium text-[#20243A]">{acc.label}</span>
                <span className="font-mono text-[11px] text-[#5146D8]">{acc.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Role Switcher */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[#777D91]">
          {role !== 'HOD' && (
            <Link to="/login/hod" className="hover:text-[#5146D8]">
              HOD Login
            </Link>
          )}
          {role !== 'PROFESSOR' && (
            <Link to="/login/professor" className="hover:text-[#5146D8]">
              Professor Login
            </Link>
          )}
          {role !== 'STUDENT' && (
            <Link to="/login/student" className="hover:text-[#5146D8]">
              Student Login
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

const registerInviteSchema = z
  .object({
    token: z.string().trim().min(4, 'Invitation code is required.'),
    enrollmentNumber: z.string().trim().min(3, 'Enrollment number is required.'),
    fullName: z.string().trim().min(2, 'Full name is required.'),
    email: z.string().trim().email('Valid institutional email is required.'),
    phone: z.string().trim().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(8, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type RegisterInviteValues = z.infer<typeof registerInviteSchema>;

export function StudentInviteRegisterPage() {
  const { token: urlToken } = useParams();
  const navigate = useNavigate();
  const { registerStudentViaInvite } = useAuth();
  const { toast } = useToast();

  const [inviteInfo, setInviteInfo] = useState<{
    className: string;
    departmentName: string;
    academicYear: string;
    semester: number;
    division: string;
    college: string;
  } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInviteValues>({
    resolver: zodResolver(registerInviteSchema),
    defaultValues: { token: urlToken ?? '' },
  });

  const tokenValue = watch('token');

  const verifyInvite = async (code: string) => {
    const clean = code.trim();
    if (clean.length < 4) return;
    setLookupError(null);
    try {
      const info = await apiRequest<{
        className: string;
        departmentName: string;
        academicYear: string;
        semester: number;
        division: string;
        college: string;
      }>(`/api/auth/invite-info/${encodeURIComponent(clean)}`, { skipAuth: true });
      setInviteInfo(info);
    } catch (err: unknown) {
      setInviteInfo(null);
      setLookupError(err instanceof Error ? err.message : 'Invalid invitation code.');
    }
  };

  useEffect(() => {
    if (urlToken) {
      setValue('token', urlToken);
      verifyInvite(urlToken);
    }
  }, [urlToken, setValue]);

  const onSubmit = async (values: RegisterInviteValues) => {
    setSubmitError(null);
    try {
      const res = await registerStudentViaInvite({
        token: values.token,
        enrollmentNumber: values.enrollmentNumber,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
      toast(
        'success',
        'Credentials created & enrollment requested',
        `Your request for ${res.className} is pending HOD approval.`
      );
      navigate('/student', { replace: true });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F8]">
      <header className="border-b border-[#E4E5ED] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <BrandLogo />
          </Link>
          <Link
            to="/login/student"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A6078] hover:text-[#20243A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Already Registered? Student Login</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 shadow-xs sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFECFF] text-[#5146D8]">
            <QrCode className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-heading text-xl font-bold text-[#20243A]">
            Student Invitation Registration
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#777D91]">
            Verify your class invitation code and roster-approved enrollment number to establish
            secure login credentials.
          </p>

          {submitError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D95364]/25 bg-[#D95364]/8 p-3 text-xs text-[#D95364]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#20243A]">
                Class Invitation Code
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. GIT-CE4A-2026"
                  {...register('token')}
                  className="flex-1 rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2.5 font-mono text-sm uppercase text-[#20243A] outline-none focus:border-[#5146D8]"
                />
                <button
                  type="button"
                  onClick={() => verifyInvite(tokenValue)}
                  className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-4 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#EFECFF] hover:text-[#5146D8]"
                >
                  Verify Code
                </button>
              </div>
              {errors.token && <p className="mt-1 text-xs text-[#D95364]">{errors.token.message}</p>}
              {lookupError && <p className="mt-1 text-xs text-[#D95364]">{lookupError}</p>}
            </div>

            {inviteInfo && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[#21966B]/25 bg-[#21966B]/8 p-3.5 text-xs text-[#20243A]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#21966B]" />
                <div>
                  <p className="font-semibold">{inviteInfo.className}</p>
                  <p className="text-[#5A6078]">
                    {inviteInfo.departmentName} · Semester {inviteInfo.semester} · Div{' '}
                    {inviteInfo.division} ({inviteInfo.academicYear})
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Enrollment Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. GIT23CE010"
                  {...register('enrollmentNumber')}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 font-mono text-sm uppercase outline-none focus:border-[#5146D8]"
                />
                {errors.enrollmentNumber && (
                  <p className="mt-1 text-xs text-[#D95364]">{errors.enrollmentNumber.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Full Name</label>
                <input
                  type="text"
                  placeholder="Kavya Chauhan"
                  {...register('fullName')}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-[#D95364]">{errors.fullName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Institutional Email
                </label>
                <input
                  type="email"
                  placeholder="kavya.chauhan@git-demo.edu"
                  {...register('email')}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
                {errors.email && <p className="mt-1 text-xs text-[#D95364]">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+91 98790 30010"
                  {...register('phone')}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Create Password</label>
                <input
                  type="password"
                  placeholder="Min. 8 characters"
                  {...register('password')}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-[#D95364]">{errors.password.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  {...register('confirmPassword')}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-[#D95364]">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#5146D8] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4237C2] disabled:opacity-60"
            >
              {isSubmitting ? 'Creating Account...' : 'Establish Credentials & Request Enrollment'}
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-3 text-[11px] text-[#777D91]">
            Demo test roster slot: Invite code <span className="font-mono font-semibold text-[#20243A]">GIT-CE4A-2026</span> · Unregistered roster enrollment <span className="font-mono font-semibold text-[#20243A]">GIT23CE010</span>.
          </div>
        </div>
      </main>
    </div>
  );
}

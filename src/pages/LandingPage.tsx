import { Link } from 'react-router-dom';
import {
  ShieldUser,
  BookOpenCheck,
  GraduationCap,
  ArrowRight,
  Lock,
  FileSpreadsheet,
  Sparkles,
  QrCode,
  ShieldCheck,
  FileCheck2,
  History,
  CheckCircle2,
} from 'lucide-react';
import { BrandLogo } from '../components/ui/CommonUi';

const STACKING_PILLARS = [
  {
    index: '01',
    title: 'Zero-Leak Private Student Records',
    summary:
      'Replace public Excel spreadsheets and group chat PDFs with strictly isolated student portals where each learner sees only their own verified report cards.',
    metrics: ['Row-level student ownership checks', 'Zero peer mark visibility', 'Password-protected accounts'],
    accentBg: 'bg-[#FFFFFF]',
    tag: 'Privacy Architecture',
    icon: Lock,
  },
  {
    index: '02',
    title: 'Synchronized Subject Lock & Atomic Release',
    summary:
      'Eliminate fragmented mid-semester leaks. Professors finalize and lock marks independently while the HOD verifies the combined roster and publishes all report cards in a single database transaction.',
    metrics: ['Strict lock-before-publish gate', 'Zero partial result exposure', 'Versioned publication audit'],
    accentBg: 'bg-[#FAF9FF]',
    tag: 'Academic Governance',
    icon: FileCheck2,
  },
  {
    index: '03',
    title: 'QR Invitations & Conflict-Safe Excel Imports',
    summary:
      'Onboard classes in minutes using expiring QR codes validated against the HOD roster. Faculty can upload existing XLSX sheets with column mapping, error flags, and conflict resolution.',
    metrics: ['Roster-verified enrollment', 'SheetJS XLSX & XLS parsing', 'Never silently overwrites marks'],
    accentBg: 'bg-[#F6F9FE]',
    tag: 'Faculty Productivity',
    icon: FileSpreadsheet,
  },
  {
    index: '04',
    title: 'Official PDF Transcripts & AI Performance Insights',
    summary:
      'Students download print-ready institutional PDF report cards, retain access to previous semesters, and combine exact mathematical target calculations with Gemini-assisted study guidance.',
    metrics: ['Unique verifiable Report IDs', 'Multi-semester academic archive', 'Data-grounded Gemini insights'],
    accentBg: 'bg-[#FFFFFF]',
    tag: 'Student Intelligence',
    icon: Sparkles,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F3F4F8] text-[#20243A]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#E4E5ED] bg-[#F3F4F8]/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="whitespace-nowrap shrink-0">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#525870] md:flex">
            <a href="#portals" className="transition-colors hover:text-[#5146D8] whitespace-nowrap shrink-0">
              Portals
            </a>
            <a href="#workflow" className="transition-colors hover:text-[#5146D8] whitespace-nowrap shrink-0">
              Workflow
            </a>
            <a href="#security" className="transition-colors hover:text-[#5146D8] whitespace-nowrap shrink-0">
              Security
            </a>
            <Link to="/register/student" className="transition-colors hover:text-[#5146D8] whitespace-nowrap shrink-0">
              Join Class
            </Link>
          </nav>

          <div className="shrink-0">
            <a
              href="#portals"
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2] whitespace-nowrap shrink-0"
            >
              <span>Access Portal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-semibold tracking-wide text-[#5146D8]">
              Smart College Result &amp; AI Report Card Portal
            </p>
            <h1
              className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-[#20243A] sm:text-5xl"
              style={{ textWrap: 'balance' }}
            >
              Your Academic Journey. One Secure Platform.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#5A6078]">
              Manage results, access report cards and understand academic performance — all in one
              intelligent platform.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#portals"
                className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-5 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#4237C2] whitespace-nowrap"
              >
                <span>Select Your Portal</span>
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/register/student"
                className="inline-flex items-center gap-2 rounded-xl border border-[#D8DAE6] bg-white px-5 py-3 text-sm font-medium text-[#20243A] transition-colors hover:bg-[#F8F9FC] whitespace-nowrap"
              >
                <QrCode className="h-4 w-4 text-[#5146D8]" />
                <span>Have a Class Invite?</span>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E4E5ED] pt-5 text-xs text-[#777D91]">
              <span>Gujarat Institute of Technology — DEMO</span>
              <span aria-hidden="true">·</span>
              <span>Role-Based Access Control</span>
              <span aria-hidden="true">·</span>
              <span>Atomic Publication Engine</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-[#E4E5ED] bg-[#E9EAF2]">
              <img
                src="/src/assets/images/hero_campus_academic_1795590421119.jpg"
                alt="Modern university academic campus building"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#20243A]/85 via-[#20243A]/45 to-transparent p-6 text-white">
                <p className="text-xs font-medium text-white/80">Centralized Institutional Portal</p>
                <p className="mt-1 font-heading text-base font-semibold">
                  Private digital transcripts, synchronized faculty locking, and immutable audit logs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Prominent Role Selection Cards */}
      <section id="portals" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
              Choose Your Institutional Workspace
            </h2>
            <p className="mt-1.5 text-sm text-[#777D91]">
              Dedicated authentication and strict server-side authorization for every academic role.
            </p>
          </div>
          <p className="text-xs text-[#777D91]">
            Demo credentials are available inside each portal login screen.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Card 1: HOD / Administrator */}
          <Link
            to="/login/hod"
            className="group flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-6 transition-all hover:border-[#5146D8]/50 hover:shadow-md hover:shadow-[#5146D8]/6"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EFECFF] text-[#5146D8] transition-colors group-hover:bg-[#5146D8] group-hover:text-white">
                <ShieldUser className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-[#20243A]">
                HOD / Administrator
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5A6078]">
                Manage classes, subjects, faculty and result publication.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[#E4E5ED] pt-4 text-sm font-semibold text-[#5146D8]">
              <span>Sign in as HOD</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 2: Professor */}
          <Link
            to="/login/professor"
            className="group flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-6 transition-all hover:border-[#5146D8]/50 hover:shadow-md hover:shadow-[#5146D8]/6"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4387D9]/12 text-[#4387D9] transition-colors group-hover:bg-[#4387D9] group-hover:text-white">
                <BookOpenCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-[#20243A]">Professor</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5A6078]">
                Submit marks, manage subject records and generate academic remarks.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[#E4E5ED] pt-4 text-sm font-semibold text-[#4387D9]">
              <span>Sign in as Professor</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 3: Student */}
          <Link
            to="/login/student"
            className="group flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-6 transition-all hover:border-[#5146D8]/50 hover:shadow-md hover:shadow-[#5146D8]/6"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#21966B]/12 text-[#21966B] transition-colors group-hover:bg-[#21966B] group-hover:text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-[#20243A]">Student</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5A6078]">
                Access private report cards and track academic progress.
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[#E4E5ED] pt-4 text-sm font-semibold text-[#21966B]">
              <span>Sign in as Student</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      {/* Sticky Stacking Cards Feature Overview ("Deck of Cards" Scroll Effect) */}
      <section id="workflow" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold text-[#5146D8]">Platform Architecture</p>
          <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
            End-to-End Academic Integrity, Layer by Layer
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5A6078]">
            Scroll through the four core operational layers that eliminate public spreadsheets,
            fragmented submissions, and lost semester archives.
          </p>
        </div>

        <div className="relative space-y-6 pb-8">
          {STACKING_PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            const stickyTop = 84 + idx * 20;
            return (
              <div
                key={pillar.index}
                style={{ top: `${stickyTop}px`, zIndex: 10 + idx }}
                className={`sticky rounded-2xl border border-[#E4E5ED] ${pillar.accentBg} p-6 shadow-sm transition-transform duration-200 sm:p-8`}
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-7">
                    <div className="flex items-center gap-3 text-xs font-medium text-[#777D91]">
                      <span className="font-mono font-semibold text-[#5146D8]">{pillar.index}</span>
                      <span aria-hidden="true">·</span>
                      <span>{pillar.tag}</span>
                    </div>
                    <h3 className="mt-2.5 font-heading text-xl font-bold text-[#20243A] sm:text-2xl">
                      {pillar.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#5A6078]">{pillar.summary}</p>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-5">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFECFF] text-[#5146D8]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ul className="space-y-2.5">
                        {pillar.metrics.map((m) => (
                          <li key={m} className="flex items-center gap-2.5 text-sm text-[#20243A]">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#21966B]" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Privacy & Security Highlights */}
      <section id="security" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-stretch gap-8 rounded-2xl border border-[#E4E5ED] bg-white p-6 sm:p-8 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="text-xs font-semibold text-[#21966B]">Privacy &amp; Compliance</p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-[#20243A]">
              Engineered for Student Confidentiality &amp; Auditability
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#5A6078]">
              Every sensitive query is validated on the server. Students cannot enumerate another
              peer’s report card ID, faculty cannot alter locked records without an HOD-audited
              unlock, and every marks update writes an immutable audit log entry.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4">
                <ShieldCheck className="h-5 w-5 text-[#5146D8]" />
                <h3 className="mt-2.5 text-sm font-semibold text-[#20243A]">
                  Server-Enforced RBAC
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#777D91]">
                  Bcrypt password hashing, short-lived JWT sessions with server revocation, and rate
                  limiting on authentication endpoints.
                </p>
              </div>
              <div className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4">
                <History className="h-5 w-5 text-[#4387D9]" />
                <h3 className="mt-2.5 text-sm font-semibold text-[#20243A]">
                  Append-Only Audit Trail
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#777D91]">
                  Tracks previous marks, updated marks, faculty identity, lock timestamps, and
                  publication versions with zero editability.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[240px] overflow-hidden rounded-xl border border-[#E4E5ED] bg-[#E9EAF2]">
              <img
                src="/src/assets/images/academic_records_desk_1795590423989.jpg"
                alt="Clean organized academic desk representing structured institutional records"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E4E5ED] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-[#777D91] sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <span aria-hidden="true">·</span>
            <span>Gujarat Institute of Technology — DEMO</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/login/hod" className="hover:text-[#20243A]">
              HOD Portal
            </Link>
            <Link to="/login/professor" className="hover:text-[#20243A]">
              Professor Portal
            </Link>
            <Link to="/login/student" className="hover:text-[#20243A]">
              Student Portal
            </Link>
            <Link to="/register/student" className="hover:text-[#20243A]">
              Student Invite Registration
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

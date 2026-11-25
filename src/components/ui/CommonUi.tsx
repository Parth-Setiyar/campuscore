import React from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  AlertCircle,
  XCircle,
  FileEdit,
  X,
  GraduationCap,
} from 'lucide-react';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5146D8] text-white shadow-xs">
        <GraduationCap className="h-4 w-4" />
      </span>
      {!compact && (
        <span className="font-heading text-base font-bold tracking-tight text-[#20243A]">
          CAMPUSCORE
        </span>
      )}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  const config: Record<
    string,
    { label: string; textClass: string; bgClass: string; icon: React.ReactNode }
  > = {
    LOCKED: {
      label: 'Locked',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <Lock className="h-3 w-3" />,
    },
    PUBLISHED: {
      label: 'Published',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    APPROVED: {
      label: 'Approved',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    ACTIVE: {
      label: 'Active',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    ENTERED: {
      label: 'Entered',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    FINALIZED: {
      label: 'Finalized',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    READY: {
      label: 'Ready',
      textClass: 'text-[#21966B]',
      bgClass: 'bg-[#21966B]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    SUBMITTED: {
      label: 'Submitted',
      textClass: 'text-[#4387D9]',
      bgClass: 'bg-[#4387D9]/10',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    IN_PROGRESS: {
      label: 'In Progress',
      textClass: 'text-[#D99A32]',
      bgClass: 'bg-[#D99A32]/12',
      icon: <FileEdit className="h-3 w-3" />,
    },
    PENDING: {
      label: 'Pending',
      textClass: 'text-[#D99A32]',
      bgClass: 'bg-[#D99A32]/12',
      icon: <Clock className="h-3 w-3" />,
    },
    CONFLICT: {
      label: 'Conflict',
      textClass: 'text-[#D99A32]',
      bgClass: 'bg-[#D99A32]/12',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    AWAITING_ALL_SUBJECTS: {
      label: 'Awaiting All Subjects',
      textClass: 'text-[#D99A32]',
      bgClass: 'bg-[#D99A32]/12',
      icon: <Clock className="h-3 w-3" />,
    },
    NOT_STARTED: {
      label: 'Not Started',
      textClass: 'text-[#777D91]',
      bgClass: 'bg-[#F3F4F8]',
      icon: <Clock className="h-3 w-3" />,
    },
    REVOKED: {
      label: 'Revoked',
      textClass: 'text-[#777D91]',
      bgClass: 'bg-[#F3F4F8]',
      icon: <XCircle className="h-3 w-3" />,
    },
    EXPIRED: {
      label: 'Expired',
      textClass: 'text-[#D95364]',
      bgClass: 'bg-[#D95364]/10',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    REJECTED: {
      label: 'Rejected',
      textClass: 'text-[#D95364]',
      bgClass: 'bg-[#D95364]/10',
      icon: <XCircle className="h-3 w-3" />,
    },
    ERROR: {
      label: 'Error',
      textClass: 'text-[#D95364]',
      bgClass: 'bg-[#D95364]/10',
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const c = config[normalized] ?? {
    label: status,
    textClass: 'text-[#20243A]',
    bgClass: 'bg-[#F3F4F8]',
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${c.bgClass} ${c.textClass}`}
    >
      {c.icon}
      <span>{c.label}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const iconTone =
    tone === 'primary'
      ? 'bg-[#EFECFF] text-[#5146D8]'
      : tone === 'success'
        ? 'bg-[#21966B]/10 text-[#21966B]'
        : tone === 'warning'
          ? 'bg-[#D99A32]/12 text-[#D99A32]'
          : 'bg-[#F3F4F8] text-[#20243A]';

  return (
    <div className="rounded-2xl border border-[#E4E5ED] bg-white p-5 transition-colors hover:border-[#D2D4E2]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#777D91]">{label}</p>
          <p className="mt-2 font-heading text-2xl font-bold tracking-tight text-[#20243A] tabular-nums">
            {value}
          </p>
          {sublabel && <p className="mt-1 text-xs text-[#777D91]">{sublabel}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-[#20243A]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#777D91]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D6D8E4] bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFECFF] text-[#5146D8]">
        {icon}
      </div>
      <h3 className="mt-4 font-heading text-base font-semibold text-[#20243A]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[#777D91]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
      <div className="border-b border-[#E4E5ED] bg-[#F8F9FC] px-5 py-3.5">
        <div className="h-4 w-48 animate-pulse rounded bg-[#E4E5ED]" />
      </div>
      <div className="divide-y divide-[#E4E5ED]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-[#ECEDF3]" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-[#ECEDF3]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[#ECEDF3]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#20243A]/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E4E5ED] bg-white p-6 shadow-xl`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-[#20243A]">{title}</h2>
            {description && <p className="mt-1 text-sm text-[#777D91]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#777D91] transition-colors hover:bg-[#F3F4F8] hover:text-[#20243A]"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  isLoading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  isLoading?: boolean;
}) {
  const btnClass =
    tone === 'danger'
      ? 'bg-[#D95364] hover:bg-[#C44455] text-white'
      : tone === 'success'
        ? 'bg-[#21966B] hover:bg-[#1A7D58] text-white'
        : 'bg-[#5146D8] hover:bg-[#4237C2] text-white';

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} maxWidthClass="max-w-md">
      <div className="mt-6 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-xl border border-[#E4E5ED] bg-white px-4 py-2 text-sm font-medium text-[#20243A] transition-colors hover:bg-[#F3F4F8] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${btnClass}`}
        >
          {isLoading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

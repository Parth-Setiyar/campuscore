import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { Copy, Download, RefreshCw, Ban, QrCode, Check } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';

interface InvitationRow {
  id: string;
  class_id: string;
  token: string;
  expires_at: string;
  is_active: number;
  created_at: string;
  class_name: string;
  class_code: string;
  academic_year: string;
  semester: number;
  division: string;
  department_name: string;
}

export function QrInvitationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InvitationRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hod-invitations'],
    queryFn: () => apiRequest<{ invitations: InvitationRow[] }>('/api/hod/invitations'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/hod/invitations/${id}/revoke`, { method: 'PATCH' }),
    onSuccess: () => {
      setRevokeTarget(null);
      queryClient.invalidateQueries({ queryKey: ['hod-invitations'] });
      toast('success', 'Invitation revoked');
    },
    onError: (err: unknown) =>
      toast('error', 'Failed to revoke', err instanceof Error ? err.message : undefined),
  });

  const regenerateMutation = useMutation({
    mutationFn: (classId: string) =>
      apiRequest(`/api/hod/classes/${classId}/invitations/regenerate`, {
        method: 'POST',
        body: { expiresInDays: 30 },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hod-invitations'] });
      toast('success', 'New QR invitation generated', 'Previous active links for this class were revoked.');
    },
    onError: (err: unknown) =>
      toast('error', 'Failed to regenerate', err instanceof Error ? err.message : undefined),
  });

  const copyLink = async (inv: InvitationRow) => {
    const url = `${window.location.origin}/join/${inv.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast('success', 'Invitation URL copied');
  };

  const downloadQr = (inv: InvitationRow) => {
    const svgEl = document.getElementById(`qr-svg-${inv.id}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CAMPUSCORE_QR_${inv.class_code}_${inv.token}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('success', 'QR code downloaded');
  };

  const invitations = data?.invitations ?? [];

  return (
    <div>
      <PageHeader
        title="QR Codes & Invitation Links"
        description="Share expiring class invitation links with professors and students. Invitations contain zero private student data."
      />

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-5 w-5" />}
          title="No invitations created yet"
          description="Create a new class to automatically generate its QR code and invitation URL."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {invitations.map((inv) => {
            const isExpired = new Date(inv.expires_at).getTime() < Date.now();
            const status = inv.is_active !== 1 ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE';
            const inviteUrl = `${window.location.origin}/join/${inv.token}`;

            return (
              <div
                key={inv.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-base font-bold text-[#20243A]">
                      {inv.class_name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#777D91]">
                      {inv.department_name} · Sem {inv.semester} · Div {inv.division} ·{' '}
                      {inv.academic_year}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4 sm:flex-row">
                  <div className="rounded-xl bg-white p-3 shadow-2xs">
                    <QRCodeSVG
                      id={`qr-svg-${inv.id}`}
                      value={inviteUrl}
                      size={112}
                      level="M"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 text-xs">
                    <div>
                      <p className="text-[#777D91]">Invitation Code</p>
                      <p className="font-mono text-sm font-bold text-[#5146D8]">{inv.token}</p>
                    </div>
                    <div>
                      <p className="text-[#777D91]">Expires</p>
                      <p className="font-medium text-[#20243A]">
                        {format(new Date(inv.expires_at), 'dd MMM yyyy, hh:mm a')}
                      </p>
                    </div>
                    <p className="truncate font-mono text-[11px] text-[#777D91]">{inviteUrl}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(inv)}
                    disabled={status !== 'ACTIVE'}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#5146D8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4237C2] disabled:opacity-40"
                  >
                    {copiedId === inv.id ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedId === inv.id ? 'Copied' : 'Copy Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadQr(inv)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F3F4F8]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => regenerateMutation.mutate(inv.class_id)}
                    disabled={regenerateMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F3F4F8]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Regenerate</span>
                  </button>
                  {status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(inv)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#D95364]/30 bg-[#D95364]/8 px-3 py-2 text-xs font-semibold text-[#D95364] hover:bg-[#D95364]/15"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
        title="Revoke Class Invitation?"
        description={`Code ${revokeTarget?.token ?? ''} will immediately stop accepting new faculty or student join requests.`}
        confirmLabel="Revoke Invitation"
        tone="danger"
        isLoading={revokeMutation.isPending}
      />
    </div>
  );
}

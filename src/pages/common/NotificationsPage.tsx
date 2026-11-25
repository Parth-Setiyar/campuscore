import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell, CheckCheck, Check, ArrowUpRight } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { EmptyState, PageHeader, TableSkeleton } from '../../components/ui/CommonUi';
import type { NotificationItem } from '../../types';

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiRequest('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('success', 'All notifications marked as read');
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Track approvals, marks submissions, subject lock events, reminders, and result publications."
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5ED] bg-white px-4 py-2 text-xs font-semibold text-[#20243A] transition-colors hover:bg-[#F8F9FC]"
            >
              <CheckCheck className="h-4 w-4 text-[#5146D8]" />
              <span>Mark all as read ({unreadCount})</span>
            </button>
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No notifications yet"
          description="Workflow events such as enrollment approvals, locked subjects, and published results will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
          <div className="divide-y divide-[#E4E5ED]">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                  item.is_read === 0 ? 'bg-[#EFECFF]/30' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#777D91]">
                    <span className="font-semibold text-[#20243A] text-sm">{item.title}</span>
                    {item.is_read === 0 && (
                      <span className="rounded bg-[#5146D8] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Unread
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{format(new Date(item.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#5A6078]">{item.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.is_read === 0 && (
                    <button
                      type="button"
                      onClick={() => markOne.mutate(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3 py-1.5 text-xs font-medium text-[#20243A] hover:bg-[#F3F4F8]"
                    >
                      <Check className="h-3.5 w-3.5 text-[#21966B]" />
                      <span>Mark read</span>
                    </button>
                  )}
                  {item.link && (
                    <button
                      type="button"
                      onClick={() => {
                        if (item.is_read === 0) markOne.mutate(item.id);
                        navigate(item.link!);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#EFECFF] px-3 py-1.5 text-xs font-semibold text-[#5146D8] hover:bg-[#5146D8] hover:text-white"
                    >
                      <span>Open</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

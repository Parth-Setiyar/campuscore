import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  User,
  X,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import { BrandLogo } from '../components/ui/CommonUi';
import type { NotificationItem } from '../types';

export interface NavItemConfig {
  label: string;
  to: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

interface DashboardLayoutProps {
  roleLabel: string;
  navItems: NavItemConfig[];
  notificationsPath: string;
  profilePath: string;
}

export function DashboardLayout({
  roleLabel,
  navItems,
  notificationsPath,
  profilePath,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),
    refetchInterval: 20000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast('success', 'All notifications marked as read');
    },
  });

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    toast('info', 'Signed out of CAMPUSCORE');
    navigate('/');
  };

  const unreadCount = notifData?.unreadCount ?? 0;
  const recentNotifications = (notifData?.notifications ?? []).slice(0, 6);

  const activeNav = navItems.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

  const initials = (user?.fullName ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSidebarLinks = (isMobile = false) => (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-16 items-center border-b border-[#DCDDE7] px-4 ${
          collapsed && !isMobile ? 'justify-center' : 'justify-between'
        }`}
      >
        <BrandLogo compact={collapsed && !isMobile} />
        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-[#777D91] hover:bg-white/60 hover:text-[#20243A]"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-lg p-1.5 text-[#777D91] transition-colors hover:bg-white/60 hover:text-[#20243A] lg:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {(!collapsed || isMobile) && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-semibold text-[#777D91]">{roleLabel}</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split('/').length <= 2}
            onClick={() => setMobileOpen(false)}
            title={collapsed && !isMobile ? item.label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-white text-[#5146D8] shadow-2xs ring-1 ring-[#E4E5ED]'
                  : 'text-[#454A63] hover:bg-white/65 hover:text-[#20243A]'
              } ${collapsed && !isMobile ? 'justify-center px-2' : ''}`
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {(!collapsed || isMobile) && <span className="truncate flex-1">{item.label}</span>}
            {(!collapsed || isMobile) && item.badgeCount !== undefined && item.badgeCount > 0 && (
              <span className="rounded-md bg-[#5146D8] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white tabular-nums">
                {item.badgeCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#DCDDE7] p-2.5">
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed && !isMobile ? 'Logout' : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#D95364] transition-colors hover:bg-[#D95364]/10 whitespace-nowrap ${
            collapsed && !isMobile ? 'justify-center px-2' : ''
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F3F4F8] text-[#20243A]">
      {/* Desktop Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 hidden border-r border-[#DCDDE7] bg-[#E9EAF2] transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[72px]' : 'w-[256px]'
        }`}
      >
        {renderSidebarLinks(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-[#20243A]/40 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-[#DCDDE7] bg-[#E9EAF2] shadow-xl">
            {renderSidebarLinks(true)}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div
        className={`flex min-h-screen flex-col transition-[padding-left] duration-200 ${
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[256px]'
        }`}
      >
        {/* Topbar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#E4E5ED] bg-white/95 px-4 backdrop-blur-xs sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-[#454A63] hover:bg-[#F3F4F8] lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-[#777D91] sm:inline">{roleLabel}</span>
              <span className="hidden text-[#C4C7D6] sm:inline">/</span>
              <span className="truncate font-semibold text-[#20243A]">
                {activeNav?.label ?? 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E4E5ED] bg-white text-[#454A63] transition-colors hover:bg-[#F3F4F8] hover:text-[#20243A]"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#5146D8] px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white shadow-xl sm:w-96">
                  <div className="flex items-center justify-between border-b border-[#E4E5ED] px-4 py-3">
                    <span className="text-sm font-semibold text-[#20243A]">
                      Notifications ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllMutation.mutate()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#5146D8] hover:underline"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 divide-y divide-[#E4E5ED] overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-[#777D91]">
                        No notifications yet.
                      </p>
                    ) : (
                      recentNotifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (n.is_read === 0) markReadMutation.mutate(n.id);
                            setNotifOpen(false);
                            if (n.link) navigate(n.link);
                          }}
                          className={`block w-full px-4 py-3 text-left transition-colors hover:bg-[#F8F9FC] ${
                            n.is_read === 0 ? 'bg-[#EFECFF]/35' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-[#20243A]">{n.title}</p>
                            <span className="shrink-0 text-[11px] text-[#777D91]">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-[#777D91]">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[#E4E5ED] bg-[#F8F9FC] px-4 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate(notificationsPath);
                      }}
                      className="text-xs font-medium text-[#5146D8] hover:underline"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-xl border border-[#E4E5ED] bg-white py-1.5 pl-1.5 pr-3 transition-colors hover:bg-[#F3F4F8]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFECFF] text-xs font-bold text-[#5146D8]">
                  {initials}
                </span>
                <span className="hidden max-w-[140px] truncate text-xs font-medium text-[#20243A] sm:inline">
                  {user?.fullName}
                </span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white py-1.5 shadow-xl">
                  <div className="border-b border-[#E4E5ED] px-4 py-2.5">
                    <p className="truncate text-sm font-semibold text-[#20243A]">{user?.fullName}</p>
                    <p className="truncate text-xs text-[#777D91]">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate(profilePath);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-medium text-[#20243A] hover:bg-[#F3F4F8]"
                  >
                    <User className="h-3.5 w-3.5 text-[#777D91]" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-medium text-[#D95364] hover:bg-[#D95364]/8"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Content */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

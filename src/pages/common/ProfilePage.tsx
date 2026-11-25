import { useState } from 'react';
import { ShieldCheck, Save, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../services/api';
import { PageHeader } from '../../components/ui/CommonUi';
import type { HodProfile, ProfessorProfile, StudentProfile } from '../../types';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [specialization, setSpecialization] = useState(
    user?.role === 'PROFESSOR' ? (user.profile as ProfessorProfile | null)?.specialization ?? '' : ''
  );
  const [designation, setDesignation] = useState(
    user?.role === 'HOD' ? (user.profile as HodProfile | null)?.designation ?? '' : ''
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: {
          fullName,
          phone,
          ...(user.role === 'PROFESSOR' ? { specialization } : {}),
          ...(user.role === 'HOD' ? { designation } : {}),
        },
      });
      await refreshUser();
      toast('success', 'Profile updated');
    } catch (err: unknown) {
      toast('error', 'Update failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast('error', 'New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('success', 'Password changed successfully');
    } catch (err: unknown) {
      toast('error', 'Password change failed', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingPassword(false);
    }
  };

  const roleIdDisplay =
    user.role === 'HOD'
      ? { label: 'HOD Code', value: (user.profile as HodProfile | null)?.hodCode ?? '—' }
      : user.role === 'PROFESSOR'
        ? { label: 'Faculty ID', value: (user.profile as ProfessorProfile | null)?.facultyId ?? '—' }
        : {
            label: 'Enrollment Number',
            value: (user.profile as StudentProfile | null)?.enrollmentNumber ?? '—',
          };

  return (
    <div>
      <PageHeader
        title="Account Profile"
        description="View your institutional identity and manage permitted account details."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <form
            onSubmit={handleProfileSave}
            className="rounded-2xl border border-[#E4E5ED] bg-white p-6"
          >
            <h2 className="font-heading text-base font-bold text-[#20243A]">Personal Details</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  Institutional Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3.5 py-2.5 text-sm text-[#777D91]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">
                  {roleIdDisplay.label}
                </label>
                <input
                  type="text"
                  disabled
                  value={roleIdDisplay.value}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-3.5 py-2.5 font-mono text-sm text-[#777D91]"
                />
              </div>

              {user.role === 'PROFESSOR' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#20243A]">
                    Academic Specialization
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                  />
                </div>
              )}

              {user.role === 'HOD' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#20243A]">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3.5 py-2.5 text-sm outline-none focus:border-[#5146D8]"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>

          <form
            onSubmit={handlePasswordChange}
            className="rounded-2xl border border-[#E4E5ED] bg-white p-6"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#5146D8]" />
              <h2 className="font-heading text-base font-bold text-[#20243A]">Update Password</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3 py-2 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3 py-2 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#20243A]">Confirm New</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E4E5ED] px-3 py-2 text-sm outline-none focus:border-[#5146D8]"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-4 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#EFECFF] hover:text-[#5146D8] disabled:opacity-60"
              >
                {savingPassword ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-[#21966B]" />
              <h2 className="font-heading text-base font-bold text-[#20243A]">
                Institutional Record
              </h2>
            </div>
            <dl className="mt-5 divide-y divide-[#E4E5ED] text-sm">
              <div className="flex justify-between py-3">
                <dt className="text-[#777D91]">Institution</dt>
                <dd className="font-medium text-right text-[#20243A]">
                  {user.profile?.college ?? 'Gujarat Institute of Technology — DEMO'}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-[#777D91]">Department</dt>
                <dd className="font-medium text-[#20243A]">
                  {user.profile?.departmentName ?? '—'} ({user.profile?.departmentCode ?? '—'})
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-[#777D91]">Role</dt>
                <dd className="font-semibold text-[#5146D8]">{user.role}</dd>
              </div>
              {user.role === 'STUDENT' && (
                <>
                  <div className="flex justify-between py-3">
                    <dt className="text-[#777D91]">Current Semester</dt>
                    <dd className="font-mono font-medium text-[#20243A]">
                      Semester {(user.profile as StudentProfile | null)?.currentSemester ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between py-3">
                    <dt className="text-[#777D91]">Batch</dt>
                    <dd className="font-mono font-medium text-[#20243A]">
                      {(user.profile as StudentProfile | null)?.batch || '—'}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

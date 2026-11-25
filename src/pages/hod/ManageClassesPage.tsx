import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Users, BookOpen, Search, Eye } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';

interface ClassSummary {
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
  roster_count: number;
  enrolled_count: number;
}

interface ClassDetail {
  classInfo: ClassSummary & { college: string };
  subjects: Array<{
    id: string;
    code: string;
    name: string;
    max_marks: number;
    assessment_type: string;
    professor_name: string | null;
    submission_status: string;
    marks_entered: number;
  }>;
  roster: Array<{
    id: string;
    enrollment_number: string;
    roster_name: string | null;
    student_name: string | null;
    is_enrolled: number;
  }>;
}

export function ManageClassesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [subjectToRemove, setSubjectToRemove] = useState<{ id: string; code: string } | null>(null);

  // Add subject inline form
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubMax, setNewSubMax] = useState(50);
  const [newSubProf, setNewSubProf] = useState('');

  // Add roster student form
  const [newRosterEnr, setNewRosterEnr] = useState('');
  const [newRosterName, setNewRosterName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['hod-classes'],
    queryFn: () => apiRequest<{ classes: ClassSummary[] }>('/api/hod/classes'),
  });

  const { data: meta } = useQuery({
    queryKey: ['hod-meta'],
    queryFn: () =>
      apiRequest<{ professors: Array<{ id: string; full_name: string }> }>('/api/hod/meta'),
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['hod-class-detail', selectedClassId],
    queryFn: () => apiRequest<ClassDetail>(`/api/hod/classes/${selectedClassId}`),
    enabled: Boolean(selectedClassId),
  });

  const addSubjectMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/hod/classes/${selectedClassId}/subjects`, {
        method: 'POST',
        body: {
          code: newSubCode,
          name: newSubName,
          maxMarks: Number(newSubMax),
          assignedProfessorId: newSubProf || null,
        },
      }),
    onSuccess: () => {
      setNewSubCode('');
      setNewSubName('');
      setNewSubMax(50);
      setNewSubProf('');
      queryClient.invalidateQueries({ queryKey: ['hod-class-detail', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['hod-classes'] });
      toast('success', 'Subject added to class');
    },
    onError: (err: unknown) =>
      toast('error', 'Could not add subject', err instanceof Error ? err.message : undefined),
  });

  const removeSubjectMutation = useMutation({
    mutationFn: (subjectId: string) =>
      apiRequest(`/api/hod/classes/${selectedClassId}/subjects/${subjectId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setSubjectToRemove(null);
      queryClient.invalidateQueries({ queryKey: ['hod-class-detail', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['hod-classes'] });
      toast('success', 'Subject removed');
    },
    onError: (err: unknown) =>
      toast('error', 'Cannot remove subject', err instanceof Error ? err.message : undefined),
  });

  const addRosterMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ addedCount: number; duplicates: string[] }>(
        `/api/hod/classes/${selectedClassId}/roster`,
        {
          method: 'POST',
          body: {
            students: [{ enrollmentNumber: newRosterEnr, rosterName: newRosterName }],
          },
        }
      ),
    onSuccess: (res) => {
      if (res.duplicates.length > 0) {
        toast('warning', 'Duplicate enrollment number', `${res.duplicates[0]} is already on the roster.`);
      } else {
        setNewRosterEnr('');
        setNewRosterName('');
        queryClient.invalidateQueries({ queryKey: ['hod-class-detail', selectedClassId] });
        queryClient.invalidateQueries({ queryKey: ['hod-classes'] });
        toast('success', 'Enrollment added to class roster');
      }
    },
    onError: (err: unknown) =>
      toast('error', 'Failed to update roster', err instanceof Error ? err.message : undefined),
  });

  const filtered = (data?.classes ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.class_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Manage Classes"
        description="Inspect department cohorts, manage pre-publication subjects, and maintain authorized enrollment rosters."
        actions={
          <Link
            to="/hod/create-class"
            className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4237C2]"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Class</span>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777D91]" />
          <input
            type="text"
            placeholder="Search by class name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#E4E5ED] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#5146D8]"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="No classes found"
          description="Create your first academic cohort to manage subjects and issue QR invitations."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-xs font-semibold text-[#777D91]">
                <tr>
                  <th className="px-5 py-3.5">Class &amp; Code</th>
                  <th className="px-4 py-3.5">Semester / Div</th>
                  <th className="px-4 py-3.5">Enrolled / Roster</th>
                  <th className="px-4 py-3.5">Subjects Locked</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E5ED]">
                {filtered.map((cls) => (
                  <tr key={cls.id} className="hover:bg-[#F8F9FC]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#20243A]">{cls.name}</p>
                      <p className="font-mono text-xs text-[#777D91]">
                        {cls.class_code} · {cls.academic_year}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#5A6078]">
                      Sem {cls.semester} · Div {cls.division} · Batch {cls.batch}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums">
                      {cls.enrolled_count} / {cls.roster_count}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums">
                      {cls.locked_subjects} / {cls.total_subjects}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge
                        status={
                          cls.is_published === 1
                            ? 'PUBLISHED'
                            : cls.total_subjects > 0 && cls.locked_subjects === cls.total_subjects
                              ? 'READY'
                              : 'IN_PROGRESS'
                        }
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3 py-1.5 text-xs font-semibold text-[#20243A] hover:border-[#5146D8]/40 hover:text-[#5146D8]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect &amp; Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Class Detail Modal */}
      <Modal
        open={Boolean(selectedClassId)}
        onClose={() => setSelectedClassId(null)}
        title={detail?.classInfo.name ?? 'Class Details'}
        description={
          detail
            ? `${detail.classInfo.class_code} · ${detail.classInfo.department_name} · Academic Year ${detail.classInfo.academic_year}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {loadingDetail || !detail ? (
          <TableSkeleton rows={4} />
        ) : (
          <div className="space-y-6">
            {/* Subjects */}
            <div>
              <h3 className="text-sm font-bold text-[#20243A]">
                Subjects ({detail.subjects.length})
              </h3>
              <div className="mt-2.5 overflow-x-auto rounded-xl border border-[#E4E5ED]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] text-[#777D91]">
                    <tr>
                      <th className="px-3.5 py-2.5">Code</th>
                      <th className="px-3.5 py-2.5">Subject</th>
                      <th className="px-3.5 py-2.5">Professor</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      {detail.classInfo.is_published === 0 && (
                        <th className="px-3.5 py-2.5 text-right">Remove</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E5ED]">
                    {detail.subjects.map((sub) => (
                      <tr key={sub.id}>
                        <td className="px-3.5 py-2.5 font-mono font-semibold text-[#5146D8]">
                          {sub.code}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-medium text-[#20243A]">{sub.name}</span>
                          <span className="ml-1.5 font-mono text-[#777D91]">(Max {sub.max_marks})</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[#5A6078]">
                          {sub.professor_name ?? 'Unassigned'}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge status={sub.submission_status} />
                        </td>
                        {detail.classInfo.is_published === 0 && (
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setSubjectToRemove({ id: sub.id, code: sub.code })}
                              className="rounded-lg p-1 text-[#D95364] hover:bg-[#D95364]/10"
                              aria-label={`Remove ${sub.code}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.classInfo.is_published === 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addSubjectMutation.mutate();
                  }}
                  className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-3 sm:grid-cols-12"
                >
                  <input
                    type="text"
                    required
                    placeholder="Code (CE405)"
                    value={newSubCode}
                    onChange={(e) => setNewSubCode(e.target.value.toUpperCase())}
                    className="rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1.5 font-mono text-xs sm:col-span-2"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Subject Name"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
                  />
                  <input
                    type="number"
                    required
                    min={1}
                    max={1000}
                    value={newSubMax}
                    onChange={(e) => setNewSubMax(Number(e.target.value))}
                    className="rounded-lg border border-[#E4E5ED] bg-white px-2.5 py-1.5 font-mono text-xs sm:col-span-2"
                  />
                  <select
                    value={newSubProf}
                    onChange={(e) => setNewSubProf(e.target.value)}
                    className="rounded-lg border border-[#E4E5ED] bg-white px-2 py-1.5 text-xs sm:col-span-2"
                  >
                    <option value="">Unassigned</option>
                    {(meta?.professors ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={addSubjectMutation.isPending}
                    className="rounded-lg bg-[#5146D8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4237C2] sm:col-span-2"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>

            {/* Roster */}
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#5146D8]" />
                <h3 className="text-sm font-bold text-[#20243A]">
                  Enrollment Roster ({detail.roster.length})
                </h3>
              </div>
              <div className="mt-2.5 max-h-52 overflow-y-auto rounded-xl border border-[#E4E5ED]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-[#E4E5ED] bg-[#F8F9FC] text-[#777D91]">
                    <tr>
                      <th className="px-3.5 py-2">Enrollment No.</th>
                      <th className="px-3.5 py-2">Name</th>
                      <th className="px-3.5 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E5ED]">
                    {detail.roster.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3.5 py-2 font-mono font-semibold text-[#20243A]">
                          {r.enrollment_number}
                        </td>
                        <td className="px-3.5 py-2 text-[#5A6078]">
                          {r.student_name || r.roster_name || '—'}
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <StatusBadge status={r.is_enrolled === 1 ? 'APPROVED' : 'PENDING'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.classInfo.is_published === 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addRosterMutation.mutate();
                  }}
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    type="text"
                    required
                    placeholder="New Enrollment Number"
                    value={newRosterEnr}
                    onChange={(e) => setNewRosterEnr(e.target.value.toUpperCase())}
                    className="flex-1 rounded-lg border border-[#E4E5ED] px-3 py-1.5 font-mono text-xs uppercase"
                  />
                  <input
                    type="text"
                    placeholder="Student Name (optional)"
                    value={newRosterName}
                    onChange={(e) => setNewRosterName(e.target.value)}
                    className="flex-1 rounded-lg border border-[#E4E5ED] px-3 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={addRosterMutation.isPending}
                    className="rounded-lg bg-[#20243A] px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Add to Roster
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(subjectToRemove)}
        onClose={() => setSubjectToRemove(null)}
        onConfirm={() => subjectToRemove && removeSubjectMutation.mutate(subjectToRemove.id)}
        title={`Remove Subject ${subjectToRemove?.code ?? ''}?`}
        description="This removes the subject and any unfinalized marks associated with it prior to result publication."
        confirmLabel="Remove Subject"
        tone="danger"
        isLoading={removeSubjectMutation.isPending}
      />
    </div>
  );
}

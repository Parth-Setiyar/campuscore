import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Sparkles,
  RefreshCw,
  Save,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';

interface SubjectMarksData {
  subject: {
    id: string;
    code: string;
    name: string;
    max_marks: number;
    class_name: string;
    submission_status: string;
    locked_at: string | null;
    is_published: number;
  };
  students: Array<{
    serialNo: number;
    studentId: string;
    enrollmentNumber: string;
    studentName: string;
    obtainedMarks: number | null;
    remarkText: string;
    isAiDrafted: boolean;
  }>;
  summary: {
    totalStudents: number;
    enteredCount: number;
    missingCount: number;
  };
}

/* ========================= 1. AI AUTO-REMARKS ========================= */
export function AiRemarksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: classesData } = useQuery({
    queryKey: ['professor-classes'],
    queryFn: () =>
      apiRequest<{
        subjects: Array<{ id: string; code: string; name: string; class_name: string }>;
      }>('/api/professor/classes'),
  });

  const selectedSubjectId = searchParams.get('subjectId') || classesData?.subjects[0]?.id || '';

  const { data, isLoading } = useQuery({
    queryKey: ['professor-marks', selectedSubjectId],
    queryFn: () =>
      apiRequest<SubjectMarksData>(`/api/professor/subjects/${selectedSubjectId}/marks`),
    enabled: Boolean(selectedSubjectId),
  });

  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, { text: string; isAi: boolean }>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [aiErrorBanner, setAiErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const next: Record<string, { text: string; isAi: boolean }> = {};
      for (const s of data.students) {
        next[s.studentId] = { text: s.remarkText, isAi: s.isAiDrafted };
      }
      setRemarkDrafts(next);
      setAiErrorBanner(null);
    }
  }, [data]);

  const generateRemark = async (studentId: string) => {
    setGeneratingId(studentId);
    setAiErrorBanner(null);
    try {
      const res = await apiRequest<{ studentId: string; remarkText: string; isAiDrafted: boolean }>(
        `/api/professor/subjects/${selectedSubjectId}/remarks/generate`,
        {
          method: 'POST',
          body: { studentId },
        }
      );
      setRemarkDrafts((prev) => ({
        ...prev,
        [studentId]: { text: res.remarkText, isAi: true },
      }));
      toast('success', 'AI academic remark drafted', 'Review, edit if needed, and save.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service is currently unavailable.';
      setAiErrorBanner(msg);
      toast('error', 'AI remark unavailable', 'You can enter and save a manual remark below.');
    } finally {
      setGeneratingId(null);
    }
  };

  const saveRemarkMutation = useMutation({
    mutationFn: ({ studentId, remarkText, isAiDrafted }: { studentId: string; remarkText: string; isAiDrafted: boolean }) =>
      apiRequest(`/api/professor/subjects/${selectedSubjectId}/remarks`, {
        method: 'PUT',
        body: { studentId, remarkText, isAiDrafted },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professor-marks', selectedSubjectId] });
      toast('success', 'Remark saved to academic record');
    },
    onError: (err: unknown) =>
      toast('error', 'Could not save remark', err instanceof Error ? err.message : undefined),
  });

  const isLocked = data?.subject.submission_status === 'LOCKED';

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Auto-Remarks"
        description="Generate constructive, data-grounded academic report card remarks via Gemini, or write and refine remarks manually."
        actions={
          <select
            value={selectedSubjectId}
            onChange={(e) => setSearchParams({ subjectId: e.target.value })}
            className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A]"
          >
            {(classesData?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name} ({s.class_name})
              </option>
            ))}
          </select>
        }
      />

      {aiErrorBanner && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#D95364]/30 bg-[#D95364]/8 p-4 text-xs text-[#20243A]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D95364]" />
          <div>
            <p className="font-semibold text-[#D95364]">Gemini AI Generation Notice</p>
            <p className="mt-0.5 text-[#5A6078]">{aiErrorBanner}</p>
          </div>
        </div>
      )}

      {isLoading || !data ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="space-y-3">
          {data.students.map((stu) => {
            const draft = remarkDrafts[stu.studentId] ?? { text: '', isAi: false };
            const isGenerating = generatingId === stu.studentId;
            return (
              <div
                key={stu.studentId}
                className="rounded-2xl border border-[#E4E5ED] bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-[#5146D8]">
                        {stu.enrollmentNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#20243A] text-sm">
                        {stu.studentName}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#777D91]">
                      Marks:{' '}
                      <span className="font-mono font-semibold text-[#20243A]">
                        {stu.obtainedMarks !== null
                          ? `${stu.obtainedMarks} / ${data.subject.max_marks}`
                          : 'Not entered yet'}
                      </span>
                    </p>
                  </div>

                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={stu.obtainedMarks === null || isGenerating}
                        onClick={() => generateRemark(stu.studentId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#5146D8]/30 bg-[#EFECFF] px-3 py-1.5 text-xs font-semibold text-[#5146D8] hover:bg-[#5146D8] hover:text-white disabled:opacity-40"
                      >
                        {draft.text ? (
                          <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isGenerating
                            ? 'Generating...'
                            : draft.text
                              ? 'Regenerate AI Remark'
                              : 'Generate AI Remark'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={!draft.text.trim() || saveRemarkMutation.isPending}
                        onClick={() =>
                          saveRemarkMutation.mutate({
                            studentId: stu.studentId,
                            remarkText: draft.text,
                            isAiDrafted: draft.isAi,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#20243A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#313654] disabled:opacity-40"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Remark</span>
                      </button>
                    </div>
                  )}
                </div>

                <textarea
                  rows={2}
                  disabled={isLocked}
                  placeholder="Enter a constructive academic remark or click Generate AI Remark..."
                  value={draft.text}
                  onChange={(e) =>
                    setRemarkDrafts((prev) => ({
                      ...prev,
                      [stu.studentId]: { text: e.target.value, isAi: false },
                    }))
                  }
                  className="mt-3 w-full rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-3 text-sm text-[#20243A] outline-none focus:border-[#5146D8] focus:bg-white disabled:opacity-70"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================= 2. SUBJECT LOCK & SUBMIT ========================= */
export function LockSubmitPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['professor-classes'],
    queryFn: () =>
      apiRequest<{
        subjects: Array<{
          id: string;
          code: string;
          name: string;
          class_name: string;
          submission_status: string;
        }>;
      }>('/api/professor/classes'),
  });

  const selectedSubjectId = searchParams.get('subjectId') || classesData?.subjects[0]?.id || '';

  const { data, isLoading } = useQuery({
    queryKey: ['professor-marks', selectedSubjectId],
    queryFn: () =>
      apiRequest<SubjectMarksData>(`/api/professor/subjects/${selectedSubjectId}/marks`),
    enabled: Boolean(selectedSubjectId),
  });

  const lockMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ message: string; lockedAt: string }>(
        `/api/professor/subjects/${selectedSubjectId}/lock`,
        { method: 'POST' }
      ),
    onSuccess: (res) => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['professor-marks', selectedSubjectId] });
      queryClient.invalidateQueries({ queryKey: ['professor-classes'] });
      queryClient.invalidateQueries({ queryKey: ['professor-dashboard'] });
      toast('success', 'Subject Locked & Submitted', res.message);
    },
    onError: (err: unknown) => {
      setConfirmOpen(false);
      toast('error', 'Cannot lock subject', err instanceof Error ? err.message : undefined);
    },
  });

  const isLocked = data?.subject.submission_status === 'LOCKED';
  const canLock =
    Boolean(data) &&
    !isLocked &&
    data!.summary.totalStudents > 0 &&
    data!.summary.missingCount === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subject Lock & Submit"
        description="Verify completeness across every enrolled student and lock your subject for HOD final result publication."
        actions={
          <select
            value={selectedSubjectId}
            onChange={(e) => setSearchParams({ subjectId: e.target.value })}
            className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A]"
          >
            {(classesData?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name} ({s.submission_status})
              </option>
            ))}
          </select>
        }
      />

      {!selectedSubjectId ? (
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="No assigned subjects"
          description="You currently have no active subjects to lock."
        />
      ) : isLoading || !data ? (
        <TableSkeleton rows={5} />
      ) : (
        <>
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isLocked || canLock
                      ? 'bg-[#21966B]/12 text-[#21966B]'
                      : 'bg-[#D99A32]/15 text-[#D99A32]'
                  }`}
                >
                  {isLocked || canLock ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-bold text-[#20243A]">
                      {data.subject.code} — {data.subject.name}
                    </h2>
                    <StatusBadge status={data.subject.submission_status} />
                  </div>
                  {isLocked ? (
                    <p className="mt-1 text-xs text-[#5A6078]">
                      Finalized and locked on{' '}
                      {data.subject.locked_at
                        ? format(new Date(data.subject.locked_at), 'dd MMM yyyy, hh:mm a')
                        : 'record'}
                      . Ready for HOD verification.
                    </p>
                  ) : canLock ? (
                    <p className="mt-1 text-xs text-[#5A6078]">
                      All {data.summary.totalStudents} enrolled students have verified marks. Review
                      the table below before locking.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[#D95364]">
                      {data.summary.missingCount} student(s) still have missing marks. Complete all
                      entries before locking.{' '}
                      <Link
                        to={`/professor/marks?subjectId=${data.subject.id}`}
                        className="font-semibold underline"
                      >
                        Go to Marks Entry
                      </Link>
                    </p>
                  )}
                </div>
              </div>

              {!isLocked && (
                <button
                  type="button"
                  disabled={!canLock}
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4237C2] disabled:cursor-not-allowed disabled:bg-[#C6C9D8]"
                >
                  <Lock className="h-4 w-4" />
                  <span>LOCK &amp; SUBMIT SUBJECT</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white">
            <div className="border-b border-[#E4E5ED] px-5 py-3.5">
              <h3 className="text-sm font-bold text-[#20243A]">Final Marks Verification Preview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="border-b border-[#E4E5ED] bg-[#F8F9FC] font-semibold text-[#777D91]">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-4 py-3">Enrollment No.</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3 text-right">Obtained / Max</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E5ED]">
                  {data.students.map((s) => (
                    <tr key={s.studentId}>
                      <td className="px-5 py-3 font-mono text-[#777D91]">{s.serialNo}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#5146D8]">
                        {s.enrollmentNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#20243A]">{s.studentName}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                        {s.obtainedMarks !== null ? (
                          `${s.obtainedMarks} / ${data.subject.max_marks}`
                        ) : (
                          <span className="text-[#D95364]">Missing</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <StatusBadge status={s.obtainedMarks !== null ? 'ENTERED' : 'PENDING'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => lockMutation.mutate()}
            title={`Lock & Submit ${data.subject.code}?`}
            description="Once locked, normal marks editing will be disabled and the HOD will be notified that your subject is ready for final publication."
            confirmLabel="Confirm Lock & Submit"
            tone="primary"
            isLoading={lockMutation.isPending}
          />
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  FileText,
  History,
  Download,
  Sparkles,
  TrendingUp,
  Target,
  Calculator,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  TableSkeleton,
} from '../../components/ui/CommonUi';
import { ReportCardView, downloadReportCardPdf } from '../../components/ui/ReportCardView';
import type { OfficialReportCardDetail } from '../../types';

interface ReportCardSummary {
  id: string;
  report_code: string;
  total_max_marks: number;
  total_obtained: number;
  percentage: number;
  grade: string;
  result_status: string;
  published_at: string;
  class_id: string;
  class_name: string;
  academic_year: string;
  semester: number;
  division: string;
  batch: string;
  department_name: string;
  college: string;
}

/* ========================= 1. MY REPORT CARDS ========================= */
export function MyReportCardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['student-report-cards'],
    queryFn: () => apiRequest<{ reportCards: ReportCardSummary[] }>('/api/student/report-cards'),
  });

  const urlId = searchParams.get('id') ?? '';
  const [selectedId, setSelectedId] = useState(urlId);

  useEffect(() => {
    if (urlId) {
      setSelectedId(urlId);
    } else if (!selectedId && listData?.reportCards.length) {
      setSelectedId(listData.reportCards[0].id);
    }
  }, [urlId, listData, selectedId]);

  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ['student-report-card-detail', selectedId],
    queryFn: () =>
      apiRequest<{ reportCard: OfficialReportCardDetail }>(`/api/student/report-cards/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSearchParams({ id });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Report Cards"
        description="Official HOD-verified academic report cards with printable layout and PDF export."
        actions={
          listData && listData.reportCards.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              className="rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-sm font-medium text-[#20243A] outline-none focus:border-[#5146D8]"
            >
              {listData.reportCards.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  Sem {rc.semester} ({rc.academic_year}) — {rc.percentage.toFixed(1)}% ({rc.grade})
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {listLoading ? (
        <TableSkeleton rows={6} />
      ) : !listData || listData.reportCards.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No published report cards yet"
          description="Your official report card will appear here as soon as all subjects are locked and published by your HOD."
          action={
            <Link
              to="/student/result-status"
              className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4237C2]"
            >
              <span>Check Result Status</span>
            </Link>
          }
        />
      ) : detailLoading ? (
        <TableSkeleton rows={7} />
      ) : detailError || !detailData?.reportCard ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#D95364]/30 bg-white p-5 text-sm text-[#20243A]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#D95364]" />
          <div>
            <p className="font-semibold">Unable to load report card</p>
            <p className="mt-1 text-xs text-[#777D91]">
              {detailError instanceof Error
                ? detailError.message
                : 'This report card is unavailable or belongs to another student.'}
            </p>
          </div>
        </div>
      ) : (
        <ReportCardView
          reportCard={detailData.reportCard}
          onDownloadError={(msg) => toast('error', 'PDF Export Error', msg)}
        />
      )}
    </div>
  );
}

/* ========================= 2. PREVIOUS SEMESTERS ARCHIVE ========================= */
export function PreviousSemestersPage() {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['student-report-cards'],
    queryFn: () => apiRequest<{ reportCards: ReportCardSummary[] }>('/api/student/report-cards'),
  });

  const handleDirectPdf = async (rcId: string) => {
    setDownloadingId(rcId);
    try {
      const res = await apiRequest<{ reportCard: OfficialReportCardDetail }>(
        `/api/student/report-cards/${rcId}`
      );
      downloadReportCardPdf(res.reportCard);
      toast('success', 'Official PDF downloaded');
    } catch (err: unknown) {
      toast('error', 'Download failed', err instanceof Error ? err.message : undefined);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Previous Semesters"
        description="Permanent multi-semester academic archive. Past verified records remain accessible even as you progress to new semesters."
      />

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : !data || data.reportCards.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="No archived semesters yet"
          description="Completed and published semester results will be permanently archived here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.reportCards.map((rc) => (
            <div
              key={rc.id}
              className="flex flex-col justify-between rounded-2xl border border-[#E4E5ED] bg-white p-6 transition-colors hover:border-[#C9CCE0]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-semibold text-[#5146D8]">
                      {rc.report_code}
                    </span>
                    <h2 className="mt-1 font-heading text-lg font-bold text-[#20243A]">
                      Semester {rc.semester} · Division {rc.division}
                    </h2>
                    <p className="text-xs text-[#777D91]">
                      {rc.department_name} · Academic Year {rc.academic_year}
                    </p>
                  </div>
                  <StatusBadge status="PUBLISHED" />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-3.5">
                  <div>
                    <p className="text-[11px] text-[#777D91]">Percentage</p>
                    <p className="mt-0.5 font-mono text-base font-bold text-[#5146D8] tabular-nums">
                      {rc.percentage.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#777D91]">Marks</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-[#20243A] tabular-nums">
                      {rc.total_obtained}/{rc.total_max_marks}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#777D91]">Grade</p>
                    <p className="mt-0.5 font-heading text-sm font-bold text-[#20243A]">
                      {rc.grade}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-[#777D91]">
                  Standing: <strong className="text-[#21966B]">{rc.result_status}</strong> · Published{' '}
                  {format(new Date(rc.published_at), 'dd MMM yyyy')}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-[#E4E5ED] pt-4">
                <Link
                  to={`/student/report-cards?id=${rc.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#5146D8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2]"
                >
                  <span>View Report Card</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  disabled={downloadingId === rc.id}
                  onClick={() => handleDirectPdf(rc.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-xs font-semibold text-[#20243A] transition-colors hover:bg-[#F3F4F8] disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5 text-[#5146D8]" />
                  <span>{downloadingId === rc.id ? 'Exporting...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================= 3. AI INSIGHTS & TARGET CALCULATOR ========================= */
interface MathInsightsResponse {
  hasPublishedData: boolean;
  overallAveragePercentage: number;
  trendDelta: number | null;
  trendLabel: string;
  semesterTrend: Array<{
    semester: number;
    label: string;
    academicYear: string;
    className: string;
    percentage: number;
    totalObtained: number;
    totalMaxMarks: number;
    grade: string;
  }>;
  subjectPerformance: Array<{
    subjectCode: string;
    subjectName: string;
    semester: number;
    academicYear: string;
    obtainedMarks: number;
    maxMarks: number;
    percentage: number;
  }>;
  strongestSubjects: Array<{
    subjectCode: string;
    subjectName: string;
    percentage: number;
    obtainedMarks: number;
    maxMarks: number;
  }>;
  weakestSubjects: Array<{
    subjectCode: string;
    subjectName: string;
    percentage: number;
    obtainedMarks: number;
    maxMarks: number;
  }>;
  aboveAverageSubjects: Array<{ subjectCode: string; subjectName: string; percentage: number }>;
  belowAverageSubjects: Array<{ subjectCode: string; subjectName: string; percentage: number }>;
  targetProjection: {
    chosenTargetPercentage: number;
    assumedNextTermMaxMarks: number;
    nextTermMarksRequired: number;
    cumulativeTargetMarksRequired: number;
    cumulativeTargetAchievable: boolean;
  };
}

interface AiSuggestionsPayload {
  summary: string;
  focusSubjects: Array<{ subject: string; reason: string; actionStep: string }>;
  studyRecommendations: string[];
  targetPlan: string;
}

export function AiInsightsPage() {
  const { toast } = useToast();
  const [targetPercentage, setTargetPercentage] = useState(85);
  const [aiResult, setAiResult] = useState<{
    aiSuggestions: AiSuggestionsPayload;
    generatedAt: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['student-insights', targetPercentage],
    queryFn: () => apiRequest<MathInsightsResponse>(`/api/student/insights?target=${targetPercentage}`),
  });

  const aiMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ aiSuggestions: AiSuggestionsPayload; generatedAt: string }>(
        '/api/student/insights/ai',
        {
          method: 'POST',
          body: { targetPercentage },
        }
      ),
    onSuccess: (res) => {
      setAiError(null);
      setAiResult(res);
      toast('success', 'AI academic focus suggestions generated');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Unable to generate AI performance insights right now.';
      setAiError(msg);
      toast('error', 'AI Insights Unavailable', msg);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Performance Insights" description="Analyzing your published records..." />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (!data.hasPublishedData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Performance Insights"
          description="Mathematical performance analysis and AI study planning powered strictly by your published marks."
        />
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Published results required for insights"
          description="Once at least one semester result is officially published by your HOD, your subject breakdown, target calculator, and AI focus suggestions will unlock automatically."
        />
      </div>
    );
  }

  const topSubject = data.strongestSubjects[0];
  const focusSubject = data.weakestSubjects[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Analytics & AI Insights"
        description="Deterministic mathematical analysis separated clearly from AI-generated study recommendations."
      />

      {/* Section 1: Mathematical Performance Analysis */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#5146D8]" />
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-[#5146D8]">
            Mathematical Performance Analysis (Verified Published Marks)
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Cumulative Average"
            value={`${data.overallAveragePercentage.toFixed(2)}%`}
            sublabel={`Across ${data.semesterTrend.length} published semester(s)`}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="primary"
          />
          <StatCard
            label="Semester Trend"
            value={
              data.trendDelta !== null
                ? `${data.trendDelta > 0 ? '+' : ''}${data.trendDelta.toFixed(2)}%`
                : 'Baseline'
            }
            sublabel={data.trendLabel}
            icon={<History className="h-4 w-4" />}
            tone={data.trendDelta !== null && data.trendDelta < 0 ? 'warning' : 'success'}
          />
          <StatCard
            label="Strongest Subject"
            value={topSubject ? `${topSubject.percentage.toFixed(1)}%` : '—'}
            sublabel={topSubject ? `${topSubject.subjectCode} · ${topSubject.subjectName}` : ''}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <StatCard
            label="Priority Improvement Subject"
            value={focusSubject ? `${focusSubject.percentage.toFixed(1)}%` : '—'}
            sublabel={focusSubject ? `${focusSubject.subjectCode} · ${focusSubject.subjectName}` : ''}
            icon={<BookOpen className="h-4 w-4" />}
            tone="warning"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-7">
            <h3 className="font-heading text-base font-bold text-[#20243A]">
              Subject-Wise Score Breakdown (%)
            </h3>
            <p className="mt-0.5 text-xs text-[#777D91]">
              Dashed line marks your overall average ({data.overallAveragePercentage.toFixed(1)}%)
            </p>
            <div className="mt-5 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.subjectPerformance}
                  margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E5ED" vertical={false} />
                  <XAxis
                    dataKey="subjectCode"
                    tick={{ fill: '#20243A', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#777D91', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E4E5ED',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown, _name: unknown, item: { payload?: { subjectName?: string; obtainedMarks?: number; maxMarks?: number } }) => [
                      `${Number(val).toFixed(1)}% (${item?.payload?.obtainedMarks}/${item?.payload?.maxMarks})`,
                      item?.payload?.subjectName ?? 'Score',
                    ]}
                  />
                  <ReferenceLine
                    y={data.overallAveragePercentage}
                    stroke="#D99A32"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="percentage" fill="#5146D8" radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Target Percentage Calculator */}
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#5146D8]" />
              <h3 className="font-heading text-base font-bold text-[#20243A]">
                Target Percentage Calculator
              </h3>
            </div>
            <p className="mt-1 text-xs text-[#777D91]">
              Exact marks mathematically required in your next semester (assuming{' '}
              <span className="font-mono font-semibold text-[#20243A]">
                {data.targetProjection.assumedNextTermMaxMarks}
              </span>{' '}
              max marks).
            </p>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="target-slider" className="font-medium text-[#20243A]">
                  Desired Target Percentage
                </label>
                <span className="font-mono text-base font-bold text-[#5146D8] tabular-nums">
                  {targetPercentage}%
                </span>
              </div>
              <input
                id="target-slider"
                type="range"
                min={50}
                max={98}
                step={1}
                value={targetPercentage}
                onChange={(e) => setTargetPercentage(Number(e.target.value))}
                className="mt-2 w-full accent-[#5146D8]"
              />
              <div className="mt-1 flex justify-between font-mono text-[11px] text-[#777D91]">
                <span>50%</span>
                <span>75%</span>
                <span>98%</span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4">
                <p className="text-xs text-[#777D91]">Single Next-Semester Target</p>
                <p className="mt-1 font-mono text-lg font-bold text-[#20243A] tabular-nums">
                  {data.targetProjection.nextTermMarksRequired} /{' '}
                  {data.targetProjection.assumedNextTermMaxMarks} marks
                </p>
                <p className="mt-0.5 text-xs text-[#777D91]">
                  Required to score exactly {targetPercentage}% in the upcoming term.
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  data.targetProjection.cumulativeTargetAchievable
                    ? 'border-[#21966B]/30 bg-[#21966B]/6'
                    : 'border-[#D99A32]/35 bg-[#D99A32]/8'
                }`}
              >
                <p className="text-xs text-[#777D91]">To Reach {targetPercentage}% Cumulative Average</p>
                <p className="mt-1 font-mono text-lg font-bold text-[#20243A] tabular-nums">
                  {data.targetProjection.cumulativeTargetMarksRequired} /{' '}
                  {data.targetProjection.assumedNextTermMaxMarks} marks
                </p>
                <p className="mt-0.5 text-xs text-[#5A6078]">
                  {data.targetProjection.cumulativeTargetAchievable
                    ? 'Mathematically achievable in a single upcoming semester.'
                    : 'Exceeds single-term maximum; will require sustained improvement across 2+ semesters.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Semester Trend Line (if multiple or single baseline) & Above/Below Average Lists */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E4E5ED] bg-white p-6 lg:col-span-6">
            <h3 className="font-heading text-base font-bold text-[#20243A]">
              Semester-by-Semester Trajectory
            </h3>
            <div className="mt-4 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.semesterTrend}
                  margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E5ED" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#777D91', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#777D91', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E4E5ED',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown) => [`${Number(val).toFixed(2)}%`, 'Semester %']}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#4387D9"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#4387D9', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-6">
            <div className="rounded-2xl border border-[#E4E5ED] bg-white p-5">
              <h3 className="font-heading text-sm font-bold text-[#21966B]">
                Above-Average Subjects ({data.aboveAverageSubjects.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {data.aboveAverageSubjects.map((s) => (
                  <li
                    key={`${s.subjectCode}-above`}
                    className="flex items-center justify-between rounded-lg bg-[#21966B]/6 px-3 py-2 text-xs"
                  >
                    <span className="truncate pr-2 font-medium text-[#20243A]">
                      <strong className="font-mono text-[#21966B]">{s.subjectCode}</strong>{' '}
                      {s.subjectName}
                    </span>
                    <span className="font-mono font-bold text-[#21966B] tabular-nums">
                      {s.percentage.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E4E5ED] bg-white p-5">
              <h3 className="font-heading text-sm font-bold text-[#D99A32]">
                Below-Average Subjects ({data.belowAverageSubjects.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {data.belowAverageSubjects.length === 0 ? (
                  <li className="text-xs text-[#777D91]">
                    All subjects are at or above your overall average.
                  </li>
                ) : (
                  data.belowAverageSubjects.map((s) => (
                    <li
                      key={`${s.subjectCode}-below`}
                      className="flex items-center justify-between rounded-lg bg-[#D99A32]/10 px-3 py-2 text-xs"
                    >
                      <span className="truncate pr-2 font-medium text-[#20243A]">
                        <strong className="font-mono text-[#B7791F]">{s.subjectCode}</strong>{' '}
                        {s.subjectName}
                      </span>
                      <span className="font-mono font-bold text-[#B7791F] tabular-nums">
                        {s.percentage.toFixed(1)}%
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: AI Academic Focus Suggestions (Clearly Separated) */}
      <section className="rounded-2xl border border-[#5146D8]/25 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#E4E5ED] pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#5146D8]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#5146D8]">
                AI Academic Focus Suggestions
              </span>
            </div>
            <h2 className="mt-1 font-heading text-lg font-bold text-[#20243A]">
              Personalized Study Roadmap for {targetPercentage}% Target
            </h2>
            <p className="mt-0.5 text-xs text-[#777D91]">
              Generated server-side using your verified published marks only—no external or fabricated grades.
            </p>
          </div>

          <button
            type="button"
            disabled={aiMutation.isPending}
            onClick={() => aiMutation.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5146D8] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4237C2] disabled:opacity-50 shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {aiMutation.isPending
                ? 'Generating AI Plan...'
                : aiResult
                  ? 'Regenerate AI Suggestions'
                  : 'Generate AI Study Suggestions'}
            </span>
          </button>
        </div>

        {aiError && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#D99A32]/35 bg-[#D99A32]/10 p-4 text-xs text-[#20243A]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D99A32]" />
            <div>
              <p className="font-semibold">AI assistant temporarily unavailable</p>
              <p className="mt-1 text-[#5A6078]">
                {aiError} Your deterministic mathematical analysis and target calculator above remain
                100% accurate and available.
              </p>
            </div>
          </div>
        )}

        {!aiResult && !aiError && (
          <div className="mt-5 rounded-xl border border-dashed border-[#D6D8E4] bg-[#F8F9FC] p-6 text-center">
            <p className="text-sm font-medium text-[#20243A]">
              Ready to synthesize your published scores into an actionable study plan
            </p>
            <p className="mt-1 text-xs text-[#777D91]">
              Adjust your target percentage slider above, then click &ldquo;Generate AI Study Suggestions&rdquo;.
            </p>
          </div>
        )}

        {aiResult && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-[#E4E5ED] bg-[#EFECFF]/40 p-4">
              <p className="text-xs font-semibold text-[#5146D8]">Executive Summary</p>
              <p className="mt-1 text-sm leading-relaxed text-[#20243A]">
                {aiResult.aiSuggestions.summary}
              </p>
            </div>

            {aiResult.aiSuggestions.focusSubjects.length > 0 && (
              <div>
                <h3 className="font-heading text-sm font-bold text-[#20243A]">
                  Priority Focus Subjects
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {aiResult.aiSuggestions.focusSubjects.map((fs, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4"
                    >
                      <p className="text-sm font-bold text-[#20243A]">{fs.subject}</p>
                      <p className="mt-1 text-xs text-[#5A6078]">{fs.reason}</p>
                      <p className="mt-2 text-xs font-medium text-[#5146D8]">
                        Action: {fs.actionStep}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#E4E5ED] bg-white p-4">
                <h3 className="font-heading text-sm font-bold text-[#20243A]">
                  Recommended Study Habits
                </h3>
                <ul className="mt-2.5 space-y-2 text-xs text-[#454A63]">
                  {aiResult.aiSuggestions.studyRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#21966B]" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-[#E4E5ED] bg-white p-4">
                <h3 className="font-heading text-sm font-bold text-[#20243A]">
                  Target Milestone Strategy
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#454A63]">
                  {aiResult.aiSuggestions.targetPlan}
                </p>
                <p className="mt-3 font-mono text-[11px] text-[#777D91]">
                  Generated {format(new Date(aiResult.generatedAt), 'dd MMM yyyy, hh:mm a')}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

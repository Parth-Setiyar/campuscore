import { Router } from 'express';
import { z } from 'zod';
import { generateId, getDb, nowIso, runTransaction } from '../db/database.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { createNotification } from '../services/notificationService.ts';
import { recordAuditLog } from '../services/auditService.ts';
import {
  generateStudentPerformanceInsights,
  GeminiUnavailableError,
} from '../services/geminiService.ts';

const router = Router();
router.use(requireAuth, requireRole('STUDENT'));

function extractInviteToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/);
  if (match && match[1]) return match[1].toUpperCase();
  return trimmed.toUpperCase();
}

function computeStudentAnalytics(studentProfileId: string, targetPercentage: number) {
  const db = getDb();

  // Strictly ONLY published report cards belonging to this authenticated student (RULES 1 & 6)
  const reportCards = db
    .prepare(
      `SELECT rc.id, rc.report_code, rc.class_id, rc.total_max_marks, rc.total_obtained, rc.percentage, rc.grade, rc.result_status, rc.published_at,
              c.name as class_name, c.academic_year, c.semester, c.division, d.name as department_name
       FROM report_cards rc
       JOIN classes c ON c.id = rc.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE rc.student_id = ? AND c.is_published = 1
       ORDER BY c.semester ASC, rc.published_at ASC`
    )
    .all(studentProfileId) as Array<{
    id: string;
    report_code: string;
    class_id: string;
    total_max_marks: number;
    total_obtained: number;
    percentage: number;
    grade: string;
    result_status: string;
    published_at: string;
    class_name: string;
    academic_year: string;
    semester: number;
    division: string;
    department_name: string;
  }>;

  const subjectScores = db
    .prepare(
      `SELECT s.code as subject_code, s.name as subject_name, s.max_marks,
              m.obtained_marks, c.semester, c.academic_year, c.name as class_name
       FROM report_cards rc
       JOIN classes c ON c.id = rc.class_id
       JOIN subjects s ON s.class_id = c.id
       JOIN marks m ON m.subject_id = s.id AND m.student_id = rc.student_id
       WHERE rc.student_id = ? AND c.is_published = 1
       ORDER BY c.semester ASC, s.code ASC`
    )
    .all(studentProfileId) as Array<{
    subject_code: string;
    subject_name: string;
    max_marks: number;
    obtained_marks: number;
    semester: number;
    academic_year: string;
    class_name: string;
  }>;

  const subjectPerformance = subjectScores.map((s) => ({
    subjectCode: s.subject_code,
    subjectName: s.subject_name,
    semester: s.semester,
    academicYear: s.academic_year,
    obtainedMarks: s.obtained_marks,
    maxMarks: s.max_marks,
    percentage: Number(((s.obtained_marks / s.max_marks) * 100).toFixed(1)),
  }));

  const sortedByPct = [...subjectPerformance].sort((a, b) => b.percentage - a.percentage);
  const strongestSubjects = sortedByPct.slice(0, 2);
  const weakestSubjects = [...subjectPerformance].sort((a, b) => a.percentage - b.percentage).slice(0, 2);

  // Track improving/declining across semesters where comparable subjects or consecutive semesters exist
  const semesterTrend = reportCards.map((rc) => ({
    semester: rc.semester,
    label: `Sem ${rc.semester}`,
    academicYear: rc.academic_year,
    className: rc.class_name,
    percentage: rc.percentage,
    totalObtained: rc.total_obtained,
    totalMaxMarks: rc.total_max_marks,
    grade: rc.grade,
  }));

  // Group by subject name across semesters if repeated, otherwise compare each subject against overall average
  const overallAvgPct =
    reportCards.length > 0
      ? Number((reportCards.reduce((sum, r) => sum + r.percentage, 0) / reportCards.length).toFixed(2))
      : 0;

  let trendDelta: number | null = null;
  let trendLabel = 'Baseline Established';
  if (semesterTrend.length >= 2) {
    const prev = semesterTrend[semesterTrend.length - 2].percentage;
    const curr = semesterTrend[semesterTrend.length - 1].percentage;
    trendDelta = Number((curr - prev).toFixed(2));
    trendLabel = trendDelta > 0 ? 'Improving' : trendDelta < 0 ? 'Declining' : 'Steady';
  }

  const aboveAverageSubjects = subjectPerformance.filter((s) => s.percentage >= overallAvgPct);
  const belowAverageSubjects = subjectPerformance.filter((s) => s.percentage < overallAvgPct);

  // Exact mathematical calculation for target marks needed in next semester
  const nextSemesterExpectedMax =
    reportCards.length > 0 ? reportCards[reportCards.length - 1].total_max_marks : 150;
  const cumulativeMaxSoFar = reportCards.reduce((sum, r) => sum + r.total_max_marks, 0);
  const cumulativeObtainedSoFar = reportCards.reduce((sum, r) => sum + r.total_obtained, 0);

  // 1) Next-semester single-term target marks
  const nextTermTargetMarks = Number(((targetPercentage / 100) * nextSemesterExpectedMax).toFixed(1));

  // 2) Marks needed next semester to lift CUMULATIVE average to targetPercentage
  const requiredCumulativeTotal = (targetPercentage / 100) * (cumulativeMaxSoFar + nextSemesterExpectedMax);
  const marksNeededForCumulativeTarget = Number(
    (requiredCumulativeTotal - cumulativeObtainedSoFar).toFixed(1)
  );
  const cumulativeTargetAchievable = marksNeededForCumulativeTarget <= nextSemesterExpectedMax;

  return {
    hasPublishedData: reportCards.length > 0,
    overallAveragePercentage: overallAvgPct,
    trendDelta,
    trendLabel,
    semesterTrend,
    subjectPerformance,
    strongestSubjects,
    weakestSubjects,
    aboveAverageSubjects,
    belowAverageSubjects,
    targetProjection: {
      chosenTargetPercentage: targetPercentage,
      assumedNextTermMaxMarks: nextSemesterExpectedMax,
      nextTermMarksRequired: nextTermTargetMarks,
      cumulativeTargetMarksRequired: Math.max(0, marksNeededForCumulativeTarget),
      cumulativeTargetAchievable,
    },
  };
}

// GET /api/student/dashboard
router.get('/dashboard', (req: AuthRequest, res) => {
  const db = getDb();
  const studentId = req.auth!.profileId;

  const profile = db
    .prepare(
      `SELECT sp.id, sp.enrollment_number, sp.current_semester, sp.batch,
              u.full_name, u.email, d.name as department_name, d.code as department_code, d.college
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN departments d ON d.id = sp.department_id
       WHERE sp.id = ?`
    )
    .get(studentId);

  const latestReportCard = db
    .prepare(
      `SELECT rc.id, rc.report_code, rc.total_max_marks, rc.total_obtained, rc.percentage, rc.grade, rc.result_status, rc.published_at,
              c.name as class_name, c.academic_year, c.semester, c.division
       FROM report_cards rc
       JOIN classes c ON c.id = rc.class_id
       WHERE rc.student_id = ? AND c.is_published = 1
       ORDER BY rc.published_at DESC
       LIMIT 1`
    )
    .get(studentId);

  const pendingClasses = db
    .prepare(
      `SELECT c.id, c.name, c.academic_year, c.semester, c.division,
              (SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) as total_subjects,
              (SELECT COUNT(*) FROM subjects s JOIN subject_submissions ss ON ss.subject_id = s.id WHERE s.class_id = c.id AND ss.status = 'LOCKED') as locked_subjects
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.student_profile_id = ? AND cs.is_enrolled = 1 AND c.is_published = 0
       ORDER BY c.semester DESC`
    )
    .all(studentId);

  const history = db
    .prepare(
      `SELECT rc.id, c.semester, c.academic_year, c.name as class_name, rc.percentage, rc.grade, rc.result_status, rc.published_at
       FROM report_cards rc
       JOIN classes c ON c.id = rc.class_id
       WHERE rc.student_id = ? AND c.is_published = 1
       ORDER BY c.semester ASC, rc.published_at ASC`
    )
    .all(studentId);

  res.json({
    profile,
    latestReportCard: latestReportCard ?? null,
    pendingClasses,
    history,
  });
});

// GET /api/student/invitations/lookup?code=...
router.get('/invitations/lookup', (req: AuthRequest, res) => {
  const raw = String(req.query.code || '');
  if (!raw.trim()) {
    res.status(400).json({ error: 'Please enter an invitation code or link.' });
    return;
  }

  const token = extractInviteToken(raw);
  const db = getDb();

  const invite = db
    .prepare(
      `SELECT i.id, i.class_id, i.token, i.expires_at, i.is_active,
              c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.batch,
              d.name as department_name, d.college
       FROM invitations i
       JOIN classes c ON c.id = i.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE UPPER(i.token) = ?`
    )
    .get(token) as Record<string, unknown> | undefined;

  if (!invite) {
    res.status(404).json({ error: 'Invitation code not found.' });
    return;
  }
  if (invite.is_active !== 1 || new Date(invite.expires_at as string).getTime() < Date.now()) {
    res.status(410).json({ error: 'This class invitation has expired or been revoked.' });
    return;
  }

  const stu = db
    .prepare('SELECT enrollment_number FROM student_profiles WHERE id = ?')
    .get(req.auth!.profileId) as { enrollment_number: string };

  const roster = db
    .prepare('SELECT id, is_enrolled FROM class_students WHERE class_id = ? AND UPPER(enrollment_number) = UPPER(?)')
    .get(invite.class_id as string, stu.enrollment_number) as { id: string; is_enrolled: number } | undefined;

  const existingReq = db
    .prepare('SELECT status FROM student_enrollment_requests WHERE class_id = ? AND UPPER(enrollment_number) = UPPER(?)')
    .get(invite.class_id as string, stu.enrollment_number) as { status: string } | undefined;

  res.json({
    classInfo: invite,
    rosterStatus: {
      inRoster: Boolean(roster),
      alreadyEnrolled: roster?.is_enrolled === 1,
      existingRequestStatus: existingReq?.status ?? null,
    },
  });
});

// POST /api/student/join-class
const joinClassSchema = z.object({
  inviteCode: z.string().trim().min(4),
});

router.post('/join-class', (req: AuthRequest, res) => {
  const parsed = joinClassSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invitation code or link is required.' });
    return;
  }

  const token = extractInviteToken(parsed.data.inviteCode);
  const db = getDb();
  const studentProfileId = req.auth!.profileId;

  const invite = db
    .prepare(
      `SELECT i.class_id, i.expires_at, i.is_active, c.name as class_name, c.created_by_id as hod_user_id
       FROM invitations i
       JOIN classes c ON c.id = i.class_id
       WHERE UPPER(i.token) = ?`
    )
    .get(token) as
    | { class_id: string; expires_at: string; is_active: number; class_name: string; hod_user_id: string }
    | undefined;

  if (!invite || invite.is_active !== 1 || new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'This invitation link is invalid, expired, or revoked.' });
    return;
  }

  const student = db
    .prepare(
      `SELECT sp.id, sp.enrollment_number, u.full_name
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = ?`
    )
    .get(studentProfileId) as { id: string; enrollment_number: string; full_name: string };

  // RULE 2: Validate enrollment number against HOD-uploaded class roster
  const roster = db
    .prepare('SELECT id, is_enrolled FROM class_students WHERE class_id = ? AND UPPER(enrollment_number) = UPPER(?)')
    .get(invite.class_id, student.enrollment_number) as { id: string; is_enrolled: number } | undefined;

  if (!roster) {
    res.status(403).json({
      error: `Your enrollment number (${student.enrollment_number}) is not on the authorized roster for ${invite.class_name}. Contact your HOD.`,
    });
    return;
  }

  if (roster.is_enrolled === 1) {
    res.status(409).json({ error: 'You are already enrolled in this class.', status: 'ALREADY_ENROLLED' });
    return;
  }

  const existingReq = db
    .prepare('SELECT id, status FROM student_enrollment_requests WHERE class_id = ? AND UPPER(enrollment_number) = UPPER(?)')
    .get(invite.class_id, student.enrollment_number) as { id: string; status: string } | undefined;

  if (existingReq) {
    if (existingReq.status === 'PENDING') {
      res.status(409).json({
        error: 'Your enrollment request for this class is already pending HOD verification.',
        status: 'PENDING',
      });
      return;
    }
    if (existingReq.status === 'APPROVED') {
      res.status(409).json({ error: 'Your enrollment has already been approved.', status: 'APPROVED' });
      return;
    }
  }

  const now = nowIso();
  const reqId = existingReq ? existingReq.id : generateId('enrreq');

  runTransaction((tx) => {
    if (existingReq) {
      tx.prepare(
        `UPDATE student_enrollment_requests SET status = 'PENDING', decided_by = NULL, decided_at = NULL, updated_at = ? WHERE id = ?`
      ).run(now, reqId);
    } else {
      tx.prepare(
        `INSERT INTO student_enrollment_requests (id, class_id, student_profile_id, enrollment_number, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`
      ).run(reqId, invite.class_id, student.id, student.enrollment_number, now, now);
    }

    tx.prepare('UPDATE class_students SET student_profile_id = ?, updated_at = ? WHERE id = ?').run(
      student.id,
      now,
      roster.id
    );

    createNotification(
      {
        userId: invite.hod_user_id,
        type: 'ENROLLMENT_REQUEST',
        title: 'New Student Enrollment Request',
        message: `${student.full_name} (${student.enrollment_number}) requested enrollment in ${invite.class_name}.`,
        link: '/hod/enrollment-requests',
      },
      tx
    );

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'STUDENT',
        action: 'ENROLLMENT_REQUESTED',
        entityType: 'StudentEnrollmentRequest',
        entityId: reqId,
        studentEnrollment: student.enrollment_number,
        newValue: 'PENDING',
        details: `Student ${student.enrollment_number} requested enrollment in ${invite.class_name}.`,
      },
      tx
    );
  });

  res.status(201).json({
    id: reqId,
    status: 'PENDING',
    className: invite.class_name,
    message: 'Enrollment request submitted. Awaiting HOD verification.',
  });
});

// GET /api/student/enrollment-requests
router.get('/enrollment-requests', (req: AuthRequest, res) => {
  const db = getDb();
  const requests = db
    .prepare(
      `SELECT r.id, r.status, r.created_at, r.decided_at,
              c.id as class_id, c.name as class_name, c.academic_year, c.semester, c.division,
              d.name as department_name
       FROM student_enrollment_requests r
       JOIN classes c ON c.id = r.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE r.student_profile_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(req.auth!.profileId);

  res.json({ requests });
});

// GET /api/student/result-status (RULE 6: ZERO partial marks, averages, grades, or toppers before publication!)
router.get('/result-status', (req: AuthRequest, res) => {
  const db = getDb();
  const studentId = req.auth!.profileId;

  const enrolledClasses = db
    .prepare(
      `SELECT c.id, c.name, c.class_code, c.academic_year, c.semester, c.division, c.is_published,
              d.name as department_name,
              (SELECT rp.published_at FROM result_publications rp WHERE rp.class_id = c.id ORDER BY rp.version DESC LIMIT 1) as published_at,
              (SELECT rc.id FROM report_cards rc WHERE rc.class_id = c.id AND rc.student_id = ? ORDER BY rc.created_at DESC LIMIT 1) as report_card_id
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE cs.student_profile_id = ? AND cs.is_enrolled = 1
       ORDER BY c.is_published ASC, c.semester DESC`
    )
    .all(studentId, studentId) as Array<{
    id: string;
    name: string;
    class_code: string;
    academic_year: string;
    semester: number;
    division: string;
    is_published: number;
    department_name: string;
    published_at: string | null;
    report_card_id: string | null;
  }>;

  const statuses = enrolledClasses.map((cls) => {
    // Only reveal subject names and high-level lock completion (locked boolean), NEVER marks/grades/averages!
    const subjectsProgress = db
      .prepare(
        `SELECT s.code, s.name,
                CASE WHEN ss.status = 'LOCKED' THEN 1 ELSE 0 END as is_locked
         FROM subjects s
         JOIN subject_submissions ss ON ss.subject_id = s.id
         WHERE s.class_id = ?
         ORDER BY s.code ASC`
      )
      .all(cls.id) as Array<{ code: string; name: string; is_locked: number }>;

    const totalSubjects = subjectsProgress.length;
    const lockedSubjects = subjectsProgress.filter((s) => s.is_locked === 1).length;

    return {
      classId: cls.id,
      className: cls.name,
      classCode: cls.class_code,
      departmentName: cls.department_name,
      academicYear: cls.academic_year,
      semester: cls.semester,
      division: cls.division,
      isPublished: cls.is_published === 1,
      statusLabel: cls.is_published === 1 ? 'PUBLISHED' : 'AWAITING ALL SUBJECTS',
      publishedAt: cls.published_at,
      reportCardId: cls.is_published === 1 ? cls.report_card_id : null,
      totalSubjects,
      lockedSubjects,
      progressPercent: totalSubjects > 0 ? Math.round((lockedSubjects / totalSubjects) * 100) : 0,
      subjectsProgress: subjectsProgress.map((sp) => ({
        code: sp.code,
        name: sp.name,
        status: sp.is_locked === 1 ? 'Finalized' : 'Pending',
      })),
    };
  });

  res.json({ statuses });
});

// GET /api/student/report-cards (Strictly own published report cards only — RULES 1, 6, 9)
router.get('/report-cards', (req: AuthRequest, res) => {
  const db = getDb();
  const reportCards = db
    .prepare(
      `SELECT rc.id, rc.report_code, rc.total_max_marks, rc.total_obtained, rc.percentage, rc.grade, rc.result_status, rc.published_at,
              c.id as class_id, c.name as class_name, c.academic_year, c.semester, c.division, c.batch,
              d.name as department_name, d.college
       FROM report_cards rc
       JOIN classes c ON c.id = rc.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE rc.student_id = ? AND c.is_published = 1
       ORDER BY c.semester DESC, rc.published_at DESC`
    )
    .all(req.auth!.profileId);

  res.json({ reportCards });
});

// GET /api/student/report-cards/:reportCardId (STRICT OWNERSHIP CHECK AT QUERY LEVEL — RULE 1)
router.get('/report-cards/:reportCardId', (req: AuthRequest, res) => {
  const db = getDb();
  const studentId = req.auth!.profileId;

  const rc = db
    .prepare(
      `SELECT rc.id, rc.report_code, rc.publication_id, rc.class_id, rc.student_id,
              rc.total_max_marks, rc.total_obtained, rc.percentage, rc.grade, rc.result_status, rc.published_at,
              rp.version as publication_version,
              c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.batch, c.is_published,
              d.name as department_name, d.code as department_code, d.college,
              sp.enrollment_number, u.full_name as student_name
       FROM report_cards rc
       JOIN result_publications rp ON rp.id = rc.publication_id
       JOIN classes c ON c.id = rc.class_id
       JOIN departments d ON d.id = c.department_id
       JOIN student_profiles sp ON sp.id = rc.student_id
       JOIN users u ON u.id = sp.user_id
       WHERE rc.id = ? AND c.is_published = 1`
    )
    .get(req.params.reportCardId) as Record<string, unknown> | undefined;

  if (!rc) {
    res.status(404).json({ error: 'Report card not found.' });
    return;
  }

  // Explicitly block cross-student access
  if (rc.student_id !== studentId) {
    res.status(403).json({ error: 'Access denied. You can only view your own report cards.' });
    return;
  }

  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type,
              m.obtained_marks,
              ar.remark_text, ar.is_ai_drafted,
              pu.full_name as professor_name
       FROM subjects s
       JOIN marks m ON m.subject_id = s.id AND m.student_id = ?
       LEFT JOIN academic_remarks ar ON ar.subject_id = s.id AND ar.student_id = ?
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       LEFT JOIN users pu ON pu.id = p.user_id
       WHERE s.class_id = ?
       ORDER BY s.code ASC`
    )
    .all(studentId, studentId, rc.class_id as string) as Array<{
    id: string;
    code: string;
    name: string;
    max_marks: number;
    assessment_type: string;
    obtained_marks: number;
    remark_text: string | null;
    is_ai_drafted: number | null;
    professor_name: string | null;
  }>;

  // Behavioral evaluation displayed ONLY when actual authorized evaluation data exists
  const behavioral = db
    .prepare(
      `SELECT attendance, discipline, notes, updated_at
       FROM behavioral_evaluations
       WHERE class_id = ? AND student_id = ?`
    )
    .get(rc.class_id as string, studentId) as
    | { attendance: string; discipline: string; notes: string | null; updated_at: string }
    | undefined;

  res.json({
    reportCard: {
      id: rc.id,
      reportCode: rc.report_code,
      publicationVersion: rc.publication_version,
      publishedAt: rc.published_at,
      college: rc.college,
      departmentName: rc.department_name,
      departmentCode: rc.department_code,
      academicYear: rc.academic_year,
      semester: rc.semester,
      division: rc.division,
      batch: rc.batch,
      className: rc.class_name,
      studentName: rc.student_name,
      enrollmentNumber: rc.enrollment_number,
      totalMaxMarks: rc.total_max_marks,
      totalObtained: rc.total_obtained,
      percentage: rc.percentage,
      grade: rc.grade,
      resultStatus: rc.result_status,
      subjects: subjects.map((s) => ({
        subjectCode: s.code,
        subjectName: s.name,
        assessmentType: s.assessment_type,
        maxMarks: s.max_marks,
        obtainedMarks: s.obtained_marks,
        percentage: Number(((s.obtained_marks / s.max_marks) * 100).toFixed(1)),
        remarkText: s.remark_text ?? null,
        isAiDrafted: Boolean(s.is_ai_drafted),
        professorName: s.professor_name ?? null,
      })),
      behavioralEvaluation: behavioral ?? null,
    },
  });
});

// GET /api/student/insights?target=85 (Pure mathematical calculation from real published marks)
router.get('/insights', (req: AuthRequest, res) => {
  const target = Math.min(100, Math.max(40, Number(req.query.target) || 85));
  const mathInsights = computeStudentAnalytics(req.auth!.profileId, target);
  res.json(mathInsights);
});

// POST /api/student/insights/ai (Gemini-generated academic suggestions grounded strictly in real published marks)
const aiInsightsSchema = z.object({
  targetPercentage: z.coerce.number().min(40).max(100).default(85),
});

router.post('/insights/ai', async (req: AuthRequest, res) => {
  const parsed = aiInsightsSchema.safeParse(req.body ?? {});
  const target = parsed.success ? parsed.data.targetPercentage : 85;
  const studentId = req.auth!.profileId;

  const math = computeStudentAnalytics(studentId, target);
  if (!math.hasPublishedData) {
    res.status(400).json({
      error: 'No published semester results are available yet to analyze.',
    });
    return;
  }

  const db = getDb();
  const profile = db
    .prepare(
      `SELECT u.full_name, d.name as department_name, sp.current_semester
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       JOIN departments d ON d.id = sp.department_id
       WHERE sp.id = ?`
    )
    .get(studentId) as { full_name: string; department_name: string; current_semester: number };

  try {
    const aiSuggestions = await generateStudentPerformanceInsights({
      studentName: profile.full_name,
      department: profile.department_name,
      currentSemester: profile.current_semester,
      targetPercentage: target,
      semesterTrend: math.semesterTrend.map((t) => ({
        semester: t.semester,
        academicYear: t.academicYear,
        percentage: t.percentage,
      })),
      subjectPerformance: math.subjectPerformance,
      strongestSubjects: math.strongestSubjects.map((s) => `${s.subjectCode} ${s.subjectName} (${s.percentage}%)`),
      weakestSubjects: math.weakestSubjects.map((s) => `${s.subjectCode} ${s.subjectName} (${s.percentage}%)`),
      improvingTrendSummary:
        math.trendDelta !== null
          ? `${math.trendLabel} by ${math.trendDelta > 0 ? '+' : ''}${math.trendDelta}%`
          : 'Single published semester baseline',
    });

    res.json({ aiSuggestions, generatedAt: nowIso() });
  } catch (err: unknown) {
    if (err instanceof GeminiUnavailableError) {
      res.status(err.statusCode).json({ error: err.message, code: 'AI_UNAVAILABLE' });
      return;
    }
    res.status(502).json({ error: 'Unable to generate AI performance insights right now.' });
  }
});

export default router;

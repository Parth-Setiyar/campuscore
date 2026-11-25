import { Router } from 'express';
import { z } from 'zod';
import { generateId, getDb, nowIso, runTransaction } from '../db/database.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { recordAuditLog } from '../services/auditService.ts';
import { createNotification } from '../services/notificationService.ts';
import { generateAcademicRemark, GeminiUnavailableError } from '../services/geminiService.ts';

const router = Router();
router.use(requireAuth, requireRole('PROFESSOR'));

function extractInviteToken(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/);
  if (match && match[1]) return match[1].toUpperCase();
  return trimmed.toUpperCase();
}

function getAuthorizedSubject(subjectId: string, professorProfileId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.id, s.class_id, s.code, s.name, s.max_marks, s.assessment_type, s.assigned_professor_id,
              c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.is_published, c.is_archived, c.created_by_id as hod_user_id,
              d.name as department_name,
              ss.id as submission_id, ss.status as submission_status, ss.locked_at, ss.locked_by
       FROM subjects s
       JOIN classes c ON c.id = s.class_id
       JOIN departments d ON d.id = c.department_id
       JOIN subject_submissions ss ON ss.subject_id = s.id
       WHERE s.id = ? AND s.assigned_professor_id = ?`
    )
    .get(subjectId, professorProfileId) as
    | {
        id: string;
        class_id: string;
        code: string;
        name: string;
        max_marks: number;
        assessment_type: string;
        assigned_professor_id: string;
        class_name: string;
        class_code: string;
        academic_year: string;
        semester: number;
        division: string;
        is_published: number;
        is_archived: number;
        hod_user_id: string;
        department_name: string;
        submission_id: string;
        submission_status: string;
        locked_at: string | null;
        locked_by: string | null;
      }
    | undefined;
}

function computeTopper(
  rows: Array<{ studentId: string; studentName: string; enrollmentNumber: string; obtainedMarks: number | null }>
) {
  const graded = rows.filter((r) => r.obtainedMarks !== null && r.obtainedMarks !== undefined);
  if (graded.length === 0) {
    return { highestMarks: null, toppers: [], isTie: false };
  }
  const highestMarks = Math.max(...graded.map((r) => r.obtainedMarks as number));
  const toppers = graded
    .filter((r) => r.obtainedMarks === highestMarks)
    .map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      enrollmentNumber: r.enrollmentNumber,
      marks: r.obtainedMarks as number,
    }));
  return {
    highestMarks,
    toppers,
    isTie: toppers.length > 1,
  };
}

// GET /api/professor/dashboard
router.get('/dashboard', (req: AuthRequest, res) => {
  const db = getDb();
  const profId = req.auth!.profileId;

  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type,
              c.id as class_id, c.name as class_name, c.academic_year, c.semester, c.division, c.is_published, c.is_archived,
              d.name as department_name,
              ss.status as submission_status, ss.locked_at, ss.updated_at as last_updated,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.is_enrolled = 1) as student_count,
              (SELECT COUNT(*) FROM marks m
               JOIN class_students cs ON cs.student_profile_id = m.student_id AND cs.class_id = c.id AND cs.is_enrolled = 1
               WHERE m.subject_id = s.id) as marks_entered
       FROM subjects s
       JOIN classes c ON c.id = s.class_id
       JOIN departments d ON d.id = c.department_id
       JOIN subject_submissions ss ON ss.subject_id = s.id
       WHERE s.assigned_professor_id = ?
       ORDER BY c.is_archived ASC, c.semester DESC, s.code ASC`
    )
    .all(profId) as Array<Record<string, unknown>>;

  const activeSubjects = subjects.filter((s) => s.is_archived === 0);
  const distinctClasses = new Set(activeSubjects.map((s) => s.class_id)).size;
  const pendingSubmissions = activeSubjects.filter((s) => s.submission_status !== 'LOCKED').length;
  const lockedSubmissions = activeSubjects.filter((s) => s.submission_status === 'LOCKED').length;

  const pendingRequests = (
    db
      .prepare("SELECT COUNT(*) as c FROM professor_subject_requests WHERE professor_id = ? AND status = 'PENDING'")
      .get(profId) as { c: number }
  ).c;

  res.json({
    stats: {
      assignedClasses: distinctClasses,
      assignedSubjects: activeSubjects.length,
      pendingSubmissions,
      lockedSubmissions,
      pendingRequests,
    },
    activeSubjects,
  });
});

// GET /api/professor/classes (Active) & /api/professor/archive (Published/Archived)
router.get('/classes', (req: AuthRequest, res) => {
  const db = getDb();
  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type,
              c.id as class_id, c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.batch, c.is_published, c.is_archived,
              d.name as department_name,
              ss.status as submission_status, ss.locked_at, ss.updated_at as last_updated,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.is_enrolled = 1) as student_count,
              (SELECT COUNT(*) FROM marks m
               JOIN class_students cs ON cs.student_profile_id = m.student_id AND cs.class_id = c.id AND cs.is_enrolled = 1
               WHERE m.subject_id = s.id) as marks_entered
       FROM subjects s
       JOIN classes c ON c.id = s.class_id
       JOIN departments d ON d.id = c.department_id
       JOIN subject_submissions ss ON ss.subject_id = s.id
       WHERE s.assigned_professor_id = ? AND c.is_archived = 0
       ORDER BY c.semester DESC, s.code ASC`
    )
    .all(req.auth!.profileId);

  res.json({ subjects });
});

router.get('/archive', (req: AuthRequest, res) => {
  const db = getDb();
  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type,
              c.id as class_id, c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.batch, c.is_published, c.is_archived,
              d.name as department_name,
              ss.status as submission_status, ss.locked_at,
              (SELECT rp.published_at FROM result_publications rp WHERE rp.class_id = c.id ORDER BY rp.version DESC LIMIT 1) as published_at,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.is_enrolled = 1) as student_count,
              (SELECT COUNT(*) FROM marks m WHERE m.subject_id = s.id) as marks_entered
       FROM subjects s
       JOIN classes c ON c.id = s.class_id
       JOIN departments d ON d.id = c.department_id
       JOIN subject_submissions ss ON ss.subject_id = s.id
       WHERE s.assigned_professor_id = ? AND (c.is_archived = 1 OR c.is_published = 1)
       ORDER BY c.academic_year DESC, c.semester DESC, s.code ASC`
    )
    .all(req.auth!.profileId);

  res.json({ subjects });
});

// GET /api/professor/invitations/lookup?code=...
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
              c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.batch, c.is_published,
              d.name as department_name
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
    res.status(410).json({ error: 'This invitation link has expired or been revoked.' });
    return;
  }

  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type, s.assigned_professor_id,
              u.full_name as assigned_professor_name
       FROM subjects s
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE s.class_id = ?
       ORDER BY s.code ASC`
    )
    .all(invite.class_id as string);

  res.json({ classInfo: invite, subjects });
});

// POST /api/professor/join-request
const joinRequestSchema = z.object({
  inviteCode: z.string().trim().min(4),
  subjectId: z.string().trim().min(2),
  note: z.string().trim().max(300).optional().default(''),
});

router.post('/join-request', (req: AuthRequest, res) => {
  const parsed = joinRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' });
    return;
  }

  const token = extractInviteToken(parsed.data.inviteCode);
  const db = getDb();
  const profId = req.auth!.profileId;

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
    res.status(410).json({ error: 'Invalid or expired class invitation.' });
    return;
  }

  const subject = db
    .prepare('SELECT id, code, name, assigned_professor_id FROM subjects WHERE id = ? AND class_id = ?')
    .get(parsed.data.subjectId, invite.class_id) as
    | { id: string; code: string; name: string; assigned_professor_id: string | null }
    | undefined;

  if (!subject) {
    res.status(404).json({ error: 'Selected subject does not belong to this class.' });
    return;
  }

  if (subject.assigned_professor_id === profId) {
    res.status(409).json({ error: 'You are already authorized and assigned to this subject.' });
    return;
  }

  const existingReq = db
    .prepare('SELECT id, status FROM professor_subject_requests WHERE professor_id = ? AND subject_id = ?')
    .get(profId, subject.id) as { id: string; status: string } | undefined;

  if (existingReq && existingReq.status === 'PENDING') {
    res.status(409).json({ error: 'You already have a pending access request for this subject.' });
    return;
  }

  const profUser = db
    .prepare('SELECT full_name FROM users WHERE id = ?')
    .get(req.auth!.userId) as { full_name: string };

  const now = nowIso();
  const reqId = existingReq ? existingReq.id : generateId('preq');

  runTransaction((tx) => {
    if (existingReq) {
      tx.prepare(
        `UPDATE professor_subject_requests SET status = 'PENDING', note = ?, decided_by = NULL, decided_at = NULL, updated_at = ? WHERE id = ?`
      ).run(parsed.data.note || null, now, reqId);
    } else {
      tx.prepare(
        `INSERT INTO professor_subject_requests (id, professor_id, class_id, subject_id, status, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`
      ).run(reqId, profId, invite.class_id, subject.id, parsed.data.note || null, now, now);
    }

    createNotification(
      {
        userId: invite.hod_user_id,
        type: 'PROFESSOR_SUBJECT_REQUEST',
        title: `Subject Access Request: ${subject.code}`,
        message: `${profUser.full_name} requested access to ${subject.code} — ${subject.name} in ${invite.class_name}.`,
        link: '/hod/subject-permissions',
      },
      tx
    );

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'PROFESSOR',
        action: 'PROFESSOR_SUBJECT_REQUESTED',
        entityType: 'ProfessorSubjectRequest',
        entityId: reqId,
        subjectId: subject.id,
        newValue: 'PENDING',
        details: `${profUser.full_name} requested authorization for ${subject.code} in ${invite.class_name}.`,
      },
      tx
    );
  });

  res.status(201).json({ id: reqId, status: 'PENDING', message: 'Access request submitted to HOD.' });
});

// GET /api/professor/my-requests
router.get('/my-requests', (req: AuthRequest, res) => {
  const db = getDb();
  const requests = db
    .prepare(
      `SELECT r.id, r.status, r.note, r.created_at, r.decided_at,
              c.name as class_name, c.academic_year, c.semester, c.division,
              s.code as subject_code, s.name as subject_name
       FROM professor_subject_requests r
       JOIN classes c ON c.id = r.class_id
       JOIN subjects s ON s.id = r.subject_id
       WHERE r.professor_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(req.auth!.profileId);

  res.json({ requests });
});

// GET /api/professor/subjects/:subjectId/marks
router.get('/subjects/:subjectId/marks', (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sp.id as student_id, sp.enrollment_number, u.full_name as student_name,
              m.id as mark_id, m.obtained_marks, m.updated_at as mark_updated_at,
              ar.remark_text, ar.is_ai_drafted, ar.updated_at as remark_updated_at
       FROM class_students cs
       JOIN student_profiles sp ON sp.id = cs.student_profile_id
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN marks m ON m.subject_id = ? AND m.student_id = sp.id
       LEFT JOIN academic_remarks ar ON ar.subject_id = ? AND ar.student_id = sp.id
       WHERE cs.class_id = ? AND cs.is_enrolled = 1
       ORDER BY sp.enrollment_number ASC`
    )
    .all(subject.id, subject.id, subject.class_id) as Array<{
    student_id: string;
    enrollment_number: string;
    student_name: string;
    mark_id: string | null;
    obtained_marks: number | null;
    mark_updated_at: string | null;
    remark_text: string | null;
    is_ai_drafted: number | null;
    remark_updated_at: string | null;
  }>;

  const students = rows.map((r, index) => ({
    serialNo: index + 1,
    studentId: r.student_id,
    enrollmentNumber: r.enrollment_number,
    studentName: r.student_name,
    maxMarks: subject.max_marks,
    obtainedMarks: r.obtained_marks,
    status: r.obtained_marks !== null && r.obtained_marks !== undefined ? 'Entered' : 'Pending',
    markUpdatedAt: r.mark_updated_at,
    remarkText: r.remark_text ?? '',
    isAiDrafted: Boolean(r.is_ai_drafted),
  }));

  const topper = computeTopper(students);

  res.json({
    subject,
    students,
    topper,
    summary: {
      totalStudents: students.length,
      enteredCount: students.filter((s) => s.obtainedMarks !== null).length,
      missingCount: students.filter((s) => s.obtainedMarks === null).length,
    },
  });
});

// PUT /api/professor/subjects/:subjectId/marks (Inline edit / autosave / batch save)
const upsertMarksSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        obtainedMarks: z.number().finite(),
      })
    )
    .min(1),
});

router.put('/subjects/:subjectId/marks', (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }

  // RULE 5: Locked subject cannot be edited through normal professor operations
  if (subject.submission_status === 'LOCKED') {
    res.status(403).json({
      error: 'This subject is locked and cannot be edited. Contact the HOD if an authorized correction is required.',
    });
    return;
  }
  if (subject.is_published === 1 || subject.is_archived === 1) {
    res.status(403).json({ error: 'Archived or published classes are read-only.' });
    return;
  }

  const parsed = upsertMarksSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid marks input.' });
    return;
  }

  // RULE 4: Marks must be between 0 and configured max_marks
  for (const entry of parsed.data.entries) {
    if (entry.obtainedMarks < 0) {
      res.status(400).json({ error: 'Obtained marks cannot be negative.' });
      return;
    }
    if (entry.obtainedMarks > subject.max_marks) {
      res.status(400).json({
        error: `Obtained marks (${entry.obtainedMarks}) cannot exceed maximum marks (${subject.max_marks}).`,
      });
      return;
    }
  }

  const now = nowIso();
  try {
    const summary = runTransaction((tx) => {
      const enrolledStmt = tx.prepare(
        `SELECT sp.id, sp.enrollment_number
         FROM class_students cs
         JOIN student_profiles sp ON sp.id = cs.student_profile_id
         WHERE cs.class_id = ? AND cs.is_enrolled = 1 AND sp.id = ?`
      );
      const existingMarkStmt = tx.prepare(
        'SELECT id, obtained_marks FROM marks WHERE subject_id = ? AND student_id = ?'
      );

      let updatedCount = 0;

      for (const entry of parsed.data.entries) {
        const stu = enrolledStmt.get(subject.class_id, entry.studentId) as
          | { id: string; enrollment_number: string }
          | undefined;
        if (!stu) {
          throw Object.assign(new Error(`Student ${entry.studentId} is not enrolled in this class.`), {
            statusCode: 400,
          });
        }

        const roundedMarks = Number(entry.obtainedMarks.toFixed(2));
        const existing = existingMarkStmt.get(subject.id, stu.id) as
          | { id: string; obtained_marks: number }
          | undefined;

        if (!existing) {
          const markId = generateId('mrk');
          tx.prepare(
            `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(markId, subject.id, stu.id, roundedMarks, req.auth!.userId, now, now);

          recordAuditLog(
            {
              actorUserId: req.auth!.userId,
              actorRole: 'PROFESSOR',
              action: 'MARKS_CREATED',
              entityType: 'Marks',
              entityId: markId,
              subjectId: subject.id,
              studentEnrollment: stu.enrollment_number,
              previousValue: null,
              newValue: `${roundedMarks} / ${subject.max_marks}`,
              details: `Entered marks for ${stu.enrollment_number} in ${subject.code}.`,
            },
            tx
          );
          updatedCount++;
        } else if (existing.obtained_marks !== roundedMarks) {
          tx.prepare('UPDATE marks SET obtained_marks = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
            roundedMarks,
            req.auth!.userId,
            now,
            existing.id
          );

          recordAuditLog(
            {
              actorUserId: req.auth!.userId,
              actorRole: 'PROFESSOR',
              action: 'MARKS_UPDATED',
              entityType: 'Marks',
              entityId: existing.id,
              subjectId: subject.id,
              studentEnrollment: stu.enrollment_number,
              previousValue: `${existing.obtained_marks} / ${subject.max_marks}`,
              newValue: `${roundedMarks} / ${subject.max_marks}`,
              details: `Updated marks for ${stu.enrollment_number} in ${subject.code}.`,
            },
            tx
          );
          updatedCount++;
        }
      }

      // Recalculate submission status automatically
      const totalStudents = (
        tx
          .prepare('SELECT COUNT(*) as c FROM class_students WHERE class_id = ? AND is_enrolled = 1')
          .get(subject.class_id) as { c: number }
      ).c;
      const enteredStudents = (
        tx
          .prepare(
            `SELECT COUNT(*) as c FROM marks m
             JOIN class_students cs ON cs.student_profile_id = m.student_id AND cs.class_id = ? AND cs.is_enrolled = 1
             WHERE m.subject_id = ?`
          )
          .get(subject.class_id, subject.id) as { c: number }
      ).c;

      const nextStatus =
        enteredStudents === 0
          ? 'NOT_STARTED'
          : enteredStudents >= totalStudents && totalStudents > 0
            ? 'SUBMITTED'
            : 'IN_PROGRESS';

      tx.prepare('UPDATE subject_submissions SET status = ?, updated_at = ? WHERE subject_id = ?').run(
        nextStatus,
        now,
        subject.id
      );

      // Recompute live topper
      const allMarks = tx
        .prepare(
          `SELECT sp.id as studentId, u.full_name as studentName, sp.enrollment_number as enrollmentNumber, m.obtained_marks as obtainedMarks
           FROM class_students cs
           JOIN student_profiles sp ON sp.id = cs.student_profile_id
           JOIN users u ON u.id = sp.user_id
           LEFT JOIN marks m ON m.subject_id = ? AND m.student_id = sp.id
           WHERE cs.class_id = ? AND cs.is_enrolled = 1`
        )
        .all(subject.id, subject.class_id) as Array<{
        studentId: string;
        studentName: string;
        enrollmentNumber: string;
        obtainedMarks: number | null;
      }>;

      return {
        updatedCount,
        submissionStatus: nextStatus,
        enteredCount: enteredStudents,
        totalStudents,
        topper: computeTopper(allMarks),
        savedAt: now,
      };
    });

    res.json(summary);
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
    const message = err instanceof Error ? err.message : 'Failed to save marks.';
    res.status(statusCode).json({ error: message });
  }
});

// POST /api/professor/subjects/:subjectId/import-preview
const importPreviewSchema = z.object({
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        enrollmentNumber: z.string(),
        studentName: z.string().optional().default(''),
        marksRaw: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .min(1, 'Spreadsheet contains no data rows.'),
});

router.post('/subjects/:subjectId/import-preview', (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }
  if (subject.submission_status === 'LOCKED' || subject.is_published === 1) {
    res.status(403).json({ error: 'Subject is locked or published and cannot accept Excel imports.' });
    return;
  }

  const parsed = importPreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid spreadsheet rows.' });
    return;
  }

  const db = getDb();
  const enrolled = db
    .prepare(
      `SELECT sp.id as student_id, UPPER(sp.enrollment_number) as enrollment_number, u.full_name as student_name,
              m.obtained_marks as existing_marks
       FROM class_students cs
       JOIN student_profiles sp ON sp.id = cs.student_profile_id
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN marks m ON m.subject_id = ? AND m.student_id = sp.id
       WHERE cs.class_id = ? AND cs.is_enrolled = 1`
    )
    .all(subject.id, subject.class_id) as Array<{
    student_id: string;
    enrollment_number: string;
    student_name: string;
    existing_marks: number | null;
  }>;

  const enrolledMap = new Map(enrolled.map((e) => [e.enrollment_number, e]));
  const seenInFile = new Map<string, number>();

  const evaluatedRows = parsed.data.rows.map((row) => {
    const enr = String(row.enrollmentNumber || '').trim().toUpperCase();
    const errors: string[] = [];

    if (!enr) {
      errors.push('Missing enrollment number.');
    }

    if (enr && seenInFile.has(enr)) {
      errors.push(`Duplicate enrollment number (already appears on row ${seenInFile.get(enr)}).`);
    } else if (enr) {
      seenInFile.set(enr, row.rowNumber);
    }

    const stu = enr ? enrolledMap.get(enr) : undefined;
    if (enr && !stu) {
      errors.push('Enrollment number is not enrolled in this class.');
    }

    const marksNum =
      row.marksRaw === null || row.marksRaw === '' ? NaN : Number(String(row.marksRaw).trim());
    if (Number.isNaN(marksNum) || !Number.isFinite(marksNum)) {
      errors.push('Invalid numeric marks value.');
    } else if (marksNum < 0) {
      errors.push('Marks cannot be negative.');
    } else if (marksNum > subject.max_marks) {
      errors.push(`Marks (${marksNum}) exceed maximum marks (${subject.max_marks}).`);
    }

    const hasConflict =
      errors.length === 0 &&
      stu !== undefined &&
      stu.existing_marks !== null &&
      stu.existing_marks !== undefined &&
      stu.existing_marks !== Number(marksNum.toFixed(2));

    return {
      rowNumber: row.rowNumber,
      enrollmentNumber: enr,
      studentId: stu?.student_id ?? null,
      studentName: stu?.student_name ?? row.studentName ?? '',
      importedMarks: Number.isFinite(marksNum) ? Number(marksNum.toFixed(2)) : null,
      existingMarks: stu?.existing_marks ?? null,
      hasConflict,
      errors,
      status: errors.length > 0 ? 'ERROR' : hasConflict ? 'CONFLICT' : 'READY',
    };
  });

  const importedEnrollmentSet = new Set(
    evaluatedRows.filter((r) => r.errors.length === 0).map((r) => r.enrollmentNumber)
  );
  const missingStudents = enrolled
    .filter((e) => !importedEnrollmentSet.has(e.enrollment_number))
    .map((e) => ({
      studentId: e.student_id,
      enrollmentNumber: e.enrollment_number,
      studentName: e.student_name,
    }));

  res.json({
    subject: { id: subject.id, code: subject.code, name: subject.name, maxMarks: subject.max_marks },
    rows: evaluatedRows,
    summary: {
      totalRows: evaluatedRows.length,
      readyCount: evaluatedRows.filter((r) => r.status === 'READY').length,
      conflictCount: evaluatedRows.filter((r) => r.status === 'CONFLICT').length,
      errorCount: evaluatedRows.filter((r) => r.status === 'ERROR').length,
      missingStudentsCount: missingStudents.length,
    },
    missingStudents,
  });
});

// POST /api/professor/subjects/:subjectId/import-confirm
const importConfirmSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        obtainedMarks: z.number().finite(),
        overwrite: z.boolean().default(false),
      })
    )
    .min(1),
});

router.post('/subjects/:subjectId/import-confirm', (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }
  if (subject.submission_status === 'LOCKED' || subject.is_published === 1) {
    res.status(403).json({ error: 'Cannot import marks into a locked or published subject.' });
    return;
  }

  const parsed = importConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid import confirmation payload.' });
    return;
  }

  for (const e of parsed.data.entries) {
    if (e.obtainedMarks < 0 || e.obtainedMarks > subject.max_marks) {
      res.status(400).json({
        error: `Marks (${e.obtainedMarks}) must be between 0 and ${subject.max_marks}.`,
      });
      return;
    }
  }

  const now = nowIso();
  const result = runTransaction((tx) => {
    let created = 0;
    let overwritten = 0;
    let skipped = 0;

    for (const item of parsed.data.entries) {
      const stu = tx
        .prepare(
          `SELECT sp.id, sp.enrollment_number
           FROM class_students cs
           JOIN student_profiles sp ON sp.id = cs.student_profile_id
           WHERE cs.class_id = ? AND cs.is_enrolled = 1 AND sp.id = ?`
        )
        .get(subject.class_id, item.studentId) as { id: string; enrollment_number: string } | undefined;

      if (!stu) continue;

      const existing = tx
        .prepare('SELECT id, obtained_marks FROM marks WHERE subject_id = ? AND student_id = ?')
        .get(subject.id, stu.id) as { id: string; obtained_marks: number } | undefined;

      const rounded = Number(item.obtainedMarks.toFixed(2));

      if (!existing) {
        const markId = generateId('mrk');
        tx.prepare(
          `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(markId, subject.id, stu.id, rounded, req.auth!.userId, now, now);

        recordAuditLog(
          {
            actorUserId: req.auth!.userId,
            actorRole: 'PROFESSOR',
            action: 'MARKS_IMPORTED_EXCEL',
            entityType: 'Marks',
            entityId: markId,
            subjectId: subject.id,
            studentEnrollment: stu.enrollment_number,
            previousValue: null,
            newValue: `${rounded} / ${subject.max_marks}`,
            details: `Imported marks via Excel for ${stu.enrollment_number} in ${subject.code}.`,
          },
          tx
        );
        created++;
      } else if (existing.obtained_marks === rounded) {
        skipped++;
      } else if (item.overwrite) {
        tx.prepare('UPDATE marks SET obtained_marks = ?, updated_by = ?, updated_at = ? WHERE id = ?').run(
          rounded,
          req.auth!.userId,
          now,
          existing.id
        );

        recordAuditLog(
          {
            actorUserId: req.auth!.userId,
            actorRole: 'PROFESSOR',
            action: 'MARKS_OVERWRITTEN_EXCEL',
            entityType: 'Marks',
            entityId: existing.id,
            subjectId: subject.id,
            studentEnrollment: stu.enrollment_number,
            previousValue: `${existing.obtained_marks} / ${subject.max_marks}`,
            newValue: `${rounded} / ${subject.max_marks}`,
            details: `Explicitly overwrote existing marks via Excel import for ${stu.enrollment_number} in ${subject.code}.`,
          },
          tx
        );
        overwritten++;
      } else {
        // Never silently overwrite existing marks
        skipped++;
      }
    }

    const totalStudents = (
      tx
        .prepare('SELECT COUNT(*) as c FROM class_students WHERE class_id = ? AND is_enrolled = 1')
        .get(subject.class_id) as { c: number }
    ).c;
    const enteredStudents = (
      tx
        .prepare(
          `SELECT COUNT(*) as c FROM marks m
           JOIN class_students cs ON cs.student_profile_id = m.student_id AND cs.class_id = ? AND cs.is_enrolled = 1
           WHERE m.subject_id = ?`
        )
        .get(subject.class_id, subject.id) as { c: number }
    ).c;

    const nextStatus =
      enteredStudents === 0
        ? 'NOT_STARTED'
        : enteredStudents >= totalStudents && totalStudents > 0
          ? 'SUBMITTED'
          : 'IN_PROGRESS';

    tx.prepare('UPDATE subject_submissions SET status = ?, updated_at = ? WHERE subject_id = ?').run(
      nextStatus,
      now,
      subject.id
    );

    return { created, overwritten, skipped, submissionStatus: nextStatus };
  });

  res.json(result);
});

// POST /api/professor/subjects/:subjectId/remarks/generate
const generateRemarkSchema = z.object({
  studentId: z.string().min(1),
});

router.post('/subjects/:subjectId/remarks/generate', async (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }

  const parsed = generateRemarkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'studentId is required.' });
    return;
  }

  const db = getDb();
  const studentRow = db
    .prepare(
      `SELECT sp.id, sp.enrollment_number, u.full_name, m.obtained_marks
       FROM class_students cs
       JOIN student_profiles sp ON sp.id = cs.student_profile_id
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN marks m ON m.subject_id = ? AND m.student_id = sp.id
       WHERE cs.class_id = ? AND cs.is_enrolled = 1 AND sp.id = ?`
    )
    .get(subject.id, subject.class_id, parsed.data.studentId) as
    | { id: string; enrollment_number: string; full_name: string; obtained_marks: number | null }
    | undefined;

  if (!studentRow) {
    res.status(404).json({ error: 'Student not found in this class.' });
    return;
  }

  if (studentRow.obtained_marks === null || studentRow.obtained_marks === undefined) {
    res.status(400).json({ error: 'Enter marks for this student before generating an academic remark.' });
    return;
  }

  const avgRow = db
    .prepare('SELECT AVG(obtained_marks) as avg_marks FROM marks WHERE subject_id = ?')
    .get(subject.id) as { avg_marks: number | null };

  const histRow = db
    .prepare(
      `SELECT AVG(percentage) as hist_pct FROM report_cards WHERE student_id = ?`
    )
    .get(studentRow.id) as { hist_pct: number | null };

  try {
    const remarkText = await generateAcademicRemark({
      studentName: studentRow.full_name,
      enrollmentNumber: studentRow.enrollment_number,
      subjectCode: subject.code,
      subjectName: subject.name,
      obtainedMarks: studentRow.obtained_marks,
      maxMarks: subject.max_marks,
      classAverage: avgRow.avg_marks,
      historicalOverallPercentage: histRow.hist_pct,
    });

    res.json({ studentId: studentRow.id, remarkText, isAiDrafted: true });
  } catch (err: unknown) {
    if (err instanceof GeminiUnavailableError) {
      res.status(err.statusCode).json({ error: err.message, code: 'AI_UNAVAILABLE' });
      return;
    }
    res.status(502).json({ error: 'Unable to generate AI remark. Please enter remark manually.' });
  }
});

// PUT /api/professor/subjects/:subjectId/remarks
const saveRemarkSchema = z.object({
  studentId: z.string().min(1),
  remarkText: z.string().trim().min(5, 'Remark must be at least 5 characters.').max(600),
  isAiDrafted: z.boolean().optional().default(false),
});

router.put('/subjects/:subjectId/remarks', (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }
  if (subject.submission_status === 'LOCKED' || subject.is_published === 1) {
    res.status(403).json({ error: 'Cannot edit remarks after the subject is locked or published.' });
    return;
  }

  const parsed = saveRemarkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid remark.' });
    return;
  }

  const db = getDb();
  const now = nowIso();
  const existing = db
    .prepare('SELECT id FROM academic_remarks WHERE subject_id = ? AND student_id = ?')
    .get(subject.id, parsed.data.studentId) as { id: string } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE academic_remarks SET remark_text = ?, is_ai_drafted = ?, professor_id = ?, updated_at = ? WHERE id = ?`
    ).run(parsed.data.remarkText, parsed.data.isAiDrafted ? 1 : 0, req.auth!.profileId, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO academic_remarks (id, subject_id, student_id, professor_id, remark_text, is_ai_drafted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateId('rmk'),
      subject.id,
      parsed.data.studentId,
      req.auth!.profileId,
      parsed.data.remarkText,
      parsed.data.isAiDrafted ? 1 : 0,
      now,
      now
    );
  }

  res.json({ message: 'Academic remark saved.', updatedAt: now });
});

// POST /api/professor/subjects/:subjectId/lock
router.post('/subjects/:subjectId/lock', (req: AuthRequest, res) => {
  const subject = getAuthorizedSubject(req.params.subjectId, req.auth!.profileId);
  if (!subject) {
    res.status(403).json({ error: 'Access denied. You are not authorized for this subject.' });
    return;
  }
  if (subject.submission_status === 'LOCKED') {
    res.status(409).json({ error: 'Subject is already locked.' });
    return;
  }
  if (subject.is_published === 1) {
    res.status(400).json({ error: 'Class results are already published.' });
    return;
  }

  const db = getDb();
  const enrolled = db
    .prepare(
      `SELECT sp.id as student_id, sp.enrollment_number, u.full_name as student_name, m.obtained_marks
       FROM class_students cs
       JOIN student_profiles sp ON sp.id = cs.student_profile_id
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN marks m ON m.subject_id = ? AND m.student_id = sp.id
       WHERE cs.class_id = ? AND cs.is_enrolled = 1`
    )
    .all(subject.id, subject.class_id) as Array<{
    student_id: string;
    enrollment_number: string;
    student_name: string;
    obtained_marks: number | null;
  }>;

  if (enrolled.length === 0) {
    res.status(400).json({ error: 'Cannot lock a subject with zero enrolled students.' });
    return;
  }

  const missing = enrolled.filter((e) => e.obtained_marks === null || e.obtained_marks === undefined);
  if (missing.length > 0) {
    res.status(400).json({
      error: `Cannot lock subject. ${missing.length} student(s) still have missing marks (${missing
        .slice(0, 5)
        .map((m) => m.enrollment_number)
        .join(', ')}).`,
      missingStudents: missing.map((m) => ({
        enrollmentNumber: m.enrollment_number,
        studentName: m.student_name,
      })),
    });
    return;
  }

  const outOfRange = enrolled.filter(
    (e) => (e.obtained_marks as number) < 0 || (e.obtained_marks as number) > subject.max_marks
  );
  if (outOfRange.length > 0) {
    res.status(400).json({ error: 'Some students have invalid marks outside 0 to maximum marks.' });
    return;
  }

  const profUser = db
    .prepare('SELECT full_name FROM users WHERE id = ?')
    .get(req.auth!.userId) as { full_name: string };

  const now = nowIso();
  runTransaction((tx) => {
    tx.prepare(
      `UPDATE subject_submissions
       SET status = 'LOCKED', professor_id = ?, locked_at = ?, locked_by = ?, updated_at = ?
       WHERE subject_id = ?`
    ).run(req.auth!.profileId, now, req.auth!.userId, now, subject.id);

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'PROFESSOR',
        action: 'SUBJECT_LOCKED',
        entityType: 'SubjectSubmission',
        entityId: subject.submission_id,
        subjectId: subject.id,
        previousValue: subject.submission_status,
        newValue: 'LOCKED',
        details: `${profUser.full_name} finalized and locked ${subject.code} (${enrolled.length}/${enrolled.length} students graded).`,
      },
      tx
    );

    createNotification(
      {
        userId: subject.hod_user_id,
        type: 'SUBJECT_LOCKED',
        title: `Subject Locked: ${subject.code}`,
        message: `${profUser.full_name} locked ${subject.code} — ${subject.name} for ${subject.class_name}.`,
        link: '/hod/lock-tracker',
      },
      tx
    );
  });

  res.json({
    message: 'Subject marks verified and locked successfully.',
    lockedAt: now,
    lockedBy: profUser.full_name,
  });
});

export default router;

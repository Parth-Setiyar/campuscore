import { Router } from 'express';
import { z } from 'zod';
import {
  calculateGrade,
  generateId,
  generateInviteToken,
  getDb,
  nowIso,
  runTransaction,
} from '../db/database.ts';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { recordAuditLog } from '../services/auditService.ts';
import { createNotification } from '../services/notificationService.ts';

const router = Router();
router.use(requireAuth, requireRole('HOD'));

const createClassSchema = z.object({
  departmentId: z.string().min(1),
  academicYear: z.string().trim().min(4).max(20),
  semester: z.coerce.number().int().min(1).max(12),
  division: z.string().trim().min(1).max(10),
  batch: z.string().trim().min(2).max(30),
  name: z.string().trim().min(3).max(120),
  inviteExpiresInDays: z.coerce.number().int().min(1).max(365).optional().default(30),
  subjects: z
    .array(
      z.object({
        code: z.string().trim().min(2).max(24),
        name: z.string().trim().min(2).max(120),
        maxMarks: z.coerce.number().positive().max(1000),
        assessmentType: z.string().trim().min(2).max(80).default('Mid-Semester Examination'),
        assignedProfessorId: z.string().trim().nullable().optional(),
      })
    )
    .min(1, 'At least one subject is required.'),
  roster: z
    .array(
      z.object({
        enrollmentNumber: z.string().trim().min(3).max(40),
        rosterName: z.string().trim().max(120).optional().default(''),
      })
    )
    .min(1, 'At least one student enrollment number is required in the roster.'),
});

// GET /api/hod/dashboard
router.get('/dashboard', (_req, res) => {
  const db = getDb();

  const totalClasses = (db.prepare('SELECT COUNT(*) as c FROM classes').get() as { c: number }).c;
  const totalStudents = (db.prepare('SELECT COUNT(*) as c FROM student_profiles').get() as { c: number }).c;
  const totalProfessors = (db.prepare('SELECT COUNT(*) as c FROM professor_profiles').get() as { c: number }).c;
  const subjectsPending = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM subject_submissions ss
         JOIN subjects s ON s.id = ss.subject_id
         JOIN classes cl ON cl.id = s.class_id
         WHERE cl.is_published = 0 AND ss.status != 'LOCKED'`
      )
      .get() as { c: number }
  ).c;
  const resultsPublished = (
    db.prepare('SELECT COUNT(*) as c FROM result_publications').get() as { c: number }
  ).c;
  const pendingSubjectReqs = (
    db.prepare("SELECT COUNT(*) as c FROM professor_subject_requests WHERE status = 'PENDING'").get() as { c: number }
  ).c;
  const pendingEnrollmentReqs = (
    db.prepare("SELECT COUNT(*) as c FROM student_enrollment_requests WHERE status = 'PENDING'").get() as { c: number }
  ).c;

  const classesSummary = db
    .prepare(
      `SELECT c.id, c.class_code, c.name, c.academic_year, c.semester, c.division, c.batch,
              c.is_published, c.is_archived, d.name as department_name, d.code as department_code,
              (SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) as total_subjects,
              (SELECT COUNT(*) FROM subjects s JOIN subject_submissions ss ON ss.subject_id = s.id WHERE s.class_id = c.id AND ss.status = 'LOCKED') as locked_subjects,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.is_enrolled = 1) as enrolled_students,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) as roster_count
       FROM classes c
       JOIN departments d ON d.id = c.department_id
       ORDER BY c.is_published ASC, c.created_at DESC`
    )
    .all();

  const recentActivity = db
    .prepare(
      `SELECT a.id, a.action, a.actor_role, a.entity_type, a.student_enrollment, a.previous_value, a.new_value, a.details, a.created_at,
              u.full_name as actor_name
       FROM audit_logs a
       JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC
       LIMIT 10`
    )
    .all();

  res.json({
    stats: {
      totalClasses,
      totalStudents,
      totalProfessors,
      subjectsPending,
      resultsPublished,
      pendingApprovals: pendingSubjectReqs + pendingEnrollmentReqs,
      pendingSubjectRequests: pendingSubjectReqs,
      pendingEnrollmentRequests: pendingEnrollmentReqs,
    },
    classesSummary,
    recentActivity,
  });
});

// GET /api/hod/meta (departments + professors for dropdowns)
router.get('/meta', (_req, res) => {
  const db = getDb();
  const departments = db
    .prepare('SELECT id, code, name, college FROM departments ORDER BY name ASC')
    .all();
  const professors = db
    .prepare(
      `SELECT p.id, p.faculty_id, p.specialization, u.full_name, u.email, d.name as department_name
       FROM professor_profiles p
       JOIN users u ON u.id = p.user_id
       JOIN departments d ON d.id = p.department_id
       WHERE u.is_active = 1
       ORDER BY u.full_name ASC`
    )
    .all();
  res.json({ departments, professors });
});

// GET /api/hod/classes
router.get('/classes', (_req, res) => {
  const db = getDb();
  const classes = db
    .prepare(
      `SELECT c.id, c.class_code, c.name, c.academic_year, c.semester, c.division, c.batch,
              c.is_published, c.is_archived, c.created_at,
              d.id as department_id, d.name as department_name, d.code as department_code, d.college,
              (SELECT COUNT(*) FROM subjects s WHERE s.class_id = c.id) as total_subjects,
              (SELECT COUNT(*) FROM subjects s JOIN subject_submissions ss ON ss.subject_id = s.id WHERE s.class_id = c.id AND ss.status = 'LOCKED') as locked_subjects,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) as roster_count,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id AND cs.is_enrolled = 1) as enrolled_count,
              (SELECT rp.published_at FROM result_publications rp WHERE rp.class_id = c.id ORDER BY rp.version DESC LIMIT 1) as published_at,
              (SELECT rp.version FROM result_publications rp WHERE rp.class_id = c.id ORDER BY rp.version DESC LIMIT 1) as publication_version
       FROM classes c
       JOIN departments d ON d.id = c.department_id
       ORDER BY c.is_published ASC, c.created_at DESC`
    )
    .all();

  res.json({ classes });
});

// GET /api/hod/classes/:classId
router.get('/classes/:classId', (req, res) => {
  const db = getDb();
  const cls = db
    .prepare(
      `SELECT c.*, d.name as department_name, d.code as department_code, d.college
       FROM classes c
       JOIN departments d ON d.id = c.department_id
       WHERE c.id = ?`
    )
    .get(req.params.classId) as Record<string, unknown> | undefined;

  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }

  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type, s.assigned_professor_id,
              u.full_name as professor_name, p.faculty_id,
              ss.status as submission_status, ss.locked_at, ss.updated_at as submission_updated_at,
              (SELECT COUNT(*) FROM marks m WHERE m.subject_id = s.id) as marks_entered
       FROM subjects s
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN subject_submissions ss ON ss.subject_id = s.id
       WHERE s.class_id = ?
       ORDER BY s.code ASC`
    )
    .all(req.params.classId);

  const roster = db
    .prepare(
      `SELECT cs.id, cs.enrollment_number, cs.roster_name, cs.is_enrolled, cs.enrolled_at,
              u.full_name as student_name, u.email as student_email
       FROM class_students cs
       LEFT JOIN student_profiles sp ON sp.id = cs.student_profile_id
       LEFT JOIN users u ON u.id = sp.user_id
       WHERE cs.class_id = ?
       ORDER BY cs.enrollment_number ASC`
    )
    .all(req.params.classId);

  const invitations = db
    .prepare(
      `SELECT id, token, expires_at, is_active, created_at
       FROM invitations
       WHERE class_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.params.classId);

  res.json({ classInfo: cls, subjects, roster, invitations });
});

// POST /api/hod/classes
router.post('/classes', (req: AuthRequest, res) => {
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid class payload.' });
    return;
  }

  const data = parsed.data;
  const db = getDb();

  const dept = db
    .prepare('SELECT id, code FROM departments WHERE id = ?')
    .get(data.departmentId) as { id: string; code: string } | undefined;
  if (!dept) {
    res.status(400).json({ error: 'Selected department does not exist.' });
    return;
  }

  // Validate duplicate subject codes
  const seenSubjectCodes = new Set<string>();
  for (const s of data.subjects) {
    const code = s.code.toUpperCase();
    if (seenSubjectCodes.has(code)) {
      res.status(400).json({ error: `Duplicate subject code detected: ${code}.` });
      return;
    }
    seenSubjectCodes.add(code);
  }

  // Validate duplicate enrollment numbers
  const seenEnrollments = new Set<string>();
  for (const r of data.roster) {
    const enr = r.enrollmentNumber.toUpperCase();
    if (seenEnrollments.has(enr)) {
      res.status(400).json({ error: `Duplicate enrollment number in roster: ${enr}.` });
      return;
    }
    seenEnrollments.add(enr);
  }

  const now = nowIso();
  const classId = generateId('cls');
  const classCode = `${dept.code}-${data.academicYear.replace(/[^0-9]/g, '').slice(0, 4)}-S${data.semester}-${data.division.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const inviteId = generateId('inv');
  const inviteToken = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + data.inviteExpiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  runTransaction((tx) => {
    tx.prepare(
      `INSERT INTO classes (id, class_code, name, department_id, academic_year, semester, division, batch, is_published, is_archived, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
    ).run(
      classId,
      classCode,
      data.name,
      data.departmentId,
      data.academicYear,
      data.semester,
      data.division.toUpperCase(),
      data.batch,
      req.auth!.userId,
      now,
      now
    );

    for (const sub of data.subjects) {
      const subId = generateId('sub');
      const profId = sub.assignedProfessorId && sub.assignedProfessorId.length > 0 ? sub.assignedProfessorId : null;
      tx.prepare(
        `INSERT INTO subjects (id, class_id, code, name, max_marks, assessment_type, assigned_professor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        subId,
        classId,
        sub.code.toUpperCase(),
        sub.name,
        sub.maxMarks,
        sub.assessmentType,
        profId,
        now,
        now
      );

      tx.prepare(
        `INSERT INTO subject_submissions (id, subject_id, professor_id, status, created_at, updated_at)
         VALUES (?, ?, ?, 'NOT_STARTED', ?, ?)`
      ).run(generateId('subm'), subId, profId, now, now);

      if (profId) {
        const profUser = tx
          .prepare('SELECT user_id FROM professor_profiles WHERE id = ?')
          .get(profId) as { user_id: string } | undefined;
        if (profUser) {
          createNotification(
            {
              userId: profUser.user_id,
              type: 'SUBJECT_ASSIGNED',
              title: `Assigned Subject: ${sub.code.toUpperCase()}`,
              message: `You have been assigned ${sub.code.toUpperCase()} — ${sub.name} in ${data.name}.`,
              link: '/professor/classes',
            },
            tx
          );
        }
      }
    }

    for (const r of data.roster) {
      const enr = r.enrollmentNumber.toUpperCase();
      const existingStu = tx
        .prepare('SELECT id FROM student_profiles WHERE UPPER(enrollment_number) = ?')
        .get(enr) as { id: string } | undefined;

      tx.prepare(
        `INSERT INTO class_students (id, class_id, enrollment_number, roster_name, student_profile_id, is_enrolled, enrolled_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`
      ).run(
        generateId('cs'),
        classId,
        enr,
        r.rosterName || null,
        existingStu?.id ?? null,
        now,
        now
      );
    }

    tx.prepare(
      `INSERT INTO invitations (id, class_id, token, expires_at, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(inviteId, classId, inviteToken, expiresAt, req.auth!.userId, now, now);

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: 'CLASS_CREATED',
        entityType: 'Class',
        entityId: classId,
        newValue: `${data.name} (${data.subjects.length} subjects, ${data.roster.length} roster entries)`,
        details: `Created class ${classCode} with secure invitation token.`,
      },
      tx
    );
  });

  res.status(201).json({
    classId,
    classCode,
    invitation: {
      id: inviteId,
      token: inviteToken,
      expiresAt,
      isActive: true,
    },
  });
});

// POST /api/hod/classes/:classId/subjects
const addSubjectSchema = z.object({
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2).max(120),
  maxMarks: z.coerce.number().positive().max(1000),
  assessmentType: z.string().trim().min(2).max(80).default('Mid-Semester Examination'),
  assignedProfessorId: z.string().trim().nullable().optional(),
});

router.post('/classes/:classId/subjects', (req: AuthRequest, res) => {
  const parsed = addSubjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid subject details.' });
    return;
  }

  const db = getDb();
  const cls = db
    .prepare('SELECT id, name, is_published FROM classes WHERE id = ?')
    .get(req.params.classId) as { id: string; name: string; is_published: number } | undefined;

  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }
  if (cls.is_published === 1) {
    res.status(400).json({ error: 'Cannot add subjects after results have been published.' });
    return;
  }

  const code = parsed.data.code.toUpperCase();
  const dup = db
    .prepare('SELECT id FROM subjects WHERE class_id = ? AND UPPER(code) = ?')
    .get(cls.id, code);
  if (dup) {
    res.status(409).json({ error: `Subject code ${code} already exists in this class.` });
    return;
  }

  const now = nowIso();
  const subId = generateId('sub');
  const profId =
    parsed.data.assignedProfessorId && parsed.data.assignedProfessorId.length > 0
      ? parsed.data.assignedProfessorId
      : null;

  runTransaction((tx) => {
    tx.prepare(
      `INSERT INTO subjects (id, class_id, code, name, max_marks, assessment_type, assigned_professor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      subId,
      cls.id,
      code,
      parsed.data.name,
      parsed.data.maxMarks,
      parsed.data.assessmentType,
      profId,
      now,
      now
    );

    tx.prepare(
      `INSERT INTO subject_submissions (id, subject_id, professor_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'NOT_STARTED', ?, ?)`
    ).run(generateId('subm'), subId, profId, now, now);

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: 'SUBJECT_ADDED',
        entityType: 'Subject',
        entityId: subId,
        subjectId: subId,
        newValue: `${code} — ${parsed.data.name} (Max ${parsed.data.maxMarks})`,
        details: `Added subject to ${cls.name}.`,
      },
      tx
    );
  });

  res.status(201).json({ id: subId, code, name: parsed.data.name });
});

// DELETE /api/hod/classes/:classId/subjects/:subjectId
router.delete('/classes/:classId/subjects/:subjectId', (req: AuthRequest, res) => {
  const db = getDb();
  const cls = db
    .prepare('SELECT id, name, is_published FROM classes WHERE id = ?')
    .get(req.params.classId) as { id: string; name: string; is_published: number } | undefined;

  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }
  if (cls.is_published === 1) {
    res.status(400).json({ error: 'Cannot remove subjects after result publication.' });
    return;
  }

  const sub = db
    .prepare('SELECT id, code, name FROM subjects WHERE id = ? AND class_id = ?')
    .get(req.params.subjectId, cls.id) as { id: string; code: string; name: string } | undefined;

  if (!sub) {
    res.status(404).json({ error: 'Subject not found in this class.' });
    return;
  }

  runTransaction((tx) => {
    tx.prepare('DELETE FROM subjects WHERE id = ?').run(sub.id);
    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: 'SUBJECT_REMOVED',
        entityType: 'Subject',
        entityId: sub.id,
        previousValue: `${sub.code} — ${sub.name}`,
        details: `Removed subject before result publication from ${cls.name}.`,
      },
      tx
    );
  });

  res.json({ message: 'Subject removed successfully.' });
});

// POST /api/hod/classes/:classId/roster (Add students individually or bulk import)
const addRosterSchema = z.object({
  students: z
    .array(
      z.object({
        enrollmentNumber: z.string().trim().min(3).max(40),
        rosterName: z.string().trim().max(120).optional().default(''),
      })
    )
    .min(1),
});

router.post('/classes/:classId/roster', (req: AuthRequest, res) => {
  const parsed = addRosterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid roster payload.' });
    return;
  }

  const db = getDb();
  const cls = db
    .prepare('SELECT id, name, is_published FROM classes WHERE id = ?')
    .get(req.params.classId) as { id: string; name: string; is_published: number } | undefined;

  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }
  if (cls.is_published === 1) {
    res.status(400).json({ error: 'Cannot modify roster after result publication.' });
    return;
  }

  const added: string[] = [];
  const duplicates: string[] = [];
  const now = nowIso();

  runTransaction((tx) => {
    for (const s of parsed.data.students) {
      const enr = s.enrollmentNumber.toUpperCase();
      const exists = tx
        .prepare('SELECT id FROM class_students WHERE class_id = ? AND UPPER(enrollment_number) = ?')
        .get(cls.id, enr);
      if (exists) {
        duplicates.push(enr);
        continue;
      }

      const existingProfile = tx
        .prepare('SELECT id FROM student_profiles WHERE UPPER(enrollment_number) = ?')
        .get(enr) as { id: string } | undefined;

      tx.prepare(
        `INSERT INTO class_students (id, class_id, enrollment_number, roster_name, student_profile_id, is_enrolled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(generateId('cs'), cls.id, enr, s.rosterName || null, existingProfile?.id ?? null, now, now);

      added.push(enr);
    }

    if (added.length > 0) {
      recordAuditLog(
        {
          actorUserId: req.auth!.userId,
          actorRole: 'HOD',
          action: 'ROSTER_UPDATED',
          entityType: 'Class',
          entityId: cls.id,
          newValue: `Added ${added.length} enrollment(s)`,
          details: `Added ${added.join(', ')} to ${cls.name}.`,
        },
        tx
      );
    }
  });

  res.status(201).json({ addedCount: added.length, added, duplicates });
});

// GET /api/hod/invitations
router.get('/invitations', (_req, res) => {
  const db = getDb();
  const invitations = db
    .prepare(
      `SELECT i.id, i.class_id, i.token, i.expires_at, i.is_active, i.created_at,
              c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.is_published,
              d.name as department_name
       FROM invitations i
       JOIN classes c ON c.id = i.class_id
       JOIN departments d ON d.id = c.department_id
       ORDER BY i.is_active DESC, i.created_at DESC`
    )
    .all();

  res.json({ invitations });
});

// POST /api/hod/classes/:classId/invitations/regenerate
router.post('/classes/:classId/invitations/regenerate', (req: AuthRequest, res) => {
  const days = Math.min(365, Math.max(1, Number(req.body?.expiresInDays) || 30));
  const db = getDb();

  const cls = db
    .prepare('SELECT id, name FROM classes WHERE id = ?')
    .get(req.params.classId) as { id: string; name: string } | undefined;
  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }

  const now = nowIso();
  const newId = generateId('inv');
  const newToken = generateInviteToken();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  runTransaction((tx) => {
    tx.prepare('UPDATE invitations SET is_active = 0, updated_at = ? WHERE class_id = ? AND is_active = 1').run(
      now,
      cls.id
    );
    tx.prepare(
      `INSERT INTO invitations (id, class_id, token, expires_at, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(newId, cls.id, newToken, expiresAt, req.auth!.userId, now, now);

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: 'INVITATION_REGENERATED',
        entityType: 'Invitation',
        entityId: newId,
        details: `Revoked prior invitations and issued new QR/invitation link for ${cls.name}.`,
      },
      tx
    );
  });

  res.status(201).json({ id: newId, token: newToken, expiresAt, isActive: 1 });
});

// PATCH /api/hod/invitations/:id/revoke
router.patch('/invitations/:id/revoke', (req: AuthRequest, res) => {
  const db = getDb();
  const inv = db
    .prepare('SELECT id, class_id FROM invitations WHERE id = ?')
    .get(req.params.id) as { id: string; class_id: string } | undefined;
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found.' });
    return;
  }

  runTransaction((tx) => {
    tx.prepare('UPDATE invitations SET is_active = 0, updated_at = ? WHERE id = ?').run(nowIso(), inv.id);
    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: 'INVITATION_REVOKED',
        entityType: 'Invitation',
        entityId: inv.id,
        details: 'Revoked class invitation link.',
      },
      tx
    );
  });

  res.json({ message: 'Invitation revoked.' });
});

// GET /api/hod/subject-requests
router.get('/subject-requests', (_req, res) => {
  const db = getDb();
  const requests = db
    .prepare(
      `SELECT r.id, r.status, r.note, r.created_at, r.decided_at,
              p.id as professor_id, p.faculty_id, u.full_name as professor_name, u.email as professor_email,
              c.id as class_id, c.name as class_name, c.academic_year, c.semester, c.division,
              s.id as subject_id, s.code as subject_code, s.name as subject_name
       FROM professor_subject_requests r
       JOIN professor_profiles p ON p.id = r.professor_id
       JOIN users u ON u.id = p.user_id
       JOIN classes c ON c.id = r.class_id
       JOIN subjects s ON s.id = r.subject_id
       ORDER BY CASE r.status WHEN 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC`
    )
    .all();

  res.json({ requests });
});

// POST /api/hod/subject-requests/:id/decide
const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
});

router.post('/subject-requests/:id/decide', (req: AuthRequest, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Decision must be APPROVED or REJECTED.' });
    return;
  }

  const db = getDb();
  const request = db
    .prepare(
      `SELECT r.*, p.user_id as prof_user_id, u.full_name as prof_name,
              s.code as subject_code, s.name as subject_name, c.name as class_name
       FROM professor_subject_requests r
       JOIN professor_profiles p ON p.id = r.professor_id
       JOIN users u ON u.id = p.user_id
       JOIN subjects s ON s.id = r.subject_id
       JOIN classes c ON c.id = r.class_id
       WHERE r.id = ?`
    )
    .get(req.params.id) as
    | {
        id: string;
        professor_id: string;
        subject_id: string;
        class_id: string;
        status: string;
        prof_user_id: string;
        prof_name: string;
        subject_code: string;
        subject_name: string;
        class_name: string;
      }
    | undefined;

  if (!request) {
    res.status(404).json({ error: 'Subject access request not found.' });
    return;
  }
  if (request.status !== 'PENDING') {
    res.status(400).json({ error: `Request has already been ${request.status.toLowerCase()}.` });
    return;
  }

  const now = nowIso();
  runTransaction((tx) => {
    tx.prepare(
      `UPDATE professor_subject_requests
       SET status = ?, decided_by = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(parsed.data.decision, req.auth!.userId, now, now, request.id);

    if (parsed.data.decision === 'APPROVED') {
      tx.prepare('UPDATE subjects SET assigned_professor_id = ?, updated_at = ? WHERE id = ?').run(
        request.professor_id,
        now,
        request.subject_id
      );
      tx.prepare('UPDATE subject_submissions SET professor_id = ?, updated_at = ? WHERE subject_id = ?').run(
        request.professor_id,
        now,
        request.subject_id
      );
    }

    createNotification(
      {
        userId: request.prof_user_id,
        type: 'PROFESSOR_REQUEST_DECISION',
        title: `Subject Request ${parsed.data.decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message:
          parsed.data.decision === 'APPROVED'
            ? `Your access request for ${request.subject_code} — ${request.subject_name} (${request.class_name}) was approved.`
            : `Your access request for ${request.subject_code} — ${request.subject_name} (${request.class_name}) was declined by the HOD.`,
        link: '/professor/classes',
      },
      tx
    );

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: `PROFESSOR_REQUEST_${parsed.data.decision}`,
        entityType: 'ProfessorSubjectRequest',
        entityId: request.id,
        subjectId: request.subject_id,
        previousValue: 'PENDING',
        newValue: parsed.data.decision,
        details: `${parsed.data.decision} ${request.prof_name} for ${request.subject_code} (${request.class_name}).`,
      },
      tx
    );
  });

  res.json({ message: `Request ${parsed.data.decision.toLowerCase()} successfully.` });
});

// GET /api/hod/enrollment-requests
router.get('/enrollment-requests', (_req, res) => {
  const db = getDb();
  const requests = db
    .prepare(
      `SELECT r.id, r.enrollment_number, r.status, r.created_at, r.decided_at,
              sp.id as student_profile_id, u.full_name as student_name, u.email as student_email,
              c.id as class_id, c.name as class_name, c.academic_year, c.semester, c.division,
              (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = r.class_id AND UPPER(cs.enrollment_number) = UPPER(r.enrollment_number)) as in_roster
       FROM student_enrollment_requests r
       JOIN student_profiles sp ON sp.id = r.student_profile_id
       JOIN users u ON u.id = sp.user_id
       JOIN classes c ON c.id = r.class_id
       ORDER BY CASE r.status WHEN 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC`
    )
    .all();

  res.json({ requests });
});

// POST /api/hod/enrollment-requests/:id/decide
router.post('/enrollment-requests/:id/decide', (req: AuthRequest, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Decision must be APPROVED or REJECTED.' });
    return;
  }

  const db = getDb();
  const request = db
    .prepare(
      `SELECT r.*, sp.user_id as student_user_id, u.full_name as student_name, c.name as class_name, c.semester as class_semester
       FROM student_enrollment_requests r
       JOIN student_profiles sp ON sp.id = r.student_profile_id
       JOIN users u ON u.id = sp.user_id
       JOIN classes c ON c.id = r.class_id
       WHERE r.id = ?`
    )
    .get(req.params.id) as
    | {
        id: string;
        class_id: string;
        student_profile_id: string;
        enrollment_number: string;
        status: string;
        student_user_id: string;
        student_name: string;
        class_name: string;
        class_semester: number;
      }
    | undefined;

  if (!request) {
    res.status(404).json({ error: 'Enrollment request not found.' });
    return;
  }
  if (request.status !== 'PENDING') {
    res.status(400).json({ error: `Enrollment request has already been ${request.status.toLowerCase()}.` });
    return;
  }

  // Re-verify Rule 2 before approval: must exist in roster
  const roster = db
    .prepare('SELECT id FROM class_students WHERE class_id = ? AND UPPER(enrollment_number) = UPPER(?)')
    .get(request.class_id, request.enrollment_number) as { id: string } | undefined;

  if (parsed.data.decision === 'APPROVED' && !roster) {
    res.status(400).json({ error: 'Enrollment number is not present in the class roster and cannot be approved.' });
    return;
  }

  const now = nowIso();
  runTransaction((tx) => {
    tx.prepare(
      `UPDATE student_enrollment_requests
       SET status = ?, decided_by = ?, decided_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(parsed.data.decision, req.auth!.userId, now, now, request.id);

    if (parsed.data.decision === 'APPROVED' && roster) {
      tx.prepare(
        `UPDATE class_students
         SET student_profile_id = ?, is_enrolled = 1, enrolled_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(request.student_profile_id, now, now, roster.id);

      tx.prepare(
        `UPDATE student_profiles SET current_semester = MAX(current_semester, ?), updated_at = ? WHERE id = ?`
      ).run(request.class_semester, now, request.student_profile_id);
    }

    createNotification(
      {
        userId: request.student_user_id,
        type: 'ENROLLMENT_DECISION',
        title: `Class Enrollment ${parsed.data.decision === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message:
          parsed.data.decision === 'APPROVED'
            ? `Your enrollment in ${request.class_name} has been approved by the HOD.`
            : `Your enrollment request for ${request.class_name} was declined by the HOD.`,
        link: '/student/result-status',
      },
      tx
    );

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: `ENROLLMENT_${parsed.data.decision}`,
        entityType: 'StudentEnrollmentRequest',
        entityId: request.id,
        studentEnrollment: request.enrollment_number,
        previousValue: 'PENDING',
        newValue: parsed.data.decision,
        details: `${parsed.data.decision} enrollment for ${request.student_name} (${request.enrollment_number}) in ${request.class_name}.`,
      },
      tx
    );
  });

  res.json({ message: `Enrollment request ${parsed.data.decision.toLowerCase()}.` });
});

// GET /api/hod/classes/:classId/lock-tracker
router.get('/classes/:classId/lock-tracker', (req, res) => {
  const db = getDb();
  const cls = db
    .prepare(
      `SELECT c.id, c.name, c.class_code, c.academic_year, c.semester, c.division, c.is_published,
              d.name as department_name
       FROM classes c
       JOIN departments d ON d.id = c.department_id
       WHERE c.id = ?`
    )
    .get(req.params.classId) as Record<string, unknown> | undefined;

  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }

  const totalStudents = (
    db
      .prepare('SELECT COUNT(*) as c FROM class_students WHERE class_id = ? AND is_enrolled = 1')
      .get(req.params.classId) as { c: number }
  ).c;

  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, s.assessment_type, s.assigned_professor_id,
              u.full_name as professor_name, p.faculty_id, p.user_id as professor_user_id,
              ss.status, ss.locked_at, ss.updated_at as last_updated,
              (SELECT COUNT(*) FROM marks m
               JOIN class_students cs ON cs.student_profile_id = m.student_id AND cs.class_id = s.class_id AND cs.is_enrolled = 1
               WHERE m.subject_id = s.id) as marks_submitted
       FROM subjects s
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN subject_submissions ss ON ss.subject_id = s.id
       WHERE s.class_id = ?
       ORDER BY s.code ASC`
    )
    .all(req.params.classId) as Array<Record<string, unknown>>;

  const lockedCount = subjects.filter((s) => s.status === 'LOCKED').length;
  const totalSubjects = subjects.length;

  res.json({
    classInfo: cls,
    totalStudents,
    totalSubjects,
    lockedCount,
    progressPercent: totalSubjects > 0 ? Math.round((lockedCount / totalSubjects) * 100) : 0,
    subjects: subjects.map((s) => ({
      ...s,
      total_students: totalStudents,
    })),
  });
});

// POST /api/hod/subjects/:subjectId/unlock (Authorized HOD correction workflow)
const unlockSchema = z.object({
  reason: z.string().trim().min(5, 'Please provide a brief audit reason for unlocking this subject.').max(300),
});

router.post('/subjects/:subjectId/unlock', (req: AuthRequest, res) => {
  const parsed = unlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Reason is required.' });
    return;
  }

  const db = getDb();
  const sub = db
    .prepare(
      `SELECT s.id, s.code, s.name, c.id as class_id, c.name as class_name, c.is_published,
              ss.status, p.user_id as prof_user_id
       FROM subjects s
       JOIN classes c ON c.id = s.class_id
       JOIN subject_submissions ss ON ss.subject_id = s.id
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       WHERE s.id = ?`
    )
    .get(req.params.subjectId) as
    | {
        id: string;
        code: string;
        name: string;
        class_id: string;
        class_name: string;
        is_published: number;
        status: string;
        prof_user_id: string | null;
      }
    | undefined;

  if (!sub) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }
  if (sub.is_published === 1) {
    res.status(400).json({ error: 'Cannot unlock subjects after official results have been published.' });
    return;
  }
  if (sub.status !== 'LOCKED') {
    res.status(400).json({ error: 'Subject is not currently locked.' });
    return;
  }

  const now = nowIso();
  runTransaction((tx) => {
    tx.prepare(
      `UPDATE subject_submissions SET status = 'IN_PROGRESS', locked_at = NULL, locked_by = NULL, updated_at = ?
       WHERE subject_id = ?`
    ).run(now, sub.id);

    if (sub.prof_user_id) {
      createNotification(
        {
          userId: sub.prof_user_id,
          type: 'SUBJECT_UNLOCKED',
          title: `Subject Unlocked for Correction: ${sub.code}`,
          message: `The HOD unlocked ${sub.code} — ${sub.name} (${sub.class_name}). Reason: ${parsed.data.reason}`,
          link: '/professor/marks',
        },
        tx
      );
    }

    recordAuditLog(
      {
        actorUserId: req.auth!.userId,
        actorRole: 'HOD',
        action: 'SUBJECT_UNLOCKED_BY_HOD',
        entityType: 'SubjectSubmission',
        entityId: sub.id,
        subjectId: sub.id,
        previousValue: 'LOCKED',
        newValue: 'IN_PROGRESS',
        details: `HOD authorized unlock for ${sub.code} (${sub.class_name}). Reason: ${parsed.data.reason}`,
      },
      tx
    );
  });

  res.json({ message: 'Subject unlocked for authorized correction and logged to audit trail.' });
});

// POST /api/hod/subjects/:subjectId/remind
router.post('/subjects/:subjectId/remind', (req: AuthRequest, res) => {
  const db = getDb();
  const sub = db
    .prepare(
      `SELECT s.id, s.code, s.name, c.name as class_name, p.user_id as prof_user_id, u.full_name as prof_name
       FROM subjects s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE s.id = ?`
    )
    .get(req.params.subjectId) as
    | { id: string; code: string; name: string; class_name: string; prof_user_id: string | null; prof_name: string | null }
    | undefined;

  if (!sub) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }
  if (!sub.prof_user_id) {
    res.status(400).json({ error: 'No professor is currently assigned to this subject.' });
    return;
  }

  createNotification({
    userId: sub.prof_user_id,
    type: 'HOD_REMINDER',
    title: `HOD Reminder: Submit & Lock ${sub.code}`,
    message: `Please complete marks entry and lock ${sub.code} — ${sub.name} for ${sub.class_name} so final results can be published.`,
    link: '/professor/marks',
  });

  recordAuditLog({
    actorUserId: req.auth!.userId,
    actorRole: 'HOD',
    action: 'HOD_REMINDER_SENT',
    entityType: 'Subject',
    entityId: sub.id,
    subjectId: sub.id,
    details: `Sent submission reminder to ${sub.prof_name} for ${sub.code} (${sub.class_name}).`,
  });

  res.json({ message: `Reminder sent to ${sub.prof_name}.` });
});

// GET /api/hod/classes/:classId/publish-preview
router.get('/classes/:classId/publish-preview', (req, res) => {
  const db = getDb();
  const cls = db
    .prepare(
      `SELECT c.id, c.class_code, c.name, c.academic_year, c.semester, c.division, c.batch, c.is_published,
              d.name as department_name, d.college
       FROM classes c
       JOIN departments d ON d.id = c.department_id
       WHERE c.id = ?`
    )
    .get(req.params.classId) as Record<string, unknown> | undefined;

  if (!cls) {
    res.status(404).json({ error: 'Class not found.' });
    return;
  }

  const subjects = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.max_marks, ss.status, ss.locked_at, u.full_name as professor_name
       FROM subjects s
       JOIN subject_submissions ss ON ss.subject_id = s.id
       LEFT JOIN professor_profiles p ON p.id = s.assigned_professor_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE s.class_id = ?
       ORDER BY s.code ASC`
    )
    .all(req.params.classId) as Array<{
    id: string;
    code: string;
    name: string;
    max_marks: number;
    status: string;
    locked_at: string | null;
    professor_name: string | null;
  }>;

  const enrolledStudents = db
    .prepare(
      `SELECT sp.id as student_id, sp.enrollment_number, u.full_name as student_name
       FROM class_students cs
       JOIN student_profiles sp ON sp.id = cs.student_profile_id
       JOIN users u ON u.id = sp.user_id
       WHERE cs.class_id = ? AND cs.is_enrolled = 1
       ORDER BY sp.enrollment_number ASC`
    )
    .all(req.params.classId) as Array<{
    student_id: string;
    enrollment_number: string;
    student_name: string;
  }>;

  const marksRows = db
    .prepare(
      `SELECT m.subject_id, m.student_id, m.obtained_marks
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       WHERE s.class_id = ?`
    )
    .all(req.params.classId) as Array<{
    subject_id: string;
    student_id: string;
    obtained_marks: number;
  }>;

  const marksMap = new Map<string, number>();
  for (const row of marksRows) {
    marksMap.set(`${row.subject_id}:${row.student_id}`, row.obtained_marks);
  }

  const pendingSubjects = subjects.filter((s) => s.status !== 'LOCKED');
  let missingMarksCount = 0;

  const combinedRows = enrolledStudents.map((stu) => {
    let totalObtained = 0;
    let totalMax = 0;
    const subjectMarks: Record<string, number | null> = {};

    for (const sub of subjects) {
      totalMax += sub.max_marks;
      const val = marksMap.get(`${sub.id}:${stu.student_id}`);
      if (val === undefined) {
        subjectMarks[sub.code] = null;
        missingMarksCount++;
      } else {
        subjectMarks[sub.code] = val;
        totalObtained += val;
      }
    }

    const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
    const { grade, status } = calculateGrade(percentage);

    return {
      studentId: stu.student_id,
      enrollmentNumber: stu.enrollment_number,
      studentName: stu.student_name,
      subjectMarks,
      totalObtained,
      totalMax,
      percentage,
      grade,
      resultStatus: status,
    };
  });

  const canPublish =
    cls.is_published === 0 &&
    subjects.length > 0 &&
    enrolledStudents.length > 0 &&
    pendingSubjects.length === 0 &&
    missingMarksCount === 0;

  const publication = db
    .prepare(
      `SELECT rp.id, rp.version, rp.published_at, rp.notes, u.full_name as published_by_name
       FROM result_publications rp
       JOIN users u ON u.id = rp.published_by
       WHERE rp.class_id = ?
       ORDER BY rp.version DESC
       LIMIT 1`
    )
    .get(req.params.classId);

  res.json({
    classInfo: cls,
    subjects,
    enrolledCount: enrolledStudents.length,
    pendingSubjects,
    missingMarksCount,
    canPublish,
    statusMessage:
      cls.is_published === 1
        ? 'Results published.'
        : pendingSubjects.length > 0 || missingMarksCount > 0
          ? 'Awaiting all subject submissions.'
          : enrolledStudents.length === 0
            ? 'No enrolled students in this class yet.'
            : 'All subjects submitted. Ready for verification.',
    combinedRows,
    publication: publication ?? null,
  });
});

// POST /api/hod/classes/:classId/publish (CRITICAL ATOMIC TRANSACTION — RULES 6 & 7)
router.post('/classes/:classId/publish', (req: AuthRequest, res) => {
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 500) : '';

  try {
    const result = runTransaction((tx) => {
      const cls = tx
        .prepare('SELECT id, name, class_code, semester, is_published FROM classes WHERE id = ?')
        .get(req.params.classId) as
        | { id: string; name: string; class_code: string; semester: number; is_published: number }
        | undefined;

      if (!cls) {
        throw Object.assign(new Error('Class not found.'), { statusCode: 404 });
      }
      if (cls.is_published === 1) {
        throw Object.assign(new Error('Results for this class have already been published.'), { statusCode: 409 });
      }

      const subjects = tx
        .prepare(
          `SELECT s.id, s.code, s.name, s.max_marks, ss.status
           FROM subjects s
           JOIN subject_submissions ss ON ss.subject_id = s.id
           WHERE s.class_id = ?`
        )
        .all(cls.id) as Array<{ id: string; code: string; name: string; max_marks: number; status: string }>;

      if (subjects.length === 0) {
        throw Object.assign(new Error('Cannot publish a class with no subjects.'), { statusCode: 400 });
      }

      const unlocked = subjects.filter((s) => s.status !== 'LOCKED');
      if (unlocked.length > 0) {
        throw Object.assign(
          new Error(
            `Awaiting all subject submissions. Pending subjects: ${unlocked.map((u) => u.code).join(', ')}.`
          ),
          { statusCode: 400 }
        );
      }

      const students = tx
        .prepare(
          `SELECT sp.id as student_id, sp.user_id, sp.enrollment_number
           FROM class_students cs
           JOIN student_profiles sp ON sp.id = cs.student_profile_id
           WHERE cs.class_id = ? AND cs.is_enrolled = 1`
        )
        .all(cls.id) as Array<{ student_id: string; user_id: string; enrollment_number: string }>;

      if (students.length === 0) {
        throw Object.assign(new Error('Cannot publish results when no students are enrolled.'), { statusCode: 400 });
      }

      // Verify every enrolled student has valid marks in every subject
      const marksCheckStmt = tx.prepare(
        'SELECT obtained_marks FROM marks WHERE subject_id = ? AND student_id = ?'
      );

      const now = nowIso();
      const prevVersion = (
        tx
          .prepare('SELECT COALESCE(MAX(version), 0) as v FROM result_publications WHERE class_id = ?')
          .get(cls.id) as { v: number }
      ).v;
      const version = prevVersion + 1;
      const publicationId = generateId('pub');

      tx.prepare(
        `INSERT INTO result_publications (id, class_id, version, published_by, published_at, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(publicationId, cls.id, version, req.auth!.userId, now, notes || 'Verified and published by HOD.');

      let generatedCount = 0;

      for (const stu of students) {
        let totalMax = 0;
        let totalObtained = 0;

        for (const sub of subjects) {
          const markRow = marksCheckStmt.get(sub.id, stu.student_id) as { obtained_marks: number } | undefined;
          if (!markRow || markRow.obtained_marks < 0 || markRow.obtained_marks > sub.max_marks) {
            throw Object.assign(
              new Error(
                `Incomplete or invalid marks for student ${stu.enrollment_number} in subject ${sub.code}. Publication aborted atomically.`
              ),
              { statusCode: 400 }
            );
          }
          totalMax += sub.max_marks;
          totalObtained += markRow.obtained_marks;
        }

        const percentage = Number(((totalObtained / totalMax) * 100).toFixed(2));
        const { grade, status } = calculateGrade(percentage);
        const rcId = generateId('rc');
        const reportCode = `RC-${cls.class_code.slice(0, 12)}-${stu.enrollment_number.slice(-4)}-V${version}`;

        tx.prepare(
          `INSERT INTO report_cards (
            id, report_code, publication_id, class_id, student_id,
            total_max_marks, total_obtained, percentage, grade, result_status, published_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          rcId,
          reportCode,
          publicationId,
          cls.id,
          stu.student_id,
          totalMax,
          totalObtained,
          percentage,
          grade,
          status,
          now,
          now
        );

        createNotification(
          {
            userId: stu.user_id,
            type: 'RESULT_PUBLISHED',
            title: `Official Result Published: ${cls.name}`,
            message: `Your verified Semester ${cls.semester} report card is now available in your Student Dashboard.`,
            link: '/student/report-cards',
          },
          tx
        );

        generatedCount++;
      }

      tx.prepare('UPDATE classes SET is_published = 1, is_archived = 1, updated_at = ? WHERE id = ?').run(
        now,
        cls.id
      );

      recordAuditLog(
        {
          actorUserId: req.auth!.userId,
          actorRole: 'HOD',
          action: 'RESULT_PUBLISHED',
          entityType: 'ResultPublication',
          entityId: publicationId,
          previousValue: 'UNPUBLISHED',
          newValue: `PUBLISHED v${version} (${generatedCount} report cards)`,
          details: `Atomically verified and published final results for ${cls.name}.`,
        },
        tx
      );

      return {
        publicationId,
        version,
        publishedAt: now,
        reportCardsGenerated: generatedCount,
      };
    });

    res.status(201).json(result);
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
    const message = err instanceof Error ? err.message : 'Failed to publish results.';
    res.status(statusCode).json({ error: message });
  }
});

// GET /api/hod/audit-logs (Append-only, filterable, searchable, paginated)
router.get('/audit-logs', (req, res) => {
  const db = getDb();
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }
  if (role) {
    conditions.push('a.actor_role = ?');
    params.push(role);
  }
  if (search) {
    conditions.push(
      '(LOWER(u.full_name) LIKE LOWER(?) OR LOWER(COALESCE(a.student_enrollment, \'\')) LIKE LOWER(?) OR LOWER(COALESCE(a.details, \'\')) LIKE LOWER(?) OR LOWER(COALESCE(s.code, \'\')) LIKE LOWER(?))'
    );
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM audit_logs a
         JOIN users u ON u.id = a.actor_user_id
         LEFT JOIN subjects s ON s.id = a.subject_id
         ${whereClause}`
      )
      .get(...params) as { c: number }
  ).c;

  const logs = db
    .prepare(
      `SELECT a.id, a.action, a.actor_role, a.entity_type, a.entity_id, a.subject_id,
              a.student_enrollment, a.previous_value, a.new_value, a.details, a.created_at,
              u.full_name as actor_name, u.email as actor_email,
              s.code as subject_code, s.name as subject_name
       FROM audit_logs a
       JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN subjects s ON s.id = a.subject_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const actions = db
    .prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC')
    .all() as Array<{ action: string }>;

  res.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    availableActions: actions.map((a) => a.action),
  });
});

export default router;

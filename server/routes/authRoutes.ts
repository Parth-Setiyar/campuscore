import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateId, getDb, nowIso, runTransaction } from '../db/database.ts';
import {
  authRateLimiter,
  requireAuth,
  revokeToken,
  signAuthToken,
  type AuthRequest,
  type UserRole,
} from '../middleware/auth.ts';
import { recordAuditLog } from '../services/auditService.ts';
import { createNotification } from '../services/notificationService.ts';

const router = Router();

const identifierLoginSchema = z.object({
  identifier: z.string().trim().min(2, 'Please enter your ID or email.'),
  password: z.string().min(1, 'Password is required.'),
});

const studentLoginSchema = z.object({
  enrollmentNumber: z.string().trim().min(3, 'Enrollment number is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const studentRegisterInviteSchema = z.object({
  token: z.string().trim().min(4, 'Invitation code is required.'),
  enrollmentNumber: z.string().trim().min(3, 'Enrollment number is required.'),
  fullName: z.string().trim().min(2, 'Full name is required.').max(120),
  email: z.string().trim().email('Valid email address is required.'),
  phone: z.string().trim().max(25).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .max(100),
});

function buildUserPayload(userId: string) {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, email, full_name, role, phone, is_active, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        id: string;
        email: string;
        full_name: string;
        role: UserRole;
        phone: string | null;
        is_active: number;
        created_at: string;
      }
    | undefined;

  if (!user) return null;

  if (user.role === 'HOD') {
    const profile = db
      .prepare(
        `SELECT h.id, h.hod_code, h.designation, d.id as department_id, d.code as department_code, d.name as department_name, d.college
         FROM hod_profiles h
         JOIN departments d ON d.id = h.department_id
         WHERE h.user_id = ?`
      )
      .get(user.id) as Record<string, unknown> | undefined;
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      phone: user.phone,
      createdAt: user.created_at,
      profile: profile
        ? {
            id: profile.id as string,
            hodCode: profile.hod_code as string,
            designation: profile.designation as string,
            departmentId: profile.department_id as string,
            departmentCode: profile.department_code as string,
            departmentName: profile.department_name as string,
            college: profile.college as string,
          }
        : null,
    };
  }

  if (user.role === 'PROFESSOR') {
    const profile = db
      .prepare(
        `SELECT p.id, p.faculty_id, p.specialization, d.id as department_id, d.code as department_code, d.name as department_name, d.college
         FROM professor_profiles p
         JOIN departments d ON d.id = p.department_id
         WHERE p.user_id = ?`
      )
      .get(user.id) as Record<string, unknown> | undefined;
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      phone: user.phone,
      createdAt: user.created_at,
      profile: profile
        ? {
            id: profile.id as string,
            facultyId: profile.faculty_id as string,
            specialization: (profile.specialization as string | null) ?? '',
            departmentId: profile.department_id as string,
            departmentCode: profile.department_code as string,
            departmentName: profile.department_name as string,
            college: profile.college as string,
          }
        : null,
    };
  }

  const profile = db
    .prepare(
      `SELECT s.id, s.enrollment_number, s.current_semester, s.batch, d.id as department_id, d.code as department_code, d.name as department_name, d.college
       FROM student_profiles s
       JOIN departments d ON d.id = s.department_id
       WHERE s.user_id = ?`
    )
    .get(user.id) as Record<string, unknown> | undefined;
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    phone: user.phone,
    createdAt: user.created_at,
    profile: profile
      ? {
          id: profile.id as string,
          enrollmentNumber: profile.enrollment_number as string,
          currentSemester: profile.current_semester as number,
          batch: (profile.batch as string | null) ?? '',
          departmentId: profile.department_id as string,
          departmentCode: profile.department_code as string,
          departmentName: profile.department_name as string,
          college: profile.college as string,
        }
      : null,
  };
}

// POST /api/auth/login/hod
router.post('/login/hod', authRateLimiter, (req, res) => {
  const parsed = identifierLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid login input.' });
    return;
  }

  const { identifier, password } = parsed.data;
  const db = getDb();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.is_active, h.id as profile_id
       FROM users u
       JOIN hod_profiles h ON h.user_id = u.id
       WHERE u.role = 'HOD' AND (LOWER(u.email) = LOWER(?) OR UPPER(h.hod_code) = UPPER(?))`
    )
    .get(identifier, identifier) as
    | { id: string; email: string; password_hash: string; is_active: number; profile_id: string }
    | undefined;

  if (!row || row.is_active !== 1 || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid HOD ID/email or password.' });
    return;
  }

  const token = signAuthToken({
    userId: row.id,
    role: 'HOD',
    email: row.email,
    profileId: row.profile_id,
  });

  const user = buildUserPayload(row.id);
  res.json({ token, user });
});

// POST /api/auth/login/professor
router.post('/login/professor', authRateLimiter, (req, res) => {
  const parsed = identifierLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid login input.' });
    return;
  }

  const { identifier, password } = parsed.data;
  const db = getDb();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.is_active, p.id as profile_id
       FROM users u
       JOIN professor_profiles p ON p.user_id = u.id
       WHERE u.role = 'PROFESSOR' AND (LOWER(u.email) = LOWER(?) OR UPPER(p.faculty_id) = UPPER(?))`
    )
    .get(identifier, identifier) as
    | { id: string; email: string; password_hash: string; is_active: number; profile_id: string }
    | undefined;

  if (!row || row.is_active !== 1 || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid Faculty ID/email or password.' });
    return;
  }

  const token = signAuthToken({
    userId: row.id,
    role: 'PROFESSOR',
    email: row.email,
    profileId: row.profile_id,
  });

  const user = buildUserPayload(row.id);
  res.json({ token, user });
});

// POST /api/auth/login/student
router.post('/login/student', authRateLimiter, (req, res) => {
  const parsed = studentLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid login input.' });
    return;
  }

  const { enrollmentNumber, password } = parsed.data;
  const db = getDb();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.is_active, s.id as profile_id
       FROM users u
       JOIN student_profiles s ON s.user_id = u.id
       WHERE u.role = 'STUDENT' AND UPPER(s.enrollment_number) = UPPER(?)`
    )
    .get(enrollmentNumber) as
    | { id: string; email: string; password_hash: string; is_active: number; profile_id: string }
    | undefined;

  if (!row || row.is_active !== 1 || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid enrollment number or password.' });
    return;
  }

  const token = signAuthToken({
    userId: row.id,
    role: 'STUDENT',
    email: row.email,
    profileId: row.profile_id,
  });

  const user = buildUserPayload(row.id);
  res.json({ token, user });
});

// GET /api/auth/invite-info/:token (Safe metadata only — zero private student info!)
router.get('/invite-info/:token', (req, res) => {
  const rawToken = String(req.params.token || '').trim().toUpperCase();
  const db = getDb();

  const invite = db
    .prepare(
      `SELECT i.id, i.token, i.expires_at, i.is_active,
              c.id as class_id, c.name as class_name, c.class_code, c.academic_year, c.semester, c.division, c.batch,
              d.name as department_name, d.code as department_code, d.college
       FROM invitations i
       JOIN classes c ON c.id = i.class_id
       JOIN departments d ON d.id = c.department_id
       WHERE UPPER(i.token) = ?`
    )
    .get(rawToken) as Record<string, unknown> | undefined;

  if (!invite) {
    res.status(404).json({ error: 'Invitation code not found.' });
    return;
  }

  const isExpired = new Date(invite.expires_at as string).getTime() < Date.now();
  if (invite.is_active !== 1 || isExpired) {
    res.status(410).json({
      error: isExpired
        ? 'This class invitation has expired. Please request a fresh invitation from your HOD.'
        : 'This class invitation has been revoked.',
    });
    return;
  }

  res.json({
    token: invite.token,
    expiresAt: invite.expires_at,
    classId: invite.class_id,
    classCode: invite.class_code,
    className: invite.class_name,
    academicYear: invite.academic_year,
    semester: invite.semester,
    division: invite.division,
    batch: invite.batch,
    departmentName: invite.department_name,
    departmentCode: invite.department_code,
    college: invite.college,
  });
});

// POST /api/auth/student/register-invite (New student establishes credentials using valid invite + roster enrollment number)
router.post('/student/register-invite', authRateLimiter, (req, res) => {
  const parsed = studentRegisterInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data.' });
    return;
  }

  const { token, enrollmentNumber, fullName, email, phone, password } = parsed.data;
  const cleanEnr = enrollmentNumber.toUpperCase();
  const cleanToken = token.toUpperCase();
  const db = getDb();

  const invite = db
    .prepare(
      `SELECT i.id, i.class_id, i.expires_at, i.is_active,
              c.name as class_name, c.department_id, c.semester, c.batch, c.created_by_id
       FROM invitations i
       JOIN classes c ON c.id = i.class_id
       WHERE UPPER(i.token) = ?`
    )
    .get(cleanToken) as
    | {
        id: string;
        class_id: string;
        expires_at: string;
        is_active: number;
        class_name: string;
        department_id: string;
        semester: number;
        batch: string;
        created_by_id: string;
      }
    | undefined;

  if (!invite) {
    res.status(404).json({ error: 'Invalid invitation code.' });
    return;
  }

  if (invite.is_active !== 1 || new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: 'This invitation has expired or been revoked.' });
    return;
  }

  // RULE 2: Enrollment number MUST exist in HOD-uploaded class roster
  const rosterEntry = db
    .prepare(
      `SELECT id, student_profile_id, is_enrolled
       FROM class_students
       WHERE class_id = ? AND UPPER(enrollment_number) = ?`
    )
    .get(invite.class_id, cleanEnr) as
    | { id: string; student_profile_id: string | null; is_enrolled: number }
    | undefined;

  if (!rosterEntry) {
    res.status(403).json({
      error: `Enrollment number ${cleanEnr} is not listed in the authorized roster for ${invite.class_name}. Contact your HOD.`,
    });
    return;
  }

  const existingStudent = db
    .prepare('SELECT id FROM student_profiles WHERE UPPER(enrollment_number) = ?')
    .get(cleanEnr);
  if (existingStudent) {
    res.status(409).json({
      error: 'An account already exists for this enrollment number. Please sign in and join the class from your Student Dashboard.',
    });
    return;
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existingEmail) {
    res.status(409).json({ error: 'This email address is already registered.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const now = nowIso();
  const userId = generateId('usr');
  const studentProfileId = generateId('stu');
  const requestId = generateId('enrreq');

  runTransaction((tx) => {
    tx.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'STUDENT', ?, 1, ?, ?)`
    ).run(userId, email.toLowerCase(), passwordHash, fullName, phone ?? null, now, now);

    tx.prepare(
      `INSERT INTO student_profiles (id, user_id, enrollment_number, department_id, current_semester, batch, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(studentProfileId, userId, cleanEnr, invite.department_id, invite.semester, invite.batch, now, now);

    tx.prepare(
      `UPDATE class_students SET student_profile_id = ?, updated_at = ? WHERE id = ?`
    ).run(studentProfileId, now, rosterEntry.id);

    tx.prepare(
      `INSERT INTO student_enrollment_requests (id, class_id, student_profile_id, enrollment_number, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`
    ).run(requestId, invite.class_id, studentProfileId, cleanEnr, now, now);

    createNotification(
      {
        userId: invite.created_by_id,
        type: 'ENROLLMENT_REQUEST',
        title: 'New Student Registration & Enrollment Request',
        message: `${fullName} (${cleanEnr}) registered via invitation and requested enrollment in ${invite.class_name}.`,
        link: '/hod/enrollment-requests',
      },
      tx
    );

    recordAuditLog(
      {
        actorUserId: userId,
        actorRole: 'STUDENT',
        action: 'STUDENT_REGISTERED_VIA_INVITE',
        entityType: 'StudentEnrollmentRequest',
        entityId: requestId,
        studentEnrollment: cleanEnr,
        newValue: 'PENDING',
        details: `Student ${fullName} (${cleanEnr}) established credentials via class invitation for ${invite.class_name}.`,
      },
      tx
    );
  });

  const authToken = signAuthToken({
    userId,
    role: 'STUDENT',
    email: email.toLowerCase(),
    profileId: studentProfileId,
  });

  res.status(201).json({
    token: authToken,
    user: buildUserPayload(userId),
    enrollmentRequest: {
      id: requestId,
      status: 'PENDING',
      className: invite.class_name,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokeToken(authHeader.slice(7).trim());
  }
  res.json({ message: 'Signed out successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = buildUserPayload(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }
  res.json({ user });
});

// PATCH /api/auth/profile
const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(25).optional(),
  specialization: z.string().trim().max(150).optional(),
  designation: z.string().trim().max(150).optional(),
});

router.patch('/profile', requireAuth, (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile update.' });
    return;
  }

  const { fullName, phone, specialization, designation } = parsed.data;
  const db = getDb();
  const now = nowIso();

  runTransaction((tx) => {
    if (fullName !== undefined || phone !== undefined) {
      const current = tx
        .prepare('SELECT full_name, phone FROM users WHERE id = ?')
        .get(req.auth!.userId) as { full_name: string; phone: string | null };
      tx.prepare('UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?').run(
        fullName ?? current.full_name,
        phone !== undefined ? phone : current.phone,
        now,
        req.auth!.userId
      );
    }

    if (req.auth!.role === 'PROFESSOR' && specialization !== undefined) {
      tx.prepare('UPDATE professor_profiles SET specialization = ?, updated_at = ? WHERE user_id = ?').run(
        specialization,
        now,
        req.auth!.userId
      );
    }

    if (req.auth!.role === 'HOD' && designation !== undefined) {
      tx.prepare('UPDATE hod_profiles SET designation = ?, updated_at = ? WHERE user_id = ?').run(
        designation,
        now,
        req.auth!.userId
      );
    }
  });

  res.json({ user: buildUserPayload(req.auth!.userId) });
});

// POST /api/auth/change-password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.').max(100),
});

router.post('/change-password', requireAuth, (req: AuthRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid password input.' });
    return;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(req.auth!.userId) as { password_hash: string } | undefined;

  if (!row || !bcrypt.compareSync(parsed.data.currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    newHash,
    nowIso(),
    req.auth!.userId
  );

  res.json({ message: 'Password updated successfully.' });
});

export default router;

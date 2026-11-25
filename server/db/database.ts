import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';

let dbInstance: DatabaseSync | null = null;

export function generateId(prefix = ''): string {
  const random = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${random}` : random;
}

export function generateInviteToken(): string {
  return crypto.randomBytes(12).toString('base64url').toUpperCase();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function calculateGrade(percentage: number): { grade: string; status: string } {
  if (percentage >= 90) return { grade: 'AA', status: 'Distinction' };
  if (percentage >= 80) return { grade: 'AB', status: 'First Class with Distinction' };
  if (percentage >= 70) return { grade: 'BB', status: 'First Class' };
  if (percentage >= 60) return { grade: 'BC', status: 'Second Class' };
  if (percentage >= 50) return { grade: 'CC', status: 'Pass' };
  if (percentage >= 40) return { grade: 'DD', status: 'Pass' };
  return { grade: 'FF', status: 'Needs Improvement' };
}

export function getDbPath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return path.resolve(process.cwd(), process.env.SQLITE_DB_PATH);
  }
  return path.resolve(process.cwd(), 'data', 'campuscore.db');
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  initializeSchema(dbInstance);
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function runTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('HOD', 'PROFESSOR', 'STUDENT')),
      phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      college TEXT NOT NULL DEFAULT 'Gujarat Institute of Technology — DEMO',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hod_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      hod_code TEXT NOT NULL UNIQUE,
      department_id TEXT NOT NULL REFERENCES departments(id),
      designation TEXT NOT NULL DEFAULT 'Head of Department',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professor_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      faculty_id TEXT NOT NULL UNIQUE,
      department_id TEXT NOT NULL REFERENCES departments(id),
      specialization TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      enrollment_number TEXT NOT NULL UNIQUE,
      department_id TEXT NOT NULL REFERENCES departments(id),
      current_semester INTEGER NOT NULL DEFAULT 1,
      batch TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      class_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department_id TEXT NOT NULL REFERENCES departments(id),
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      division TEXT NOT NULL,
      batch TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_by_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_classes_dept_sem ON classes(department_id, academic_year, semester);

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      max_marks REAL NOT NULL CHECK(max_marks > 0),
      assessment_type TEXT NOT NULL DEFAULT 'Mid-Semester Examination',
      assigned_professor_id TEXT REFERENCES professor_profiles(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(class_id, code)
    );
    CREATE INDEX IF NOT EXISTS idx_subjects_prof ON subjects(assigned_professor_id);

    CREATE TABLE IF NOT EXISTS class_students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      enrollment_number TEXT NOT NULL,
      roster_name TEXT,
      student_profile_id TEXT REFERENCES student_profiles(id),
      is_enrolled INTEGER NOT NULL DEFAULT 0,
      enrolled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(class_id, enrollment_number)
    );
    CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_profile_id);

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invitations_class ON invitations(class_id);

    CREATE TABLE IF NOT EXISTS professor_subject_requests (
      id TEXT PRIMARY KEY,
      professor_id TEXT NOT NULL REFERENCES professor_profiles(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      note TEXT,
      decided_by TEXT REFERENCES users(id),
      decided_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(professor_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS student_enrollment_requests (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_profile_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
      enrollment_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      decided_by TEXT REFERENCES users(id),
      decided_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(class_id, enrollment_number)
    );

    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
      obtained_marks REAL NOT NULL CHECK(obtained_marks >= 0),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(subject_id, student_id)
    );
    CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
    CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);

    CREATE TABLE IF NOT EXISTS subject_submissions (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
      professor_id TEXT REFERENCES professor_profiles(id),
      status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED')),
      locked_at TEXT,
      locked_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS result_publications (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      published_by TEXT NOT NULL REFERENCES users(id),
      published_at TEXT NOT NULL,
      notes TEXT,
      UNIQUE(class_id, version)
    );

    CREATE TABLE IF NOT EXISTS report_cards (
      id TEXT PRIMARY KEY,
      report_code TEXT NOT NULL UNIQUE,
      publication_id TEXT NOT NULL REFERENCES result_publications(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
      total_max_marks REAL NOT NULL,
      total_obtained REAL NOT NULL,
      percentage REAL NOT NULL,
      grade TEXT NOT NULL,
      result_status TEXT NOT NULL,
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(publication_id, student_id)
    );
    CREATE INDEX IF NOT EXISTS idx_report_cards_student ON report_cards(student_id);

    CREATE TABLE IF NOT EXISTS academic_remarks (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
      professor_id TEXT NOT NULL REFERENCES professor_profiles(id),
      remark_text TEXT NOT NULL,
      is_ai_drafted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(subject_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS behavioral_evaluations (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
      attendance TEXT NOT NULL,
      discipline TEXT NOT NULL,
      notes TEXT,
      evaluated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(class_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      subject_id TEXT,
      student_enrollment TEXT,
      previous_value TEXT,
      new_value TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_logs(subject_id);
  `);
}

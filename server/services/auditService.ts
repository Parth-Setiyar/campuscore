import type { DatabaseSync } from 'node:sqlite';
import { generateId, getDb, nowIso } from '../db/database.ts';
import type { UserRole } from '../middleware/auth.ts';

export interface AuditLogInput {
  actorUserId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  subjectId?: string | null;
  studentEnrollment?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  details?: string | null;
}

export function recordAuditLog(input: AuditLogInput, tx?: DatabaseSync): void {
  const db = tx ?? getDb();
  db.prepare(
    `INSERT INTO audit_logs (
      id, actor_user_id, actor_role, action, entity_type, entity_id,
      subject_id, student_enrollment, previous_value, new_value, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateId('aud'),
    input.actorUserId,
    input.actorRole,
    input.action,
    input.entityType,
    input.entityId,
    input.subjectId ?? null,
    input.studentEnrollment ?? null,
    input.previousValue ?? null,
    input.newValue ?? null,
    input.details ?? null,
    nowIso()
  );
}

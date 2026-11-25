import type { DatabaseSync } from 'node:sqlite';
import { generateId, getDb, nowIso } from '../db/database.ts';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}

export function createNotification(input: CreateNotificationInput, tx?: DatabaseSync): void {
  const db = tx ?? getDb();
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    generateId('ntf'),
    input.userId,
    input.type,
    input.title,
    input.message,
    input.link ?? null,
    nowIso()
  );
}

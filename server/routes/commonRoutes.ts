import { Router } from 'express';
import { getDb } from '../db/database.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

// GET /api/notifications
router.get('/notifications', (req: AuthRequest, res) => {
  const db = getDb();
  const notifications = db
    .prepare(
      `SELECT id, type, title, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all(req.auth!.userId);

  const unreadCount = (
    db
      .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.auth!.userId) as { c: number }
  ).c;

  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', (req: AuthRequest, res) => {
  const db = getDb();
  const result = db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.auth!.userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }
  res.json({ message: 'Notification marked as read.' });
});

// POST /api/notifications/read-all
router.post('/notifications/read-all', (req: AuthRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(
    req.auth!.userId
  );
  res.json({ message: 'All notifications marked as read.' });
});

export default router;

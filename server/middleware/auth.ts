import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.ts';

export type UserRole = 'HOD' | 'PROFESSOR' | 'STUDENT';

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  email: string;
  profileId: string;
  jti: string;
}

export interface AuthRequest extends Request {
  auth?: AuthTokenPayload;
}

const RUNTIME_JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16
    ? process.env.JWT_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

// In-memory revoked token IDs with expiry timestamps so logout immediately invalidates JWTs
const revokedTokens = new Map<string, number>();

function pruneRevokedTokens(): void {
  const now = Date.now();
  for (const [jti, expMs] of revokedTokens.entries()) {
    if (expMs <= now) {
      revokedTokens.delete(jti);
    }
  }
}

export function signAuthToken(payload: Omit<AuthTokenPayload, 'jti'>, expiresInSeconds = TOKEN_TTL_SECONDS): string {
  const jti = crypto.randomBytes(12).toString('hex');
  return jwt.sign({ ...payload, jti }, RUNTIME_JWT_SECRET, {
    expiresIn: expiresInSeconds,
  });
}

export function revokeToken(token: string): void {
  try {
    const decoded = jwt.verify(token, RUNTIME_JWT_SECRET) as AuthTokenPayload & { exp?: number };
    if (decoded.jti) {
      const expMs = decoded.exp ? decoded.exp * 1000 : Date.now() + TOKEN_TTL_SECONDS * 1000;
      revokedTokens.set(decoded.jti, expMs);
      pruneRevokedTokens();
    }
  } catch {
    // Already invalid or expired
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication token is missing.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, RUNTIME_JWT_SECRET) as AuthTokenPayload;
    if (decoded.jti && revokedTokens.has(decoded.jti)) {
      res.status(401).json({ error: 'Session has been logged out. Please sign in again.' });
      return;
    }

    const db = getDb();
    const userRow = db
      .prepare('SELECT id, role, is_active FROM users WHERE id = ?')
      .get(decoded.userId) as { id: string; role: string; is_active: number } | undefined;

    if (!userRow || userRow.is_active !== 1 || userRow.role !== decoded.role) {
      res.status(401).json({ error: 'Account is inactive or invalid.' });
      return;
    }

    req.auth = decoded;
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      error: isExpired
        ? 'Your session has expired. Please sign in again.'
        : 'Invalid authentication token.',
      code: isExpired ? 'SESSION_EXPIRED' : 'INVALID_TOKEN',
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Access denied for your account role.' });
      return;
    }
    next();
  };
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 500 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait a few minutes and try again.' },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down your requests.' },
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { seedDatabaseIfEmpty } from './server/db/seed.ts';
import { apiRateLimiter } from './server/middleware/auth.ts';
import authRoutes from './server/routes/authRoutes.ts';
import hodRoutes from './server/routes/hodRoutes.ts';
import professorRoutes from './server/routes/professorRoutes.ts';
import studentRoutes from './server/routes/studentRoutes.ts';
import commonRoutes from './server/routes/commonRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  seedDatabaseIfEmpty();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers configured cleanly for embedded iframe previews and local PDF/QR rendering
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  // Restrictive CORS (same-origin + configured APP_URL, never wildcard on authenticated endpoints)
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  if (process.env.APP_URL) {
    try {
      allowedOrigins.add(new URL(process.env.APP_URL).origin);
    } catch {
      // ignore invalid APP_URL
    }
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin) || origin.endsWith('.run.app')) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS policy'));
      },
      credentials: false,
    })
  );

  app.use(express.json({ limit: '4mb' }));
  app.use('/api', apiRateLimiter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'CAMPUSCORE API' });
  });

  // Mount role-scoped API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/hod', hodRoutes);
  app.use('/api/professor', professorRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api', commonRoutes);

  // 404 handler for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Centralized Express error handler
  app.use(
    (
      err: Error & { statusCode?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const statusCode = err.statusCode ?? 500;
      if (statusCode >= 500) {
        console.error('[CAMPUSCORE Error]', err);
      }
      res.status(statusCode).json({
        error: statusCode >= 500 ? 'Internal server error. Please try again.' : err.message,
      });
    }
  );

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build artifacts not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CAMPUSCORE server running on http://0.0.0.0:${port}`);
  });
}

// Start only when executed directly (allows tests to import createApp without binding port)
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((err) => {
    console.error('Failed to start CAMPUSCORE server:', err);
    process.exit(1);
  });
}

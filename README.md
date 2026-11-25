# CAMPUSCORE — Smart College Result & AI Report Card Portal

CAMPUSCORE is a full-stack institutional college result management portal built for **HOD / Administrators**, **Professors**, and **Students** with synchronized atomic result publication, private student records, QR code class invitations, SheetJS Excel marks import with conflict resolution, official PDF report cards, immutable audit logs, and server-side Gemini AI academic remarks & student insights.

## Demo Institution & Seeded Credentials

The application automatically seeds realistic demo data for **Gujarat Institute of Technology — DEMO** on first startup:

| Role | Identifier / Email | Password | Notes |
| --- | --- | --- | --- |
| **HOD / Admin** | `HOD-CE-001` or `hod.ce@git-demo.edu` | `Hod@2026!` | Computer Engineering HOD |
| **Professor 1** | `FAC-CE-101` or `ananya.sharma@git-demo.edu` | `Prof@2026!` | Assigned locked & in-progress subjects |
| **Professor 2** | `FAC-CE-102` or `rajesh.mehta@git-demo.edu` | `Prof@2026!` | Pending subject access request in Sem 4 Div A |
| **Professor 3** | `FAC-CE-103` or `sneha.desai@git-demo.edu` | `Prof@2026!` | Assigned Sem 4 Div B (locked) & Sem 4 Div A |
| **Students (1–8)** | `GIT23CE001` – `GIT23CE008` | `Student@2026!` | Published Sem 3 report cards + enrolled in Sem 4 |
| **Student 9 (Pending)** | `GIT23CE009` | `Student@2026!` | Has a pending enrollment request in Sem 4 Div A |
| **Student 10 (Invite Slot)** | `GIT23CE010` | *(Register via Invite)* | Pre-loaded on Sem 4 Div A roster for new invite registration |

**Active Demo Class Invitation Codes:**
- `GIT-CE4A-2026` — Sem 4 Computer Engineering Division A (Mixed status: 1 Locked, 1 In Progress, 1 Not Started)
- `GIT-CE4B-2026` — Sem 4 Computer Engineering Division B (All required subjects locked — ready for HOD atomic publication)

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, Recharts, `qrcode.react`, `html5-qrcode`, SheetJS (`xlsx`), `jsPDF`, Lucide Icons
- **Backend:** Express.js, TypeScript (`tsx`), JWT Bearer Authentication (in-memory frontend session + server-side token revocation), `bcryptjs`, Zod, Helmet, Express Rate Limit
- **Database:** Embedded relational SQLite via Node 22 `node:sqlite` (`data/campuscore.db`) with 19 normalized tables, foreign keys, unique constraints, and atomic SQL transactions (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`), plus a complete MySQL 8.0 Prisma schema (`/prisma/schema.prisma`) and `/docker-compose.yml`
- **AI:** Server-side `@google/genai` SDK (`GEMINI_API_KEY` stays strictly on the backend)

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `GEMINI_API_KEY` — Google Gemini API key for server-side academic remark drafting and student study insights
- `JWT_SECRET` — Strong random secret for signing authentication tokens (auto-generates a secure ephemeral runtime secret if omitted in development)
- `APP_URL` — Public URL of the portal for generating QR invitation links
- `PORT` — Server port (defaults to `3000`)
- `SQLITE_DB_PATH` — Optional custom SQLite database file path (defaults to `./data/campuscore.db`)
- `DATABASE_URL` — Optional MySQL connection string when deploying with Prisma + MySQL

## Running Locally

```bash
npm install
npm run dev
```

The portal and Express API run together on `http://localhost:3000`.

### Production Build & Start

```bash
npm run build
npm start
```

## Optional MySQL + Prisma Setup (Docker Compose)

If you prefer running against MySQL 8.0 in your own environment:

```bash
docker compose up -d
npx prisma generate
npx prisma migrate dev --name init
```

## Running Automated Verification Tests

Execute the end-to-end API workflow test suite (verifies all 20 critical security, locking, atomic publication, roster validation, Excel conflict resolution, audit logging, and ownership isolation workflows against an isolated test database):

```bash
npm test
```

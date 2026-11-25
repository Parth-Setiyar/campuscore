import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

// Configure isolated test SQLite database before loading server modules
const testDbPath = path.resolve(process.cwd(), 'data', 'test_campuscore.db');
process.env.SQLITE_DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'campuscore-test-secret-only-32-chars-long!!';

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { createApp } = await import('../server.ts');
const { closeDb } = await import('../server/db/database.ts');

const app = createApp();
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', () => resolve()));
const { port } = server.address() as AddressInfo;
const BASE_URL = `http://127.0.0.1:${port}`;

async function api<T = Record<string, unknown>>(
  endpoint: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}`);
    console.error('        ', err instanceof Error ? err.message : err);
  }
}

console.log('\nRunning CAMPUSCORE End-to-End API Verification Suite (20 Workflows)...\n');

// Shared tokens & IDs across chained workflow tests
let hodToken = '';
let prof1Token = '';
let prof2Token = '';
let stu1Token = '';
let stu2Token = '';
let stu1ProfileId = '';
let stu2ProfileId = '';
let prof2ProfileId = '';

let createdClassId = '';
let createdInviteId = '';
let createdInviteToken = '';
let subjectAId = '';
let subjectBId = '';
let enrollmentReqId = '';
let profSubjectReqId = '';

try {
  // Login seeded accounts
  {
    const hodLogin = await api<{ token: string }>('/api/auth/login/hod', {
      method: 'POST',
      body: { identifier: 'HOD-CE-001', password: 'Hod@2026!' },
    });
    assert.equal(hodLogin.status, 200);
    hodToken = hodLogin.data.token;

    const p1 = await api<{ token: string }>('/api/auth/login/professor', {
      method: 'POST',
      body: { identifier: 'FAC-CE-101', password: 'Prof@2026!' },
    });
    assert.equal(p1.status, 200);
    prof1Token = p1.data.token;

    const p2 = await api<{ token: string; user: { profile: { id: string } } }>(
      '/api/auth/login/professor',
      {
        method: 'POST',
        body: { identifier: 'FAC-CE-102', password: 'Prof@2026!' },
      }
    );
    assert.equal(p2.status, 200);
    prof2Token = p2.data.token;
    prof2ProfileId = p2.data.user.profile.id;

    const s1 = await api<{ token: string; user: { profile: { id: string } } }>(
      '/api/auth/login/student',
      {
        method: 'POST',
        body: { enrollmentNumber: 'GIT23CE001', password: 'Student@2026!' },
      }
    );
    assert.equal(s1.status, 200);
    stu1Token = s1.data.token;
    stu1ProfileId = s1.data.user.profile.id;

    const s2 = await api<{ token: string; user: { profile: { id: string } } }>(
      '/api/auth/login/student',
      {
        method: 'POST',
        body: { enrollmentNumber: 'GIT23CE002', password: 'Student@2026!' },
      }
    );
    assert.equal(s2.status, 200);
    stu2Token = s2.data.token;
    stu2ProfileId = s2.data.user.profile.id;
  }

  // 1. HOD creates a class with subjects and roster
  await test('1. HOD creates a class with subjects, roster, and secure invitation token', async () => {
    const meta = await api<{
      departments: Array<{ id: string }>;
      professors: Array<{ id: string; faculty_id: string }>;
    }>('/api/hod/meta', { token: hodToken });
    assert.equal(meta.status, 200);

    const deptId = meta.data.departments[0].id;
    const prof1 = meta.data.professors.find((p) => p.faculty_id === 'FAC-CE-101')!;

    const res = await api<{
      classId: string;
      invitation: { id: string; token: string };
    }>('/api/hod/classes', {
      method: 'POST',
      token: hodToken,
      body: {
        departmentId: deptId,
        academicYear: '2026-27',
        semester: 5,
        division: 'A',
        batch: '2023-2027',
        name: 'Sem 5 Computer Engineering — Div A (Test)',
        inviteExpiresInDays: 14,
        subjects: [
          {
            code: 'CE501',
            name: 'Software Engineering',
            maxMarks: 50,
            assessmentType: 'Mid-Semester Examination',
            assignedProfessorId: prof1.id,
          },
          {
            code: 'CE502',
            name: 'Compiler Design',
            maxMarks: 50,
            assessmentType: 'Mid-Semester Examination',
            assignedProfessorId: null,
          },
        ],
        roster: [
          { enrollmentNumber: 'GIT23CE001', rosterName: 'Aarav Patel' },
          { enrollmentNumber: 'GIT23CE002', rosterName: 'Diya Shah' },
        ],
      },
    });
    assert.equal(res.status, 201);
    createdClassId = res.data.classId;
    createdInviteId = res.data.invitation.id;
    createdInviteToken = res.data.invitation.token;
    assert.ok(createdClassId && createdInviteToken);

    const detail = await api<{ subjects: Array<{ id: string; code: string }> }>(
      `/api/hod/classes/${createdClassId}`,
      { token: hodToken }
    );
    subjectAId = detail.data.subjects.find((s) => s.code === 'CE501')!.id;
    subjectBId = detail.data.subjects.find((s) => s.code === 'CE502')!.id;
    assert.ok(subjectAId && subjectBId);
  });

  // 2. Duplicate enrollment validation on roster creation/upload
  await test('2. Duplicate enrollment validation rejects duplicates on class creation & roster import', async () => {
    const meta = await api<{ departments: Array<{ id: string }> }>('/api/hod/meta', {
      token: hodToken,
    });
    const dupClass = await api<{ error: string }>('/api/hod/classes', {
      method: 'POST',
      token: hodToken,
      body: {
        departmentId: meta.data.departments[0].id,
        academicYear: '2026-27',
        semester: 5,
        division: 'Z',
        batch: '2023-2027',
        name: 'Duplicate Roster Test',
        subjects: [{ code: 'CE599', name: 'Test Sub', maxMarks: 50 }],
        roster: [
          { enrollmentNumber: 'GIT23CE001', rosterName: 'Dup 1' },
          { enrollmentNumber: 'git23ce001', rosterName: 'Dup 2' },
        ],
      },
    });
    assert.equal(dupClass.status, 400);

    const rosterAdd = await api<{ addedCount: number; duplicates: string[] }>(
      `/api/hod/classes/${createdClassId}/roster`,
      {
        method: 'POST',
        token: hodToken,
        body: {
          students: [{ enrollmentNumber: 'GIT23CE001', rosterName: 'Aarav Patel' }],
        },
      }
    );
    assert.equal(rosterAdd.status, 201);
    assert.equal(rosterAdd.data.addedCount, 0);
    assert.deepEqual(rosterAdd.data.duplicates, ['GIT23CE001']);
  });

  // 3. QR/invitation token lookup leaks zero student data + revocation & regeneration work
  await test('3. Invitation token exposes zero student data and supports revoke & regenerate', async () => {
    const info = await api<Record<string, unknown>>(`/api/auth/invite-info/${createdInviteToken}`);
    assert.equal(info.status, 200);
    assert.equal('roster' in info.data, false);
    assert.equal('students' in info.data, false);
    assert.equal('marks' in info.data, false);

    const revoke = await api(`/api/hod/invitations/${createdInviteId}/revoke`, {
      method: 'PATCH',
      token: hodToken,
    });
    assert.equal(revoke.status, 200);

    const revokedLookup = await api(`/api/auth/invite-info/${createdInviteToken}`);
    assert.equal(revokedLookup.status, 410);

    const regen = await api<{ id: string; token: string }>(
      `/api/hod/classes/${createdClassId}/invitations/regenerate`,
      {
        method: 'POST',
        token: hodToken,
        body: { expiresInDays: 30 },
      }
    );
    assert.equal(regen.status, 201);
    assert.notEqual(regen.data.token, createdInviteToken);
    createdInviteToken = regen.data.token;
  });

  // 4. Student enrollment request via invitation (valid roster passes, non-roster rejected, duplicate blocked)
  await test('4. Student enrollment via invitation enforces roster membership & blocks duplicates', async () => {
    // Student 3 is NOT on createdClassId roster
    const s3Login = await api<{ token: string }>('/api/auth/login/student', {
      method: 'POST',
      body: { enrollmentNumber: 'GIT23CE003', password: 'Student@2026!' },
    });
    const nonRoster = await api('/api/student/join-class', {
      method: 'POST',
      token: s3Login.data.token,
      body: { inviteCode: createdInviteToken },
    });
    assert.equal(nonRoster.status, 403);

    // Student 1 IS on roster
    const join1 = await api<{ id: string; status: string }>('/api/student/join-class', {
      method: 'POST',
      token: stu1Token,
      body: { inviteCode: createdInviteToken },
    });
    assert.equal(join1.status, 201);
    assert.equal(join1.data.status, 'PENDING');
    enrollmentReqId = join1.data.id;

    // Duplicate request blocked
    const dupJoin = await api('/api/student/join-class', {
      method: 'POST',
      token: stu1Token,
      body: { inviteCode: createdInviteToken },
    });
    assert.equal(dupJoin.status, 409);

    // Student 2 also joins
    const join2 = await api<{ id: string }>('/api/student/join-class', {
      method: 'POST',
      token: stu2Token,
      body: { inviteCode: createdInviteToken },
    });
    assert.equal(join2.status, 201);

    // Approve Student 2 right away for subsequent multi-student tests
    const approve2 = await api(`/api/hod/enrollment-requests/${join2.data.id}/decide`, {
      method: 'POST',
      token: hodToken,
      body: { decision: 'APPROVED' },
    });
    assert.equal(approve2.status, 200);
  });

  // 5. HOD approves/rejects student enrollment request
  await test('5. HOD approves student enrollment request and enrolls student into class', async () => {
    const res = await api(`/api/hod/enrollment-requests/${enrollmentReqId}/decide`, {
      method: 'POST',
      token: hodToken,
      body: { decision: 'APPROVED' },
    });
    assert.equal(res.status, 200);

    // Already enrolled student cannot re-request
    const reJoin = await api('/api/student/join-class', {
      method: 'POST',
      token: stu1Token,
      body: { inviteCode: createdInviteToken },
    });
    assert.equal(reJoin.status, 409);
  });

  // 6. Professor requests subject access & HOD approves
  await test('6. Professor requests subject access via invitation and HOD approves', async () => {
    const req = await api<{ id: string; status: string }>('/api/professor/join-request', {
      method: 'POST',
      token: prof2Token,
      body: {
        inviteCode: createdInviteToken,
        subjectId: subjectBId,
        note: 'Teaching CE502 Compiler Design',
      },
    });
    assert.equal(req.status, 201);
    profSubjectReqId = req.data.id;

    // Before approval, prof2 is denied access to subjectB
    const denied = await api(`/api/professor/subjects/${subjectBId}/marks`, { token: prof2Token });
    assert.equal(denied.status, 403);

    const approve = await api(`/api/hod/subject-requests/${profSubjectReqId}/decide`, {
      method: 'POST',
      token: hodToken,
      body: { decision: 'APPROVED' },
    });
    assert.equal(approve.status, 200);

    const allowed = await api(`/api/professor/subjects/${subjectBId}/marks`, { token: prof2Token });
    assert.equal(allowed.status, 200);
  });

  // 7. Only authorized professors can view or enter marks
  await test('7. Unauthorized professor receives 403 when viewing or editing another subject', async () => {
    const viewUnauth = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      token: prof2Token,
    });
    assert.equal(viewUnauth.status, 403);

    const editUnauth = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof2Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 40 }] },
    });
    assert.equal(editUnauth.status, 403);
  });

  // 8. Excel import preview & confirm (valid, invalid, duplicates, missing, conflict preservation)
  await test('8. Excel import validates rows, flags conflicts, and never silently overwrites', async () => {
    // Seed an existing mark for Student 1 in CE501
    const seedMark = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 42 }] },
    });
    assert.equal(seedMark.status, 200);

    const preview = await api<{
      summary: { readyCount: number; conflictCount: number; errorCount: number };
      rows: Array<{ rowNumber: number; status: string; errors: string[] }>;
    }>(`/api/professor/subjects/${subjectAId}/import-preview`, {
      method: 'POST',
      token: prof1Token,
      body: {
        rows: [
          { rowNumber: 2, enrollmentNumber: 'GIT23CE001', marksRaw: 48 }, // CONFLICT with 42
          { rowNumber: 3, enrollmentNumber: 'GIT23CE002', marksRaw: 45 }, // READY
          { rowNumber: 4, enrollmentNumber: 'GIT23CE002', marksRaw: 40 }, // ERROR duplicate
          { rowNumber: 5, enrollmentNumber: 'GIT23CE001', marksRaw: -5 }, // ERROR negative + duplicate
          { rowNumber: 6, enrollmentNumber: 'UNKNOWN999', marksRaw: 90 }, // ERROR unknown + > maxMarks
        ],
      },
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.summary.conflictCount, 1);
    assert.equal(preview.data.summary.readyCount, 1);
    assert.equal(preview.data.summary.errorCount, 3);

    // Confirm with overwrite: false for Student 1 -> must NOT silently overwrite 42
    const confirm = await api<{ created: number; overwritten: number; skipped: number }>(
      `/api/professor/subjects/${subjectAId}/import-confirm`,
      {
        method: 'POST',
        token: prof1Token,
        body: {
          entries: [
            { studentId: stu1ProfileId, obtainedMarks: 48, overwrite: false },
            { studentId: stu2ProfileId, obtainedMarks: 45, overwrite: false },
          ],
        },
      }
    );
    assert.equal(confirm.status, 200);
    assert.equal(confirm.data.created, 1);
    assert.equal(confirm.data.overwritten, 0);
    assert.equal(confirm.data.skipped, 1);
  });

  // 9. Marks validation rejects negative and > maxMarks
  await test('9. Marks validation rejects negative values and marks exceeding maxMarks', async () => {
    const neg = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: -1 }] },
    });
    assert.equal(neg.status, 400);

    const over = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 51 }] },
    });
    assert.equal(over.status, 400);
  });

  // 10. Dynamic topper updates correctly and handles ties
  await test('10. Dynamic subject topper calculation updates live and detects ties', async () => {
    // Update Student 1 to 45 (tie with Student 2 at 45)
    const tieUpdate = await api<{
      topper: { highestMarks: number; isTie: boolean; toppers: Array<{ enrollmentNumber: string }> };
    }>(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 45 }] },
    });
    assert.equal(tieUpdate.status, 200);
    assert.equal(tieUpdate.data.topper.highestMarks, 45);
    assert.equal(tieUpdate.data.topper.isTie, true);
    assert.equal(tieUpdate.data.topper.toppers.length, 2);

    // Update Student 1 to 49 -> sole topper
    const soloUpdate = await api<{
      topper: { highestMarks: number; isTie: boolean; toppers: Array<{ enrollmentNumber: string }> };
    }>(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 49 }] },
    });
    assert.equal(soloUpdate.status, 200);
    assert.equal(soloUpdate.data.topper.highestMarks, 49);
    assert.equal(soloUpdate.data.topper.isTie, false);
    assert.equal(soloUpdate.data.topper.toppers[0].enrollmentNumber, 'GIT23CE001');
  });

  // 11. Subject locking blocks missing marks and succeeds when complete
  await test('11. Subject locking blocks incomplete marks and succeeds when all enrolled students graded', async () => {
    // Subject B has 0 marks entered -> lock must fail
    const lockFail = await api(`/api/professor/subjects/${subjectBId}/lock`, {
      method: 'POST',
      token: prof2Token,
    });
    assert.equal(lockFail.status, 400);

    // Subject A has all 2 enrolled students graded -> lock must succeed
    const lockA = await api(`/api/professor/subjects/${subjectAId}/lock`, {
      method: 'POST',
      token: prof1Token,
    });
    assert.equal(lockA.status, 200);
  });

  // 12. Locked subject blocks normal professor edits; HOD audited unlock re-enables editing
  await test('12. Locked subject rejects professor edits and supports audited HOD unlock', async () => {
    const blocked = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 47 }] },
    });
    assert.equal(blocked.status, 403);

    // HOD unlocks with audit reason
    const unlock = await api(`/api/hod/subjects/${subjectAId}/unlock`, {
      method: 'POST',
      token: hodToken,
      body: { reason: 'Re-evaluation correction approved by exam committee' },
    });
    assert.equal(unlock.status, 200);

    // Professor can now update and re-lock
    const editNow = await api(`/api/professor/subjects/${subjectAId}/marks`, {
      method: 'PUT',
      token: prof1Token,
      body: { entries: [{ studentId: stu1ProfileId, obtainedMarks: 48 }] },
    });
    assert.equal(editNow.status, 200);

    const relock = await api(`/api/professor/subjects/${subjectAId}/lock`, {
      method: 'POST',
      token: prof1Token,
    });
    assert.equal(relock.status, 200);
  });

  // 13. Audit logs record previous/new marks, lock, and HOD unlock
  await test('13. Append-only audit logs record mark edits, subject locks, and HOD unlocks', async () => {
    const logs = await api<{
      logs: Array<{ action: string; previous_value: string | null; new_value: string | null }>;
    }>('/api/hod/audit-logs?limit=50', { token: hodToken });
    assert.equal(logs.status, 200);

    const actions = new Set(logs.data.logs.map((l) => l.action));
    assert.ok(actions.has('MARKS_UPDATED'), 'Expected MARKS_UPDATED audit event');
    assert.ok(actions.has('SUBJECT_LOCKED'), 'Expected SUBJECT_LOCKED audit event');
    assert.ok(actions.has('SUBJECT_UNLOCKED_BY_HOD'), 'Expected SUBJECT_UNLOCKED_BY_HOD audit event');

    const updateEvent = logs.data.logs.find(
      (l) => l.action === 'MARKS_UPDATED' && l.new_value === '48 / 50'
    );
    assert.ok(updateEvent, 'Expected previous -> new mark transition in audit log');
    assert.equal(updateEvent.previous_value, '49 / 50');
  });

  // 14. Publication blocked if even one required subject is not locked
  await test('14. Publication is blocked (400) if even one subject is not locked', async () => {
    // Subject B is still NOT_STARTED
    const blockedPub = await api(`/api/hod/classes/${createdClassId}/publish`, {
      method: 'POST',
      token: hodToken,
      body: { notes: 'Should fail' },
    });
    assert.equal(blockedPub.status, 400);
  });

  // 16 (checked BEFORE publishing createdClassId!). Students cannot see partial results for unpublished class
  await test('15. Students see AWAITING ALL SUBJECTS with zero partial marks before publication', async () => {
    const statusRes = await api<{
      statuses: Array<{
        classId: string;
        isPublished: boolean;
        statusLabel: string;
        reportCardId: string | null;
      }>;
    }>('/api/student/result-status', { token: stu1Token });
    assert.equal(statusRes.status, 200);
    const pendingCls = statusRes.data.statuses.find((s) => s.classId === createdClassId);
    assert.ok(pendingCls);
    assert.equal(pendingCls.isPublished, false);
    assert.equal(pendingCls.statusLabel, 'AWAITING ALL SUBJECTS');
    assert.equal(pendingCls.reportCardId, null);
    // Ensure zero mark/grade leakage keys exist
    assert.equal('marks' in pendingCls, false);
    assert.equal('percentage' in pendingCls, false);
    assert.equal('topper' in pendingCls, false);
  });

  // 15 (atomic publish). Enter Subject B marks, lock Subject B, and atomically publish
  await test('16. Atomic publication succeeds once all required subjects are locked', async () => {
    const enterB = await api(`/api/professor/subjects/${subjectBId}/marks`, {
      method: 'PUT',
      token: prof2Token,
      body: {
        entries: [
          { studentId: stu1ProfileId, obtainedMarks: 44 },
          { studentId: stu2ProfileId, obtainedMarks: 41 },
        ],
      },
    });
    assert.equal(enterB.status, 200);

    // Save an academic remark for Student 1 on Subject B
    const remarkSave = await api(`/api/professor/subjects/${subjectBId}/remarks`, {
      method: 'PUT',
      token: prof2Token,
      body: {
        studentId: stu1ProfileId,
        remarkText: 'Strong analytical grasp of lexical and syntax analysis concepts.',
        isAiDrafted: false,
      },
    });
    assert.equal(remarkSave.status, 200);

    const lockB = await api(`/api/professor/subjects/${subjectBId}/lock`, {
      method: 'POST',
      token: prof2Token,
    });
    assert.equal(lockB.status, 200);

    const publish = await api<{
      publicationId: string;
      version: number;
      reportCardsGenerated: number;
    }>(`/api/hod/classes/${createdClassId}/publish`, {
      method: 'POST',
      token: hodToken,
      body: { notes: 'Verified Sem 5 Div A release' },
    });
    assert.equal(publish.status, 201);
    assert.equal(publish.data.version, 1);
    assert.equal(publish.data.reportCardsGenerated, 2);
  });

  // 17. Strict student privacy: cannot access another student's report card by changing ID
  let stu1Sem5ReportCardId = '';
  let stu2Sem5ReportCardId = '';
  await test('17. Student receives 403 when attempting to access another student report card ID', async () => {
    const s1Cards = await api<{ reportCards: Array<{ id: string; class_id: string }> }>(
      '/api/student/report-cards',
      { token: stu1Token }
    );
    const s2Cards = await api<{ reportCards: Array<{ id: string; class_id: string }> }>(
      '/api/student/report-cards',
      { token: stu2Token }
    );
    stu1Sem5ReportCardId = s1Cards.data.reportCards.find((r) => r.class_id === createdClassId)!.id;
    stu2Sem5ReportCardId = s2Cards.data.reportCards.find((r) => r.class_id === createdClassId)!.id;
    assert.ok(stu1Sem5ReportCardId && stu2Sem5ReportCardId);

    // Student 1 tries to fetch Student 2's report card ID
    const crossAccess = await api(`/api/student/report-cards/${stu2Sem5ReportCardId}`, {
      token: stu1Token,
    });
    assert.equal(crossAccess.status, 403);
  });

  // 18. Official report card payload contains complete institutional header, subject marks, totals, grade, remarks, unique reportCode
  await test('18. Official report card contains complete verified marks, grade, remarks, and unique reportCode', async () => {
    const rcRes = await api<{
      reportCard: {
        reportCode: string;
        college: string;
        studentName: string;
        enrollmentNumber: string;
        totalObtained: number;
        totalMaxMarks: number;
        percentage: number;
        grade: string;
        subjects: Array<{ subjectCode: string; obtainedMarks: number; remarkText: string | null }>;
      };
    }>(`/api/student/report-cards/${stu1Sem5ReportCardId}`, { token: stu1Token });
    assert.equal(rcRes.status, 200);
    const rc = rcRes.data.reportCard;
    assert.ok(rc.reportCode.startsWith('RC-'));
    assert.equal(rc.enrollmentNumber, 'GIT23CE001');
    assert.equal(rc.totalObtained, 92); // 48 + 44
    assert.equal(rc.totalMaxMarks, 100);
    assert.equal(rc.percentage, 92);
    assert.equal(rc.grade, 'AA');
    assert.equal(rc.subjects.length, 2);
    assert.ok(rc.subjects.find((s) => s.subjectCode === 'CE502')?.remarkText?.includes('lexical'));
  });

  // 19. Previous semester records remain permanently accessible alongside new semesters
  await test('19. Previous semester records remain intact & accessible after publishing new semester', async () => {
    const cards = await api<{ reportCards: Array<{ semester: number; id: string }> }>(
      '/api/student/report-cards',
      { token: stu1Token }
    );
    assert.equal(cards.status, 200);
    const semesters = cards.data.reportCards.map((c) => c.semester);
    assert.ok(semesters.includes(3), 'Seeded Semester 3 record must remain accessible');
    assert.ok(semesters.includes(5), 'Newly published Semester 5 record must be present');

    const insights = await api<{ semesterTrend: Array<{ semester: number }>; trendDelta: number }>(
      '/api/student/insights?target=90',
      { token: stu1Token }
    );
    assert.equal(insights.status, 200);
    assert.ok(insights.data.semesterTrend.length >= 2);
    assert.equal(typeof insights.data.trendDelta, 'number');
  });

  // 20. Logout immediately revokes JWT token & expired JWT returns 401 SESSION_EXPIRED
  await test('20. Logout revokes JWT immediately and expired JWT returns 401 SESSION_EXPIRED', async () => {
    const logoutRes = await api('/api/auth/logout', { method: 'POST', token: stu1Token });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await api('/api/auth/me', { token: stu1Token });
    assert.equal(afterLogout.status, 401);

    const expiredToken = jwt.sign(
      { userId: 'usr_stu_1', role: 'STUDENT', email: 'test@git-demo.edu', profileId: prof2ProfileId },
      process.env.JWT_SECRET!,
      { expiresIn: -10 }
    );
    const expiredRes = await api<{ code: string }>('/api/auth/me', { token: expiredToken });
    assert.equal(expiredRes.status, 401);
    assert.equal(expiredRes.data.code, 'SESSION_EXPIRED');
  });
} finally {
  server.close();
  closeDb();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}

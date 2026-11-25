import bcrypt from 'bcryptjs';
import { calculateGrade, generateId, getDb, nowIso, runTransaction } from './database.ts';

export const DEMO_COLLEGE_NAME = 'Gujarat Institute of Technology — DEMO';

export function seedDatabaseIfEmpty(): void {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  const hodHash = bcrypt.hashSync('Hod@2026!', 10);
  const profHash = bcrypt.hashSync('Prof@2026!', 10);
  const studentHash = bcrypt.hashSync('Student@2026!', 10);

  const now = nowIso();
  const pastSemDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString();
  const recentDate = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();
  const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString();

  runTransaction((tx) => {
    // 1. Department
    const deptId = 'dept_ce_demo';
    tx.prepare(
      `INSERT INTO departments (id, code, name, college, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(deptId, 'CE', 'Computer Engineering', DEMO_COLLEGE_NAME, pastSemDate, now);

    // 2. HOD Account
    const hodUserId = 'usr_hod_demo';
    const hodProfileId = 'hod_prof_demo';
    tx.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'HOD', ?, 1, ?, ?)`
    ).run(hodUserId, 'hod.ce@git-demo.edu', hodHash, 'Dr. Vikram Patel', '+91 98250 11001', pastSemDate, now);

    tx.prepare(
      `INSERT INTO hod_profiles (id, user_id, hod_code, department_id, designation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(hodProfileId, hodUserId, 'HOD-CE-001', deptId, 'Professor & Head of Department', pastSemDate, now);

    // 3. Three Professor Accounts
    const professors = [
      {
        userId: 'usr_prof_1',
        profileId: 'prof_1',
        facultyId: 'FAC-CE-101',
        name: 'Prof. Ananya Sharma',
        email: 'ananya.sharma@git-demo.edu',
        phone: '+91 98250 22101',
        spec: 'Algorithms & Data Structures',
      },
      {
        userId: 'usr_prof_2',
        profileId: 'prof_2',
        facultyId: 'FAC-CE-102',
        name: 'Prof. Rajesh Mehta',
        email: 'rajesh.mehta@git-demo.edu',
        phone: '+91 98250 22102',
        spec: 'Database Systems & Cloud Engineering',
      },
      {
        userId: 'usr_prof_3',
        profileId: 'prof_3',
        facultyId: 'FAC-CE-103',
        name: 'Prof. Sneha Desai',
        email: 'sneha.desai@git-demo.edu',
        phone: '+91 98250 22103',
        spec: 'Operating Systems & Computer Architecture',
      },
    ];

    for (const p of professors) {
      tx.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, phone, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'PROFESSOR', ?, 1, ?, ?)`
      ).run(p.userId, p.email, profHash, p.name, p.phone, pastSemDate, now);

      tx.prepare(
        `INSERT INTO professor_profiles (id, user_id, faculty_id, department_id, specialization, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(p.profileId, p.userId, p.facultyId, deptId, p.spec, pastSemDate, now);
    }

    // 4. Ten Sample Students (first 9 have accounts, 10th is roster-only for invite registration demo!)
    const studentDefs = [
      { idx: 1, enr: 'GIT23CE001', name: 'Aarav Shah', email: 'aarav.shah@git-demo.edu' },
      { idx: 2, enr: 'GIT23CE002', name: 'Diya Trivedi', email: 'diya.trivedi@git-demo.edu' },
      { idx: 3, enr: 'GIT23CE003', name: 'Kabir Nair', email: 'kabir.nair@git-demo.edu' },
      { idx: 4, enr: 'GIT23CE004', name: 'Meera Iyer', email: 'meera.iyer@git-demo.edu' },
      { idx: 5, enr: 'GIT23CE005', name: 'Vihaan Joshi', email: 'vihaan.joshi@git-demo.edu' },
      { idx: 6, enr: 'GIT23CE006', name: 'Anika Verma', email: 'anika.verma@git-demo.edu' },
      { idx: 7, enr: 'GIT23CE007', name: 'Devansh Parmar', email: 'devansh.parmar@git-demo.edu' },
      { idx: 8, enr: 'GIT23CE008', name: 'Nisha Bhatt', email: 'nisha.bhatt@git-demo.edu' },
      { idx: 9, enr: 'GIT23CE009', name: 'Rohan Kulkarni', email: 'rohan.kulkarni@git-demo.edu' },
      { idx: 10, enr: 'GIT23CE010', name: 'Kavya Chauhan', email: 'kavya.chauhan@git-demo.edu' },
    ];

    for (const s of studentDefs) {
      if (s.idx <= 9) {
        tx.prepare(
          `INSERT INTO users (id, email, password_hash, full_name, role, phone, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'STUDENT', ?, 1, ?, ?)`
        ).run(
          `usr_stu_${s.idx}`,
          s.email,
          studentHash,
          s.name,
          `+91 98790 300${String(s.idx).padStart(2, '0')}`,
          pastSemDate,
          now
        );

        tx.prepare(
          `INSERT INTO student_profiles (id, user_id, enrollment_number, department_id, current_semester, batch, created_at, updated_at)
           VALUES (?, ?, ?, ?, 4, '2023-2027', ?, ?)`
        ).run(`stu_${s.idx}`, `usr_stu_${s.idx}`, s.enr, deptId, pastSemDate, now);
      }
    }

    // 5. Historical Published Class: Semester 3 — Division A (Published & Archived)
    const histClassId = 'cls_ce_sem3_a';
    tx.prepare(
      `INSERT INTO classes (id, class_code, name, department_id, academic_year, semester, division, batch, is_published, is_archived, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`
    ).run(
      histClassId,
      'CE-2025-S3-A',
      'CE Semester 3 — Division A',
      deptId,
      '2025-26',
      3,
      'A',
      '2023-2027',
      hodUserId,
      pastSemDate,
      pastSemDate
    );

    const histSubjects = [
      { id: 'sub_s3_1', code: 'CE301', name: 'Discrete Mathematics', maxMarks: 50, profId: 'prof_1', profUser: 'usr_prof_1' },
      { id: 'sub_s3_2', code: 'CE302', name: 'Database Fundamentals', maxMarks: 50, profId: 'prof_2', profUser: 'usr_prof_2' },
      { id: 'sub_s3_3', code: 'CE303', name: 'Computer Organization', maxMarks: 50, profId: 'prof_3', profUser: 'usr_prof_3' },
    ];

    for (const sub of histSubjects) {
      tx.prepare(
        `INSERT INTO subjects (id, class_id, code, name, max_marks, assessment_type, assigned_professor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Mid-Semester Examination', ?, ?, ?)`
      ).run(sub.id, histClassId, sub.code, sub.name, sub.maxMarks, sub.profId, pastSemDate, pastSemDate);

      tx.prepare(
        `INSERT INTO subject_submissions (id, subject_id, professor_id, status, locked_at, locked_by, created_at, updated_at)
         VALUES (?, ?, ?, 'LOCKED', ?, ?, ?, ?)`
      ).run(generateId('subm'), sub.id, sub.profId, pastSemDate, sub.profUser, pastSemDate, pastSemDate);
    }

    const histPubId = 'pub_ce_sem3_a_v1';
    tx.prepare(
      `INSERT INTO result_publications (id, class_id, version, published_by, published_at, notes)
       VALUES (?, ?, 1, ?, ?, ?)`
    ).run(histPubId, histClassId, hodUserId, pastSemDate, 'Verified and published Sem 3 mid-semester results.');

    // Historical marks for students 1..8
    const histScores: Record<number, [number, number, number]> = {
      1: [44, 41, 38],
      2: [47, 45, 43],
      3: [34, 36, 31],
      4: [42, 44, 40],
      5: [29, 32, 27],
      6: [46, 42, 44],
      7: [39, 35, 37],
      8: [41, 43, 39],
    };

    const histRemarks: Record<string, string> = {
      sub_s3_1: 'Demonstrates solid analytical reasoning in discrete structures; continuing practice on combinatorics will further strengthen precision.',
      sub_s3_2: 'Shows clear grasp of relational modeling and SQL fundamentals, with room to refine normalization edge cases.',
      sub_s3_3: 'Maintains consistent understanding of architecture concepts; additional focus on memory hierarchy problems is recommended.',
    };

    for (let i = 1; i <= 8; i++) {
      const stu = studentDefs[i - 1];
      const stuId = `stu_${i}`;
      tx.prepare(
        `INSERT INTO class_students (id, class_id, enrollment_number, roster_name, student_profile_id, is_enrolled, enrolled_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).run(generateId('cs'), histClassId, stu.enr, stu.name, stuId, pastSemDate, pastSemDate, pastSemDate);

      const scores = histScores[i];
      let totalObt = 0;
      const totalMax = 150;

      histSubjects.forEach((sub, idx) => {
        const obtained = scores[idx];
        totalObt += obtained;
        tx.prepare(
          `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(generateId('mrk'), sub.id, stuId, obtained, sub.profUser, pastSemDate, pastSemDate);

        tx.prepare(
          `INSERT INTO academic_remarks (id, subject_id, student_id, professor_id, remark_text, is_ai_drafted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
        ).run(generateId('rmk'), sub.id, stuId, sub.profId, histRemarks[sub.id], pastSemDate, pastSemDate);
      });

      const pct = Number(((totalObt / totalMax) * 100).toFixed(2));
      const { grade, status } = calculateGrade(pct);
      tx.prepare(
        `INSERT INTO report_cards (id, report_code, publication_id, class_id, student_id, total_max_marks, total_obtained, percentage, grade, result_status, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `rc_s3_${i}`,
        `RC-GIT-25S3-${String(i).padStart(3, '0')}`,
        histPubId,
        histClassId,
        stuId,
        totalMax,
        totalObt,
        pct,
        grade,
        status,
        pastSemDate,
        pastSemDate
      );

      if (i <= 4) {
        tx.prepare(
          `INSERT INTO behavioral_evaluations (id, class_id, student_id, attendance, discipline, notes, evaluated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          generateId('beh'),
          histClassId,
          stuId,
          i === 2 ? '96% (Regular)' : '91% (Satisfactory)',
          'Commendable',
          'Consistent participation in laboratory sessions and timely submissions.',
          hodUserId,
          pastSemDate,
          pastSemDate
        );
      }
    }

    // 6. Active Current Class: Semester 4 — Division A (1 Locked, 1 In Progress, 1 Not Started)
    const currClassId = 'cls_ce_sem4_a';
    tx.prepare(
      `INSERT INTO classes (id, class_code, name, department_id, academic_year, semester, division, batch, is_published, is_archived, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
    ).run(
      currClassId,
      'CE-2026-S4-A',
      'CE Semester 4 — Division A',
      deptId,
      '2025-26',
      4,
      'A',
      '2023-2027',
      hodUserId,
      recentDate,
      now
    );

    // Active invitation for Sem 4 Div A
    tx.prepare(
      `INSERT INTO invitations (id, class_id, token, expires_at, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    ).run('inv_ce_sem4_a', currClassId, 'GIT-CE4A-2026', inviteExpiry, hodUserId, recentDate, now);

    // Subjects for Sem 4 Div A
    // CE401: LOCKED (Prof. Ananya Sharma)
    // CE402: IN_PROGRESS (Prof. Rajesh Mehta)
    // CE403: NOT_STARTED (Prof. Sneha Desai)
    const currSubjects = [
      { id: 'sub_s4_1', code: 'CE401', name: 'Data Structures & Algorithms', maxMarks: 50, profId: 'prof_1', status: 'LOCKED' as const },
      { id: 'sub_s4_2', code: 'CE402', name: 'Database Management Systems', maxMarks: 50, profId: 'prof_2', status: 'IN_PROGRESS' as const },
      { id: 'sub_s4_3', code: 'CE403', name: 'Operating Systems', maxMarks: 50, profId: 'prof_3', status: 'NOT_STARTED' as const },
    ];

    for (const sub of currSubjects) {
      tx.prepare(
        `INSERT INTO subjects (id, class_id, code, name, max_marks, assessment_type, assigned_professor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Mid-Semester Examination', ?, ?, ?)`
      ).run(sub.id, currClassId, sub.code, sub.name, sub.maxMarks, sub.profId, recentDate, now);

      tx.prepare(
        `INSERT INTO subject_submissions (id, subject_id, professor_id, status, locked_at, locked_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateId('subm'),
        sub.id,
        sub.profId,
        sub.status,
        sub.status === 'LOCKED' ? recentDate : null,
        sub.status === 'LOCKED' ? 'usr_prof_1' : null,
        recentDate,
        now
      );
    }

    // Roster for Sem 4 Div A: all 10 students in roster!
    // Students 1..8 enrolled & approved
    // Student 9 (Rohan Kulkarni) has a PENDING enrollment request
    // Student 10 (Kavya Chauhan) is on roster waiting to register via invite
    for (const s of studentDefs) {
      const isEnrolled = s.idx <= 8 ? 1 : 0;
      const profileId = s.idx <= 9 ? `stu_${s.idx}` : null;
      tx.prepare(
        `INSERT INTO class_students (id, class_id, enrollment_number, roster_name, student_profile_id, is_enrolled, enrolled_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateId('cs'),
        currClassId,
        s.enr,
        s.name,
        profileId,
        isEnrolled,
        isEnrolled ? recentDate : null,
        recentDate,
        now
      );
    }

    // Pending enrollment request for Student 9
    tx.prepare(
      `INSERT INTO student_enrollment_requests (id, class_id, student_profile_id, enrollment_number, status, created_at, updated_at)
       VALUES (?, ?, 'stu_9', 'GIT23CE009', 'PENDING', ?, ?)`
    ).run('enr_req_demo_1', currClassId, recentDate, now);

    // Marks for CE401 (LOCKED — all 8 enrolled students entered)
    const ce401Scores = [46, 48, 37, 45, 33, 48, 41, 43];
    for (let i = 1; i <= 8; i++) {
      tx.prepare(
        `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
         VALUES (?, 'sub_s4_1', ?, ?, 'usr_prof_1', ?, ?)`
      ).run(generateId('mrk'), `stu_${i}`, ce401Scores[i - 1], recentDate, recentDate);

      tx.prepare(
        `INSERT INTO academic_remarks (id, subject_id, student_id, professor_id, remark_text, is_ai_drafted, created_at, updated_at)
         VALUES (?, 'sub_s4_1', ?, 'prof_1', ?, 0, ?, ?)`
      ).run(
        generateId('rmk'),
        `stu_${i}`,
        ce401Scores[i - 1] >= 44
          ? 'Strong mastery of tree and graph algorithms with clean problem-solving accuracy.'
          : 'Shows steady grasp of core data structures; additional practice on dynamic programming will improve consistency.',
        recentDate,
        recentDate
      );
    }

    // Marks for CE402 (IN_PROGRESS — 5 of 8 enrolled students entered)
    const ce402Scores = [43, 46, 38, 44, 34];
    for (let i = 1; i <= 5; i++) {
      tx.prepare(
        `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
         VALUES (?, 'sub_s4_2', ?, ?, 'usr_prof_2', ?, ?)`
      ).run(generateId('mrk'), `stu_${i}`, ce402Scores[i - 1], recentDate, now);
    }

    // 7. Ready-to-Publish Class: CE Semester 4 — Division B (All Subjects LOCKED, Ready for HOD Verification & Publication!)
    const readyClassId = 'cls_ce_sem4_b';
    tx.prepare(
      `INSERT INTO classes (id, class_code, name, department_id, academic_year, semester, division, batch, is_published, is_archived, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`
    ).run(
      readyClassId,
      'CE-2026-S4-B',
      'CE Semester 4 — Division B (Ready to Publish)',
      deptId,
      '2025-26',
      4,
      'B',
      '2023-2027',
      hodUserId,
      recentDate,
      now
    );

    tx.prepare(
      `INSERT INTO invitations (id, class_id, token, expires_at, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    ).run('inv_ce_sem4_b', readyClassId, 'GIT-CE4B-2026', inviteExpiry, hodUserId, recentDate, now);

    // 2 locked subjects + 1 unassigned subject with pending professor request on a separate class?
    // Keep Div B strictly 100% locked (2 subjects both LOCKED) so HOD can verify & publish immediately!
    const readySubjects = [
      { id: 'sub_s4b_1', code: 'CE401', name: 'Data Structures & Algorithms', maxMarks: 50, profId: 'prof_1', profUser: 'usr_prof_1' },
      { id: 'sub_s4b_2', code: 'CE402', name: 'Database Management Systems', maxMarks: 50, profId: 'prof_2', profUser: 'usr_prof_2' },
    ];

    for (const sub of readySubjects) {
      tx.prepare(
        `INSERT INTO subjects (id, class_id, code, name, max_marks, assessment_type, assigned_professor_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Mid-Semester Examination', ?, ?, ?)`
      ).run(sub.id, readyClassId, sub.code, sub.name, sub.maxMarks, sub.profId, recentDate, now);

      tx.prepare(
        `INSERT INTO subject_submissions (id, subject_id, professor_id, status, locked_at, locked_by, created_at, updated_at)
         VALUES (?, ?, ?, 'LOCKED', ?, ?, ?, ?)`
      ).run(generateId('subm'), sub.id, sub.profId, recentDate, sub.profUser, recentDate, now);
    }

    // Enroll students 1..4 in Div B as a parallel elective/workshop batch so publishing creates real report cards
    const divBScores: Record<number, [number, number]> = {
      1: [47, 44],
      2: [49, 46],
      3: [39, 41],
      4: [45, 47],
    };
    for (let i = 1; i <= 4; i++) {
      const stu = studentDefs[i - 1];
      tx.prepare(
        `INSERT INTO class_students (id, class_id, enrollment_number, roster_name, student_profile_id, is_enrolled, enrolled_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).run(generateId('cs'), readyClassId, stu.enr, stu.name, `stu_${i}`, recentDate, recentDate, now);

      tx.prepare(
        `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
         VALUES (?, 'sub_s4b_1', ?, ?, 'usr_prof_1', ?, ?)`
      ).run(generateId('mrk'), `stu_${i}`, divBScores[i][0], recentDate, recentDate);

      tx.prepare(
        `INSERT INTO marks (id, subject_id, student_id, obtained_marks, updated_by, created_at, updated_at)
         VALUES (?, 'sub_s4b_2', ?, ?, 'usr_prof_2', ?, ?)`
      ).run(generateId('mrk'), `stu_${i}`, divBScores[i][1], recentDate, recentDate);

      tx.prepare(
        `INSERT INTO academic_remarks (id, subject_id, student_id, professor_id, remark_text, is_ai_drafted, created_at, updated_at)
         VALUES (?, 'sub_s4b_1', ?, 'prof_1', 'Consistent performance in algorithm analysis and problem decomposition.', 0, ?, ?)`
      ).run(generateId('rmk'), `stu_${i}`, recentDate, recentDate);
    }

    // Pending Professor Subject Request: Prof. Sneha Desai requesting CE402 in Sem 4 Div A as co-faculty/reassignment review
    // Actually let's add an unassigned elective subject to Sem 4 Div A? No, keep 3 core subjects on Div A as requested
    // and let Prof. Sneha Desai have a pending request for an elective subject CE404 on Sem 4 Div A?
    // Better: make CE403 initially assigned to Prof. Sneha Desai AND add a pending professor request from Prof. Rajesh Mehta for CE403 (or add a 4th pending request on CE403 so HOD sees a live pending subject request right away!).
    tx.prepare(
      `INSERT INTO professor_subject_requests (id, professor_id, class_id, subject_id, status, note, created_at, updated_at)
       VALUES (?, 'prof_2', ?, 'sub_s4_3', 'PENDING', 'Requesting faculty authorization to assist with Operating Systems practical evaluation.', ?, ?)`
    ).run('prof_req_demo_1', currClassId, recentDate, now);

    // 8. Seed Append-Only Audit Logs
    const auditEntries = [
      {
        actor: hodUserId,
        role: 'HOD',
        action: 'RESULT_PUBLISHED',
        entityType: 'ResultPublication',
        entityId: histPubId,
        subjectId: null,
        enr: null,
        prev: null,
        next: 'Version 1 — 8 report cards published',
        details: 'Published official results for CE Semester 3 — Division A.',
        at: pastSemDate,
      },
      {
        actor: 'usr_prof_1',
        role: 'PROFESSOR',
        action: 'MARKS_CREATED',
        entityType: 'Marks',
        entityId: 'sub_s4_1',
        subjectId: 'sub_s4_1',
        enr: 'GIT23CE001',
        prev: null,
        next: '46 / 50',
        details: 'Recorded marks for Aarav Shah in CE401 Data Structures & Algorithms.',
        at: recentDate,
      },
      {
        actor: 'usr_prof_1',
        role: 'PROFESSOR',
        action: 'SUBJECT_LOCKED',
        entityType: 'SubjectSubmission',
        entityId: 'sub_s4_1',
        subjectId: 'sub_s4_1',
        enr: null,
        prev: 'SUBMITTED',
        next: 'LOCKED',
        details: 'Prof. Ananya Sharma verified and locked CE401 (8/8 students graded).',
        at: recentDate,
      },
      {
        actor: 'usr_prof_2',
        role: 'PROFESSOR',
        action: 'MARKS_UPDATED',
        entityType: 'Marks',
        entityId: 'sub_s4_2',
        subjectId: 'sub_s4_2',
        enr: 'GIT23CE002',
        prev: '44 / 50',
        next: '46 / 50',
        details: 'Updated marks after verification of Question 4 evaluation.',
        at: now,
      },
    ];

    for (const a of auditEntries) {
      tx.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, subject_id, student_enrollment, previous_value, new_value, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateId('aud'),
        a.actor,
        a.role,
        a.action,
        a.entityType,
        a.entityId,
        a.subjectId,
        a.enr,
        a.prev,
        a.next,
        a.details,
        a.at
      );
    }

    // 9. Seed Notifications
    const notifEntries = [
      {
        userId: hodUserId,
        type: 'SUBJECT_LOCKED',
        title: 'Subject Locked: CE401',
        message: 'Prof. Ananya Sharma has finalized and locked marks for Data Structures & Algorithms (CE Sem 4 — Div A).',
        link: '/hod/lock-tracker',
      },
      {
        userId: hodUserId,
        type: 'ENROLLMENT_REQUEST',
        title: 'New Student Enrollment Request',
        message: 'Rohan Kulkarni (GIT23CE009) requested enrollment in CE Semester 4 — Division A.',
        link: '/hod/enrollment-requests',
      },
      {
        userId: hodUserId,
        type: 'PUBLISH_READY',
        title: 'Class Ready for Publication',
        message: 'All subjects in CE Semester 4 — Division B are locked and ready for HOD verification.',
        link: '/hod/publish-results',
      },
      {
        userId: 'usr_prof_2',
        type: 'REMINDER',
        title: 'Marks Submission In Progress',
        message: 'CE402 Database Management Systems has 3 remaining student entries before locking.',
        link: '/professor/marks',
      },
      {
        userId: 'usr_prof_3',
        type: 'REMINDER',
        title: 'Pending Marks Entry: CE403',
        message: 'Operating Systems (CE Semester 4 — Div A) is awaiting marks entry and submission.',
        link: '/professor/marks',
      },
      {
        userId: 'usr_stu_1',
        type: 'RESULT_PUBLISHED',
        title: 'Semester 3 Official Report Card Available',
        message: 'Your verified Semester 3 report card for Computer Engineering is available for viewing and PDF download.',
        link: '/student/report-cards',
      },
    ];

    for (const n of notifEntries) {
      tx.prepare(
        `INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
      ).run(generateId('ntf'), n.userId, n.type, n.title, n.message, n.link, recentDate);
    }
  });
}

export type UserRole = 'HOD' | 'PROFESSOR' | 'STUDENT';

export interface HodProfile {
  id: string;
  hodCode: string;
  designation: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  college: string;
}

export interface ProfessorProfile {
  id: string;
  facultyId: string;
  specialization: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  college: string;
}

export interface StudentProfile {
  id: string;
  enrollmentNumber: string;
  currentSemester: number;
  batch: string;
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  college: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  createdAt: string;
  profile: HodProfile | ProfessorProfile | StudentProfile | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: number;
  created_at: string;
}

export interface OfficialReportCardDetail {
  id: string;
  reportCode: string;
  publicationVersion: number;
  publishedAt: string;
  college: string;
  departmentName: string;
  departmentCode: string;
  academicYear: string;
  semester: number;
  division: string;
  batch: string;
  className: string;
  studentName: string;
  enrollmentNumber: string;
  totalMaxMarks: number;
  totalObtained: number;
  percentage: number;
  grade: string;
  resultStatus: string;
  subjects: Array<{
    subjectCode: string;
    subjectName: string;
    assessmentType: string;
    maxMarks: number;
    obtainedMarks: number;
    percentage: number;
    remarkText: string | null;
    isAiDrafted: boolean;
    professorName: string | null;
  }>;
  behavioralEvaluation: {
    attendance: string;
    discipline: string;
    notes: string | null;
    updated_at: string;
  } | null;
}

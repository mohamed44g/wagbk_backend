export type AuthRole = 'teacher' | 'student' | 'super_admin';

export interface AuthUser {
  id: string;
  role: AuthRole;
  name: string;
  email?: string;
  academicYear?: number;
  academicYears?: number[];
  subjectIds?: string[];
}

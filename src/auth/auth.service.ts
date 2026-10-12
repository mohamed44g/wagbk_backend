import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../common/database/database.service';
import { AuthUser } from '../common/auth/auth.types';
import {
  LoginDto,
  RegisterStudentDto,
  RegisterTeacherDto,
} from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerTeacher(dto: RegisterTeacherDto) {
    const existing = await this.db.query(
      'SELECT id FROM teachers WHERE phone = $1 OR ($2::text IS NOT NULL AND email = $2)',
      [dto.phone, dto.email ?? null],
    );
    if (existing.rowCount)
      throw new ConflictException(
        'رقم الموبايل أو البريد الإلكتروني مسجل بالفعل.',
      );
    const subjects = await this.db.query<{ id: string }>(
      `SELECT id FROM subjects WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [dto.subjectIds],
    );
    if (subjects.rowCount !== dto.subjectIds.length) {
      throw new BadRequestException(
        'مادة أو أكثر من المواد المختارة غير صالحة.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const result = await this.db.transaction(async (client) => {
      const teacherResult = await client.query<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        subject: string | null;
      }>(
        `INSERT INTO teachers (name, phone, email, subject, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, phone, email, subject`,
        [
          dto.name,
          dto.phone,
          dto.email ?? null,
          dto.subject ?? null,
          passwordHash,
        ],
      );
      const teacher = teacherResult.rows[0];
      await client.query(
        `INSERT INTO teacher_academic_years (teacher_id, academic_year)
         SELECT $1, UNNEST($2::smallint[])`,
        [teacher.id, dto.academicYears],
      );
      await client.query(
        `INSERT INTO teacher_subjects (teacher_id, subject_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [teacher.id, dto.subjectIds],
      );
      return teacher;
    });
    return this.withToken(
      {
        ...result,
        academicYears: dto.academicYears,
        subjectIds: dto.subjectIds,
      },
      'teacher',
    );
  }

  async registerStudent(dto: RegisterStudentDto) {
    if (dto.phone === dto.parentPhone) {
      throw new BadRequestException(
        'رقم ولي الأمر يجب أن يكون مختلفًا عن رقم الطالب.',
      );
    }
    const existing = await this.db.query(
      'SELECT id FROM students WHERE phone = $1',
      [dto.phone],
    );
    if (existing.rowCount)
      throw new ConflictException('رقم الموبايل مسجل بالفعل.');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const result = await this.db.query<{
      id: string;
      name: string;
      phone: string;
      parentPhone: string;
      academicYear: number;
    }>(
      `INSERT INTO students (name, phone, parent_phone, password_hash, academic_year)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone, parent_phone AS "parentPhone", academic_year AS "academicYear"`,
      [dto.name, dto.phone, dto.parentPhone, passwordHash, dto.academicYear],
    );
    return this.withToken(result.rows[0], 'student');
  }

  async login(dto: LoginDto) {
    const result =
      dto.role === 'teacher'
        ? await this.db.query<{
            id: string;
            name: string;
            phone: string;
            password_hash: string;
            is_active: boolean;
            academicYears: number[];
            subjectIds: string[];
          }>(
            `SELECT t.id, t.name, t.phone, t.password_hash, t.is_active,
                  COALESCE(array_agg(DISTINCT tay.academic_year ORDER BY tay.academic_year)
                    FILTER (WHERE tay.academic_year IS NOT NULL), '{}') AS "academicYears",
                  COALESCE(array_agg(DISTINCT ts.subject_id)
                    FILTER (WHERE ts.subject_id IS NOT NULL), '{}') AS "subjectIds"
           FROM teachers t
           LEFT JOIN teacher_academic_years tay ON tay.teacher_id = t.id
           LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
           WHERE t.phone = $1
           GROUP BY t.id`,
            [dto.phone],
          )
        : dto.role === 'student'
          ? await this.db.query<{
              id: string;
              name: string;
              phone: string;
              parentPhone: string | null;
              password_hash: string;
              is_active: boolean;
              academicYear: number;
            }>(
              `SELECT id, name, phone, parent_phone AS "parentPhone", password_hash, true AS is_active,
                  academic_year AS "academicYear"
           FROM students WHERE phone = $1`,
              [dto.phone],
            )
          : await this.db.query<{
              id: string;
              name: string;
              email: string;
              password_hash: string;
              is_active: boolean;
            }>(
              `SELECT id, name, email, password_hash, true AS is_active
             FROM super_admins WHERE email = $1`,
              [dto.phone],
            );
    const account = result.rows[0];
    if (
      !account ||
      !(await bcrypt.compare(dto.password, account.password_hash)) ||
      account.is_active === false
    ) {
      throw new UnauthorizedException('رقم الموبايل أو كلمة السر غير صحيحة.');
    }
    return this.withToken(account, dto.role);
  }

  async me(user: AuthUser) {
    const table =
      user.role === 'teacher'
        ? 'teachers'
        : user.role === 'student'
          ? 'students'
          : 'super_admins';
    const columns =
      user.role === 'super_admin'
        ? 'id, name, email, created_at'
        : user.role === 'student'
          ? 'id, name, phone, parent_phone AS "parentPhone", created_at'
          : 'id, name, phone, created_at';
    const result = await this.db.query(
      `SELECT ${columns} FROM ${table} WHERE id = $1`,
      [user.id],
    );
    if (!result.rowCount)
      throw new UnauthorizedException('الحساب لم يعد موجودًا.');
    return { ...result.rows[0], role: user.role };
  }

  private withToken(
    account: {
      id: string;
      name: string;
      phone?: string;
      parentPhone?: string | null;
      email?: string | null;
      academicYear?: number;
      academicYears?: number[];
      subjectIds?: string[];
    },
    role: AuthUser['role'],
  ) {
    const payload: AuthUser = {
      id: account.id,
      name: account.name,
      role,
      ...(account.email ? { email: account.email } : {}),
      ...(account.academicYear !== undefined
        ? { academicYear: account.academicYear }
        : {}),
      ...(account.academicYears !== undefined
        ? { academicYears: account.academicYears }
        : {}),
      ...(account.subjectIds !== undefined
        ? { subjectIds: account.subjectIds }
        : {}),
    };
    return {
      accessToken: this.jwt.sign(payload),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '10d'),
      user: {
        ...payload,
        ...(account.phone ? { phone: account.phone } : {}),
        ...(account.parentPhone ? { parentPhone: account.parentPhone } : {}),
        ...(account.email ? { email: account.email } : {}),
      },
    };
  }
}

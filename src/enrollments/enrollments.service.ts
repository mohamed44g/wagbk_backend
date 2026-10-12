import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly db: DatabaseService) {}

  async create(studentId: string, dto: CreateEnrollmentDto) {
    return this.db.transaction(async (client) => {
      const codeResult = await client.query<{
        id: string;
        teacher_id: string;
        group_id: string;
        group_academic_year: number;
        student_academic_year: number;
        is_active: boolean;
        max_uses: number | null;
        used_count: number;
        expires_at: Date | null;
      }>(
        `SELECT ac.id, ac.teacher_id, ac.group_id, ac.is_active, ac.max_uses,
                ac.used_count, ac.expires_at, g.academic_year AS group_academic_year,
                s.academic_year AS student_academic_year
         FROM access_codes ac
         JOIN groups g ON g.id = ac.group_id AND g.teacher_id = ac.teacher_id
         JOIN students s ON s.id = $2
         WHERE ac.code = $1
         FOR UPDATE OF ac`,
        [dto.accessCode.toUpperCase(), studentId],
      );
      const code = codeResult.rows[0];
      if (!code) {
        throw new NotFoundException('Access code is invalid or expired');
      }
      if (!code.is_active || code.used_count >= 1) {
        throw new ConflictException('Access code has already been used');
      }
      if (code.expires_at && code.expires_at < new Date()) {
        throw new ConflictException('Access code is expired');
      }
      if (code.group_academic_year !== code.student_academic_year) {
        throw new ConflictException(
          'This group belongs to a different academic year',
        );
      }
      const existing = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND teacher_id = $2',
        [studentId, code.teacher_id],
      );
      if (existing.rowCount)
        throw new ConflictException(
          'Student is already enrolled with this teacher',
        );
      const result = await client.query(
        `INSERT INTO enrollments (student_id, teacher_id, group_id, access_code_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, student_id, teacher_id, group_id, joined_at`,
        [studentId, code.teacher_id, code.group_id, code.id],
      );
      await client.query(
        `UPDATE access_codes
         SET used_count = used_count + 1, is_active = false
         WHERE id = $1 AND used_count = 0 AND is_active = true`,
        [code.id],
      );
      return result.rows[0];
    });
  }

  async findAllForStudent(studentId: string) {
    const result = await this.db.query(
      `SELECT e.id, e.teacher_id, t.name AS teacher_name, e.group_id, g.name AS group_name,
              g.subject_id, s.name_ar AS subject_name_ar, s.name_en AS subject_name_en,
              g.academic_year, g.schedule_slots,
              c.id AS center_id, c.name AS center_name, e.joined_at
       FROM enrollments e
       JOIN teachers t ON t.id = e.teacher_id
       JOIN groups g ON g.id = e.group_id
       JOIN subjects s ON s.id = g.subject_id
       JOIN centers c ON c.id = g.center_id
       WHERE e.student_id = $1 ORDER BY e.joined_at DESC`,
      [studentId],
    );
    return result.rows;
  }
}

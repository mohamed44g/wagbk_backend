import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../common/database/database.service';
import { CreateAccessCodeDto, CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly db: DatabaseService) {}

  async create(teacherId: string, centerId: string, dto: CreateGroupDto) {
    const center = await this.db.query(
      'SELECT id FROM centers WHERE id = $1 AND teacher_id = $2',
      [centerId, teacherId],
    );
    if (!center.rowCount) throw new NotFoundException('Center not found');
    const teacherYear = await this.db.query(
      `SELECT 1 FROM teacher_academic_years
       WHERE teacher_id = $1 AND academic_year = $2`,
      [teacherId, dto.academicYear],
    );
    if (!teacherYear.rowCount) {
      throw new BadRequestException(
        'Teacher is not registered to teach this academic year',
      );
    }
    const teacherSubject = await this.db.query(
      `SELECT 1 FROM teacher_subjects
       WHERE teacher_id = $1 AND subject_id = $2`,
      [teacherId, dto.subjectId],
    );
    if (!teacherSubject.rowCount) {
      throw new BadRequestException(
        'Teacher is not registered to teach this subject',
      );
    }
    const subject = await this.db.query<{ name_en: string }>(
      'SELECT name_en FROM subjects WHERE id = $1 AND is_active = true',
      [dto.subjectId],
    );
    if (!subject.rowCount) throw new BadRequestException('Subject not found');
    const days = dto.scheduleSlots.map((slot) => slot.day);
    if (new Set(days).size !== days.length) {
      throw new BadRequestException('Each schedule day must be unique');
    }
    const result = await this.db.query(
      `INSERT INTO groups
        (center_id, teacher_id, name, subject, subject_id, academic_year,
         schedule_day, schedule_days, schedule_time, schedule_slots)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, center_id, teacher_id, name, subject_id, academic_year,
                 schedule_slots, created_at`,
      [
        centerId,
        teacherId,
        dto.name,
        subject.rows[0].name_en,
        dto.subjectId,
        dto.academicYear,
        days[0],
        days,
        dto.scheduleSlots[0].time,
        JSON.stringify(dto.scheduleSlots),
      ],
    );
    return result.rows[0];
  }

  async findAll(teacherId: string, centerId: string) {
    const center = await this.db.query(
      'SELECT id FROM centers WHERE id = $1 AND teacher_id = $2',
      [centerId, teacherId],
    );
    if (!center.rowCount) throw new NotFoundException('Center not found');
    const result = await this.db.query(
      `SELECT g.id, g.center_id, g.name, g.subject_id,
              s.name_ar AS subject_name_ar, s.name_en AS subject_name_en,
              g.academic_year,
              g.schedule_slots, g.created_at,
              COUNT(e.id)::int AS students_count
       FROM groups g
       JOIN subjects s ON s.id = g.subject_id
       LEFT JOIN enrollments e ON e.group_id = g.id
       WHERE g.center_id = $1 AND g.teacher_id = $2
       GROUP BY g.id, s.name_ar, s.name_en ORDER BY g.created_at DESC`,
      [centerId, teacherId],
    );
    return result.rows;
  }

  async findOverview(teacherId: string, groupId: string) {
    const result = await this.db.query(
      `SELECT g.id, g.center_id, g.name, g.subject_id,
              s.name_ar AS subject_name_ar, s.name_en AS subject_name_en,
              g.academic_year, g.schedule_slots, g.created_at,
              c.name AS center_name,
              (SELECT COUNT(*)::int FROM enrollments e WHERE e.group_id = g.id) AS students_count,
              (SELECT COUNT(*)::int FROM homeworks h WHERE h.group_id = g.id) AS homeworks_count,
              (SELECT COUNT(*)::int FROM submissions sub WHERE sub.group_id = g.id AND sub.status = 'submitted') AS submissions_count
       FROM groups g
       JOIN subjects s ON s.id = g.subject_id
       JOIN centers c ON c.id = g.center_id
       WHERE g.id = $1 AND g.teacher_id = $2`,
      [groupId, teacherId],
    );
    if (!result.rowCount) throw new NotFoundException('Group not found');
    return result.rows[0];
  }

  async findStudents(teacherId: string, groupId: string) {
    const result = await this.db.query(
      `SELECT st.id AS student_id, st.name AS student_name,
              st.phone AS student_phone, st.parent_phone AS student_parent_phone,
              COUNT(DISTINCT sub.id)::int AS submissions_count,
              COALESCE(SUM(sub.total_score), 0)::numeric(7,2) AS total_score,
              COALESCE(SUM(sub.max_score), 0)::numeric(7,2) AS total_max_score,
              CASE
                WHEN COALESCE(SUM(sub.max_score), 0) > 0
                THEN ROUND((COALESCE(SUM(sub.total_score), 0) / SUM(sub.max_score)) * 100)
                ELSE 0
              END::int AS score_percentage,
              (
                SELECT sub_latest.status
                FROM submissions sub_latest
                WHERE sub_latest.student_id = st.id AND sub_latest.group_id = e.group_id
                ORDER BY sub_latest.submitted_at DESC LIMIT 1
              ) AS latest_status,
              (
                SELECT sub_latest.total_score
                FROM submissions sub_latest
                WHERE sub_latest.student_id = st.id AND sub_latest.group_id = e.group_id
                ORDER BY sub_latest.submitted_at DESC LIMIT 1
              ) AS latest_score,
              (
                SELECT sub_latest.max_score
                FROM submissions sub_latest
                WHERE sub_latest.student_id = st.id AND sub_latest.group_id = e.group_id
                ORDER BY sub_latest.submitted_at DESC LIMIT 1
              ) AS latest_max_score,
              (
                SELECT h.title
                FROM submissions sub_latest
                JOIN homeworks h ON h.id = sub_latest.homework_id
                WHERE sub_latest.student_id = st.id AND sub_latest.group_id = e.group_id
                ORDER BY sub_latest.submitted_at DESC LIMIT 1
              ) AS latest_homework_title,
              (
                SELECT sub_latest.submitted_at
                FROM submissions sub_latest
                WHERE sub_latest.student_id = st.id AND sub_latest.group_id = e.group_id
                ORDER BY sub_latest.submitted_at DESC LIMIT 1
              ) AS latest_submitted_at
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       LEFT JOIN submissions sub ON sub.student_id = st.id AND sub.group_id = e.group_id AND sub.status IN ('submitted', 'graded')
       WHERE e.group_id = $1 AND e.teacher_id = $2
       GROUP BY st.id, st.name, st.phone, st.parent_phone, e.group_id
       ORDER BY st.name`,
      [groupId, teacherId],
    );
    return result.rows;
  }

  async createAccessCode(
    teacherId: string,
    groupId: string,
    dto: CreateAccessCodeDto,
  ) {
    const group = await this.db.query(
      'SELECT id FROM groups WHERE id = $1 AND teacher_id = $2',
      [groupId, teacherId],
    );
    if (!group.rowCount) throw new NotFoundException('Group not found');
    const code = randomBytes(5).toString('hex').toUpperCase();
    const result = await this.db.query(
      `INSERT INTO access_codes (teacher_id, group_id, code, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, group_id, code, is_active, max_uses, used_count, expires_at, created_at`,
      [teacherId, groupId, code, 1, dto.expiresAt ?? null],
    );
    return result.rows[0];
  }

  async listAccessCodes(teacherId: string, groupId: string) {
    const result = await this.db.query(
      `SELECT id, group_id, code, is_active, max_uses, used_count, expires_at, created_at
       FROM access_codes WHERE teacher_id = $1 AND group_id = $2 ORDER BY created_at DESC`,
      [teacherId, groupId],
    );
    return result.rows;
  }
}

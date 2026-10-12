import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { CreateLessonDto } from './dto/create-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly db: DatabaseService) {}

  async create(teacherId: string, dto: CreateLessonDto) {
    const result = await this.db.query(
      `INSERT INTO lessons (teacher_id, name, order_index) VALUES ($1, $2, $3)
       RETURNING id, teacher_id, name, order_index, created_at`,
      [teacherId, dto.name, dto.orderIndex ?? 0],
    );
    return result.rows[0];
  }

  async findAll(teacherId: string) {
    const result = await this.db.query(
      `SELECT l.id, l.name, l.order_index, l.created_at, COUNT(h.id)::int AS homeworks_count
       FROM lessons l LEFT JOIN homeworks h ON h.lesson_id = l.id
       WHERE l.teacher_id = $1 GROUP BY l.id ORDER BY l.order_index, l.created_at`,
      [teacherId],
    );
    return result.rows;
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import {
  ApiQuestionType,
  CreateHomeworkDto,
  CreateQuestionDto,
  UpdateHomeworkDto,
} from './dto/create-homework.dto';

@Injectable()
export class HomeworksService {
  constructor(private readonly db: DatabaseService) {}

  async create(teacherId: string, dto: CreateHomeworkDto) {
    this.validateQuestions(dto.questions);
    const homeworkId = await this.db.transaction(async (client) => {
      const homeworkResult = await client.query(
        `INSERT INTO homeworks (teacher_id, lesson_id, group_id, title, description, due_date, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, teacher_id, lesson_id, group_id, title, description, due_date, duration_minutes, is_published, created_at`,
        [
          teacherId,
          dto.lessonId,
          dto.groupId,
          dto.title,
          dto.description ?? null,
          dto.dueDate ?? null,
          dto.durationMinutes ?? null,
        ],
      );
      const homework = homeworkResult.rows[0];
      for (const [index, question] of dto.questions.entries()) {
        const questionResult = await client.query(
          `INSERT INTO questions (homework_id, type, text, image_url, points, order_index, correct_boolean)
           VALUES ($1, $2::question_type, $3, $4, $5, $6, $7)
           RETURNING id, type, text, image_url, points, order_index, correct_boolean`,
          [
            homework.id,
            question.type,
            question.text,
            question.imageUrl ?? null,
            question.points,
            index,
            question.correctBoolean ?? null,
          ],
        );
        const inserted = questionResult.rows[0];
        for (const [choiceIndex, choice] of (
          question.choices ?? []
        ).entries()) {
          await client.query(
            `INSERT INTO question_choices (question_id, text, is_correct, order_index) VALUES ($1, $2, $3, $4)`,
            [
              inserted.id,
              choice.text,
              choice.isCorrect,
              choice.orderIndex ?? choiceIndex,
            ],
          );
        }
      }
      return homework.id as string;
    });
    return this.findOneForTeacher(teacherId, homeworkId);
  }

  async update(teacherId: string, homeworkId: string, dto: UpdateHomeworkDto) {
    const result = await this.db.query(
      `UPDATE homeworks SET is_published = $3 WHERE id = $1 AND teacher_id = $2
       RETURNING id, title, is_published`,
      [homeworkId, teacherId, dto.isPublished],
    );
    if (!result.rowCount) throw new NotFoundException('Homework not found');
    return result.rows[0];
  }

  async findAllForTeacher(teacherId: string) {
    const result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.lesson_id, l.name AS lesson_name,
              h.group_id, g.name AS group_name, h.due_date, h.duration_minutes, h.is_published, h.created_at,
              (h.due_date IS NOT NULL AND h.due_date <= now()) AS is_expired,
              COUNT(q.id)::int AS questions_count
       FROM homeworks h JOIN lessons l ON l.id = h.lesson_id JOIN groups g ON g.id = h.group_id
       LEFT JOIN questions q ON q.homework_id = h.id
       WHERE h.teacher_id = $1 GROUP BY h.id, l.name, g.name ORDER BY h.created_at DESC`,
      [teacherId],
    );
    return result.rows;
  }

  async findAllForStudent(studentId: string) {
    const result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.lesson_id, l.name AS lesson_name,
              h.group_id, g.name AS group_name, g.subject_id, subj.name_ar AS subject_name_ar, subj.name_en AS subject_name_en,
              h.due_date, h.duration_minutes, h.created_at,
              s.id AS submission_id, s.status AS submission_status, s.total_score, s.max_score,
              EXISTS (SELECT 1 FROM questions hq WHERE hq.homework_id = h.id AND hq.type = 'essay') AS has_essay,
              (h.due_date IS NOT NULL AND h.due_date <= now()) AS is_expired
       FROM homeworks h JOIN lessons l ON l.id = h.lesson_id JOIN groups g ON g.id = h.group_id
       LEFT JOIN subjects subj ON subj.id = g.subject_id
       JOIN enrollments e ON e.group_id = h.group_id AND e.teacher_id = h.teacher_id AND e.student_id = $1
       LEFT JOIN submissions s ON s.homework_id = h.id AND s.student_id = $1
       WHERE h.is_published = true ORDER BY l.order_index, h.created_at DESC`,
      [studentId],
    );
    return result.rows;
  }

  async findOneForAdmin(homeworkId: string) {
    let result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.lesson_id, l.name AS lesson_name,
              h.group_id, g.name AS group_name, h.due_date, h.duration_minutes, h.is_published, h.created_at
       FROM homeworks h JOIN lessons l ON l.id = h.lesson_id JOIN groups g ON g.id = h.group_id
       WHERE h.id = $1`,
      [homeworkId],
    );

    if (!result.rowCount) {
      result = await this.db.query(
        `SELECT h.id, h.title, h.description, h.lesson_id, l.name AS lesson_name,
                h.group_id, g.name AS group_name, h.due_date, h.duration_minutes, h.is_published, h.created_at
         FROM homeworks h JOIN lessons l ON l.id = h.lesson_id JOIN groups g ON g.id = h.group_id
         WHERE h.admin_homework_id = $1
         ORDER BY h.created_at DESC LIMIT 1`,
        [homeworkId],
      );
    }

    if (!result.rowCount) {
      const templateResult = await this.db.query(
        `SELECT ah.id, ah.title, ah.description, al.name AS lesson_name
         FROM admin_homeworks ah
         JOIN admin_lessons al ON al.id = ah.lesson_id
         WHERE ah.id = $1`,
        [homeworkId],
      );
      if (!templateResult.rowCount) throw new NotFoundException('Homework not found');

      const templateQuestions = await this.db.query(
        `SELECT q.id, q.type, q.text, q.image_url, q.points, q.order_index, q.correct_boolean,
                COALESCE(json_agg(json_build_object('id', c.id, 'text', c.text, 'orderIndex', c.order_index)
                ORDER BY c.order_index) FILTER (WHERE c.id IS NOT NULL), '[]') AS choices
         FROM admin_questions q LEFT JOIN admin_question_choices c ON c.question_id = q.id
         WHERE q.homework_id = $1 GROUP BY q.id ORDER BY q.order_index`,
        [homeworkId],
      );

      return {
        ...templateResult.rows[0],
        group_id: null,
        group_name: null,
        questions: templateQuestions.rows,
      };
    }

    const actualHomeworkId = result.rows[0].id;
    const questions = await this.db.query(
      `SELECT q.id, q.type, q.text, q.image_url, q.points, q.order_index, q.correct_boolean,
              COALESCE(json_agg(json_build_object('id', c.id, 'text', c.text, 'orderIndex', c.order_index)
              ORDER BY c.order_index) FILTER (WHERE c.id IS NOT NULL), '[]') AS choices
       FROM questions q LEFT JOIN question_choices c ON c.question_id = q.id
       WHERE q.homework_id = $1 GROUP BY q.id ORDER BY q.order_index`,
      [actualHomeworkId],
    );

    return { ...result.rows[0], questions: questions.rows };
  }

  async findOneForTeacher(teacherId: string, homeworkId: string) {
    const result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.lesson_id, l.name AS lesson_name,
              h.group_id, g.name AS group_name, h.due_date, h.duration_minutes, h.is_published, h.created_at
       FROM homeworks h JOIN lessons l ON l.id = h.lesson_id JOIN groups g ON g.id = h.group_id
       WHERE h.id = $1 AND h.teacher_id = $2`,
      [homeworkId, teacherId],
    );
    if (!result.rowCount) throw new NotFoundException('Homework not found');
    const questions = await this.db.query(
      `SELECT q.id, q.type, q.text, q.image_url, q.points, q.order_index, q.correct_boolean,
              COALESCE(json_agg(json_build_object('id', c.id, 'text', c.text, 'orderIndex', c.order_index)
              ORDER BY c.order_index) FILTER (WHERE c.id IS NOT NULL), '[]') AS choices
       FROM questions q LEFT JOIN question_choices c ON c.question_id = q.id
       WHERE q.homework_id = $1 GROUP BY q.id ORDER BY q.order_index`,
      [homeworkId],
    );
    return { ...result.rows[0], questions: questions.rows };
  }

  async findOneForStudent(studentId: string, homeworkId: string) {
    const result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.lesson_id, l.name AS lesson_name,
              h.group_id, g.name AS group_name, h.due_date, h.duration_minutes, h.created_at,
              (h.due_date IS NOT NULL AND h.due_date <= now()) AS is_expired
       FROM homeworks h JOIN lessons l ON l.id = h.lesson_id JOIN groups g ON g.id = h.group_id
       JOIN enrollments e ON e.group_id = h.group_id AND e.teacher_id = h.teacher_id AND e.student_id = $1
       WHERE h.id = $2 AND h.is_published = true`,
      [studentId, homeworkId],
    );
    if (!result.rowCount) throw new NotFoundException('Homework not found');
    const questions = await this.db.query(
      `SELECT q.id, q.type, q.text, q.image_url, q.points, q.order_index,
              COALESCE(json_agg(json_build_object('id', c.id, 'text', c.text, 'orderIndex', c.order_index)
              ORDER BY c.order_index) FILTER (WHERE c.id IS NOT NULL), '[]') AS choices
       FROM questions q LEFT JOIN question_choices c ON c.question_id = q.id
       WHERE q.homework_id = $1 GROUP BY q.id ORDER BY q.order_index`,
      [homeworkId],
    );
    return { ...result.rows[0], questions: questions.rows };
  }

  private validateQuestions(questions: CreateQuestionDto[]) {
    if (!questions.length)
      throw new BadRequestException(
        'Homework must contain at least one question',
      );
    for (const question of questions) {
      if (question.type === ApiQuestionType.MCQ) {
        if (
          !question.choices?.length ||
          question.choices.filter((choice) => choice.isCorrect).length !== 1
        ) {
          throw new BadRequestException(
            'MCQ questions must have exactly one correct choice',
          );
        }
      } else if (question.type === ApiQuestionType.TRUE_FALSE) {
        if (
          question.correctBoolean === undefined ||
          (question.choices?.length ?? 0) > 0
        ) {
          throw new BadRequestException(
            'True/False questions require correctBoolean and no choices',
          );
        }
      } else if (question.choices?.length) {
        throw new BadRequestException('Essay questions cannot have choices');
      }
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../common/database/database.service';
import {
  ApiQuestionType,
  CreateQuestionDto,
} from '../homeworks/dto/create-homework.dto';
import {
  AssignAdminHomeworkDto,
  CreateAdminHomeworkDto,
  ImportAdminHomeworkDto,
} from './dto/admin-content.dto';

@Injectable()
export class AdminContentService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboardStats() {
    const [
      summary,
      monthlyHomeworks,
      groupsByYear,
      submissionsByStatus,
      subjectHomeworks,
    ] = await Promise.all([
      this.db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM teachers WHERE is_active = true) AS teachers,
           (SELECT COUNT(*)::int FROM students) AS students,
           (SELECT COUNT(*)::int FROM centers) AS centers,
           (SELECT COUNT(*)::int FROM groups) AS groups,
           (SELECT COUNT(*)::int FROM admin_homeworks WHERE is_active = true) AS templates,
           (SELECT COUNT(*)::int FROM homeworks WHERE admin_homework_id IS NOT NULL) AS assigned_homeworks,
           (SELECT COUNT(*)::int FROM submissions WHERE status <> 'in_progress') AS submissions,
           (SELECT COUNT(*)::int
            FROM answers a
            JOIN questions q ON q.id = a.question_id
            WHERE q.type = 'essay' AND a.essay_text IS NOT NULL AND a.score IS NULL) AS pending_essay_answers`,
      ),
      this.db.query(
        `SELECT TO_CHAR(month_start, 'Mon') AS label, COUNT(h.id)::int AS count
         FROM generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month'
         ) AS month_start
         LEFT JOIN homeworks h
           ON h.created_at >= month_start
          AND h.created_at < month_start + INTERVAL '1 month'
         GROUP BY month_start
         ORDER BY month_start`,
      ),
      this.db.query(
        `SELECT academic_year AS year, COUNT(*)::int AS count
         FROM groups
         GROUP BY academic_year
         ORDER BY academic_year`,
      ),
      this.db.query(
        `SELECT status, COUNT(*)::int AS count
         FROM submissions
         GROUP BY status
         ORDER BY CASE status
           WHEN 'submitted' THEN 1
           WHEN 'graded' THEN 2
           WHEN 'in_progress' THEN 3
           ELSE 4 END`,
      ),
      this.db.query(
        `SELECT s.name_ar AS label, COUNT(h.id)::int AS count
         FROM homeworks h
         JOIN groups g ON g.id = h.group_id
         JOIN subjects s ON s.id = g.subject_id
         GROUP BY s.id, s.name_ar
         ORDER BY count DESC, s.name_ar`,
      ),
    ]);

    return {
      summary: summary.rows[0],
      monthlyHomeworks: monthlyHomeworks.rows,
      groupsByYear: groupsByYear.rows,
      submissionsByStatus: submissionsByStatus.rows,
      subjectHomeworks: subjectHomeworks.rows,
    };
  }

  async listGroups() {
    const result = await this.db.query(
      `SELECT g.id, g.name, g.teacher_id, t.name AS teacher_name,
              c.id AS center_id, c.name AS center_name,
              g.subject_id, s.name_ar AS subject_name_ar, s.name_en AS subject_name_en,
              g.academic_year, g.schedule_slots,
              COUNT(e.id)::int AS students_count
       FROM groups g
       JOIN teachers t ON t.id = g.teacher_id
       JOIN centers c ON c.id = g.center_id
       JOIN subjects s ON s.id = g.subject_id
       LEFT JOIN enrollments e ON e.group_id = g.id
       GROUP BY g.id, g.name, g.teacher_id, t.name, c.id, c.name,
                g.subject_id, s.name_ar, s.name_en, g.academic_year, g.schedule_slots
       ORDER BY t.name, c.name, g.name`,
    );
    return result.rows;
  }

  async listTeachers() {
    const result = await this.db.query(
      `SELECT t.id, t.name, t.phone, t.email, t.is_active, t.created_at,
              COUNT(DISTINCT c.id)::int AS centers_count,
              COUNT(DISTINCT g.id)::int AS groups_count,
              COUNT(DISTINCT e.student_id)::int AS students_count,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', s.id, 'name_ar', s.name_ar, 'name_en', s.name_en))
                FILTER (WHERE s.id IS NOT NULL), '[]'
              ) AS subjects,
              COALESCE(
                json_agg(DISTINCT tay.academic_year)
                FILTER (WHERE tay.academic_year IS NOT NULL), '[]'
              ) AS academic_years
       FROM teachers t
       LEFT JOIN centers c ON c.teacher_id = t.id
       LEFT JOIN groups g ON g.teacher_id = t.id
       LEFT JOIN enrollments e ON e.teacher_id = t.id
       LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
       LEFT JOIN subjects s ON s.id = ts.subject_id
       LEFT JOIN teacher_academic_years tay ON tay.teacher_id = t.id
       GROUP BY t.id, t.name, t.phone, t.email, t.is_active, t.created_at
       ORDER BY t.created_at DESC`,
    );
    return result.rows;
  }

  async getTeacherDetails(teacherId: string) {
    const teacherRes = await this.db.query(
      `SELECT t.id, t.name, t.phone, t.email, t.is_active, t.created_at,
              COALESCE(
                json_agg(DISTINCT jsonb_build_object('id', s.id, 'name_ar', s.name_ar, 'name_en', s.name_en))
                FILTER (WHERE s.id IS NOT NULL), '[]'
              ) AS subjects,
              COALESCE(
                json_agg(DISTINCT tay.academic_year)
                FILTER (WHERE tay.academic_year IS NOT NULL), '[]'
              ) AS academic_years
       FROM teachers t
       LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
       LEFT JOIN subjects s ON s.id = ts.subject_id
       LEFT JOIN teacher_academic_years tay ON tay.teacher_id = t.id
       WHERE t.id = $1
       GROUP BY t.id, t.name, t.phone, t.email, t.is_active, t.created_at`,
      [teacherId],
    );

    if (!teacherRes.rowCount) throw new NotFoundException('Teacher not found');

    const centersRes = await this.db.query(
      `SELECT c.id AS center_id, c.name AS center_name, c.address AS center_address,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', g.id,
                    'name', g.name,
                    'academic_year', g.academic_year,
                    'subject_name_ar', s.name_ar,
                    'schedule_slots', g.schedule_slots,
                    'students_count', (SELECT COUNT(*)::int FROM enrollments e WHERE e.group_id = g.id)
                  ) ORDER BY g.name
                ) FILTER (WHERE g.id IS NOT NULL), '[]'
              ) AS groups
       FROM centers c
       LEFT JOIN groups g ON g.center_id = c.id
       LEFT JOIN subjects s ON s.id = g.subject_id
       WHERE c.teacher_id = $1
       GROUP BY c.id, c.name, c.address
       ORDER BY c.name`,
      [teacherId],
    );

    return {
      teacher: teacherRes.rows[0],
      centers: centersRes.rows,
    };
  }

  async getGroupStudents(groupId: string) {
    if (!groupId || groupId === 'undefined') {
      throw new BadRequestException('Group ID is required');
    }
    const groupRes = await this.db.query(
      `SELECT g.id, g.name, g.teacher_id, t.name AS teacher_name,
              c.id AS center_id, c.name AS center_name,
              s.name_ar AS subject_name_ar, g.academic_year
       FROM groups g
       JOIN teachers t ON t.id = g.teacher_id
       JOIN centers c ON c.id = g.center_id
       JOIN subjects s ON s.id = g.subject_id
       WHERE g.id = $1`,
      [groupId],
    );
    if (!groupRes.rowCount) throw new NotFoundException('Group not found');

    const studentsRes = await this.db.query(
      `SELECT st.id, st.name, st.phone, st.parent_phone, st.academic_year, e.joined_at,
              COUNT(DISTINCT sub.id)::int AS submissions_count,
              COALESCE(SUM(sub.total_score), 0)::numeric(7,2) AS total_score,
              COALESCE(SUM(sub.max_score), 0)::numeric(7,2) AS total_max_score,
              CASE
                WHEN COALESCE(SUM(sub.max_score), 0) > 0
                THEN ROUND((COALESCE(SUM(sub.total_score), 0) / SUM(sub.max_score)) * 100)
                ELSE 0
              END::int AS score_percentage
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       LEFT JOIN submissions sub ON sub.student_id = st.id AND sub.group_id = e.group_id AND sub.status IN ('submitted', 'graded')
       WHERE e.group_id = $1
       GROUP BY st.id, st.name, st.phone, st.parent_phone, st.academic_year, e.joined_at
       ORDER BY st.name`,
      [groupId],
    );

    return {
      group: groupRes.rows[0],
      students: studentsRes.rows,
    };
  }

  async listHomeworks() {
    const result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.is_active, h.created_at,
              l.id AS lesson_id, l.name AS lesson_name,
              COUNT(q.id)::int AS questions_count
       FROM admin_homeworks h
       JOIN admin_lessons l ON l.id = h.lesson_id
       LEFT JOIN admin_questions q ON q.homework_id = h.id
       GROUP BY h.id, l.id, l.name
       ORDER BY h.created_at DESC`,
    );
    return result.rows;
  }

  async findOneHomework(homeworkId: string) {
    const result = await this.db.query(
      `SELECT h.id, h.title, h.description, h.is_active, h.created_at,
              l.id AS lesson_id, l.name AS lesson_name
       FROM admin_homeworks h
       JOIN admin_lessons l ON l.id = h.lesson_id
       WHERE h.id = $1`,
      [homeworkId],
    );
    if (!result.rowCount)
      throw new NotFoundException('Admin homework not found');
    const questions = await this.db.query(
      `SELECT q.id, q.type, q.text, q.image_url, q.points, q.order_index, q.correct_boolean,
              COALESCE(json_agg(json_build_object(
                'id', c.id, 'text', c.text, 'isCorrect', c.is_correct,
                'orderIndex', c.order_index
              ) ORDER BY c.order_index) FILTER (WHERE c.id IS NOT NULL), '[]') AS choices
       FROM admin_questions q
       LEFT JOIN admin_question_choices c ON c.question_id = q.id
       WHERE q.homework_id = $1
       GROUP BY q.id
       ORDER BY q.order_index`,
      [homeworkId],
    );
    return { ...result.rows[0], questions: questions.rows };
  }

  async createHomework(adminId: string, dto: CreateAdminHomeworkDto) {
    this.validateQuestions(dto.questions);
    const homeworkId = await this.db.transaction(async (client) => {
      const lessonResult = await client.query<{ id: string }>(
        `INSERT INTO admin_lessons (admin_id, name, order_index)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [adminId, dto.lessonName.trim(), dto.orderIndex ?? 0],
      );
      const lesson =
        lessonResult.rows[0] ??
        (
          await client.query<{ id: string }>(
            `SELECT id FROM admin_lessons WHERE admin_id = $1 AND name = $2 LIMIT 1`,
            [adminId, dto.lessonName.trim()],
          )
        ).rows[0];
      if (!lesson)
        throw new BadRequestException('Could not create admin lesson');

      const homeworkResult = await client.query<{ id: string }>(
        `INSERT INTO admin_homeworks (admin_id, lesson_id, title, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [adminId, lesson.id, dto.title.trim(), dto.description?.trim() || null],
      );
      const homeworkId = homeworkResult.rows[0].id;
      for (const [index, question] of dto.questions.entries()) {
        const questionResult = await client.query<{ id: string }>(
          `INSERT INTO admin_questions
             (homework_id, type, text, image_url, points, order_index, correct_boolean)
           VALUES ($1, $2::question_type, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            homeworkId,
            question.type,
            question.text.trim(),
            question.imageUrl ?? null,
            question.points,
            index,
            question.correctBoolean ?? null,
          ],
        );
        for (const [choiceIndex, choice] of (
          question.choices ?? []
        ).entries()) {
          await client.query(
            `INSERT INTO admin_question_choices (question_id, text, is_correct, order_index)
             VALUES ($1, $2, $3, $4)`,
            [
              questionResult.rows[0].id,
              choice.text.trim(),
              choice.isCorrect,
              choice.orderIndex ?? choiceIndex,
            ],
          );
        }
      }
      return homeworkId;
    });
    return this.findOneHomework(homeworkId);
  }

  async importHomework(
    adminId: string,
    dto: ImportAdminHomeworkDto,
    file: { buffer: Buffer; originalname: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Excel file is required');
    }

    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('Workbook has no sheets');
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: true,
      });
    } catch {
      throw new BadRequestException('Could not read the Excel file');
    }

    const questions = rows
      .map((row, index) => this.parseExcelQuestion(row, index + 2))
      .filter(
        (question): question is NonNullable<typeof question> =>
          question !== null,
      );
    if (!questions.length) {
      throw new BadRequestException(
        'Excel file must contain at least one question row',
      );
    }

    return {
      lessonName: dto.lessonName,
      title: dto.title,
      description: dto.description ?? null,
      questions,
      importedQuestions: questions.length,
      saved: false,
    };
  }

  async updateHomework(homeworkId: string, dto: CreateAdminHomeworkDto) {
    this.validateQuestions(dto.questions);

    return this.db.transaction(async (client) => {
      const lessonResult = await client.query<{ id: string }>(
        `SELECT id FROM admin_lessons WHERE name = $1 LIMIT 1`,
        [dto.lessonName],
      );
      const lessonId =
        lessonResult.rows[0]?.id ??
        (
          await client.query<{ id: string }>(
            `INSERT INTO admin_lessons (name) VALUES ($1) RETURNING id`,
            [dto.lessonName],
          )
        ).rows[0].id;

      const updated = await client.query(
        `UPDATE admin_homeworks
         SET title = $1, description = $2, lesson_id = $3
         WHERE id = $4
         RETURNING id`,
        [dto.title, dto.description ?? null, lessonId, homeworkId],
      );

      if (!updated.rowCount) throw new NotFoundException('Homework template not found');

      await client.query(
        `DELETE FROM admin_questions WHERE homework_id = $1`,
        [homeworkId],
      );

      let orderIndex = 0;
      for (const q of dto.questions) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO admin_questions (homework_id, type, text, image_url, points, order_index, correct_boolean)
           VALUES ($1, $2::question_type, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            homeworkId,
            q.type,
            q.text,
            q.imageUrl ?? null,
            q.points,
            orderIndex++,
            q.type === 'true_false' ? (q.correctBoolean ?? true) : null,
          ],
        );

        if (q.type === 'mcq' && q.choices) {
          let choiceIndex = 0;
          for (const choice of q.choices) {
            await client.query(
              `INSERT INTO admin_question_choices (question_id, text, is_correct, order_index)
               VALUES ($1, $2, $3, $4)`,
              [inserted.rows[0].id, choice.text, choice.isCorrect, choiceIndex++],
            );
          }
        }
      }

      return { id: homeworkId, title: dto.title, updated: true };
    });
  }

  async assignHomework(
    adminId: string,
    templateId: string,
    dto: AssignAdminHomeworkDto,
  ) {
    const homeworkId = await this.db.transaction(async (client) => {
      const templateResult = await client.query<{
        title: string;
        description: string | null;
        lesson_name: string;
      }>(
        `SELECT h.title, h.description, l.name AS lesson_name
         FROM admin_homeworks h
         JOIN admin_lessons l ON l.id = h.lesson_id
         WHERE h.id = $1 AND h.is_active = true`,
        [templateId],
      );
      if (!templateResult.rowCount) {
        throw new NotFoundException('Admin homework not found or inactive');
      }

      const groupResult = await client.query<{ teacher_id: string }>(
        `SELECT teacher_id FROM groups WHERE id = $1`,
        [dto.groupId],
      );
      if (!groupResult.rowCount) throw new NotFoundException('Group not found');

      const duplicate = await client.query(
        `SELECT id FROM homeworks WHERE admin_homework_id = $1 AND group_id = $2 LIMIT 1`,
        [templateId, dto.groupId],
      );
      if (duplicate.rowCount) {
        throw new ConflictException(
          'This homework is already assigned to this group',
        );
      }

      const teacherId = groupResult.rows[0].teacher_id;
      const lessonResult = await client.query<{ id: string }>(
        `SELECT id FROM lessons WHERE teacher_id = $1 AND name = $2 LIMIT 1`,
        [teacherId, templateResult.rows[0].lesson_name],
      );
      const lessonId =
        lessonResult.rows[0]?.id ??
        (
          await client.query<{ id: string }>(
            `INSERT INTO lessons (teacher_id, name, order_index)
           VALUES ($1, $2, 0) RETURNING id`,
            [teacherId, templateResult.rows[0].lesson_name],
          )
        ).rows[0].id;

      const homeworkResult = await client.query<{ id: string }>(
        `INSERT INTO homeworks
           (teacher_id, lesson_id, group_id, title, description, due_date,
            duration_minutes, is_published, admin_homework_id, assigned_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          teacherId,
          lessonId,
          dto.groupId,
          templateResult.rows[0].title,
          templateResult.rows[0].description,
          dto.dueDate ?? null,
          dto.durationMinutes ?? null,
          dto.isPublished !== false,
          templateId,
          adminId,
        ],
      );
      const homeworkId = homeworkResult.rows[0].id;
      const questions = await client.query<{
        id: string;
        type: string;
        text: string;
        image_url: string | null;
        points: string;
        order_index: number;
        correct_boolean: boolean | null;
      }>(
        `SELECT id, type, text, image_url, points, order_index, correct_boolean
         FROM admin_questions WHERE homework_id = $1 ORDER BY order_index`,
        [templateId],
      );
      for (const question of questions.rows) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO questions
             (homework_id, type, text, image_url, points, order_index, correct_boolean)
           VALUES ($1, $2::question_type, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            homeworkId,
            question.type,
            question.text,
            question.image_url,
            question.points,
            question.order_index,
            question.correct_boolean,
          ],
        );
        const choices = await client.query<{
          text: string;
          is_correct: boolean;
          order_index: number;
        }>(
          `SELECT text, is_correct, order_index
           FROM admin_question_choices WHERE question_id = $1 ORDER BY order_index`,
          [question.id],
        );
        for (const choice of choices.rows) {
          await client.query(
            `INSERT INTO question_choices (question_id, text, is_correct, order_index)
             VALUES ($1, $2, $3, $4)`,
            [
              inserted.rows[0].id,
              choice.text,
              choice.is_correct,
              choice.order_index,
            ],
          );
        }
      }
      return homeworkId;
    });
    return {
      id: homeworkId,
      groupId: dto.groupId,
      isPublished: dto.isPublished !== false,
    };
  }

  private validateQuestions(questions: CreateQuestionDto[]) {
    if (!questions.length) {
      throw new BadRequestException(
        'Homework must contain at least one question',
      );
    }
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

  private parseExcelQuestion(
    row: Record<string, unknown>,
    rowNumber: number,
  ): CreateQuestionDto | null {
    const cells = new Map(
      Object.entries(row).map(([key, value]) => [
        this.normalizeExcelHeader(key),
        value,
      ]),
    );
    const read = (...keys: string[]) => {
      for (const key of keys) {
        const value = cells.get(this.normalizeExcelHeader(key));
        if (value !== undefined && String(value).trim() !== '') return value;
      }
      return '';
    };
    const text = String(read('question', 'text', 'نص السؤال', 'السؤال')).trim();
    if (!text) return null;

    const typeValue = this.normalizeExcelHeader(
      read('type', 'question_type', 'نوع السؤال'),
    );
    const type =
      typeValue === 'mcq' ||
      typeValue === 'multiple_choice' ||
      typeValue === 'اختيار_من_متعدد' ||
      typeValue === 'اختيارى' ||
      typeValue === 'اختياري'
        ? ApiQuestionType.MCQ
        : typeValue === 'true_false' ||
            typeValue === 'truefalse' ||
            typeValue === 'صح_أو_خطأ' ||
            typeValue === 'صح_وخطأ' ||
            typeValue === 'صح/خطأ'
          ? ApiQuestionType.TRUE_FALSE
          : typeValue === 'essay' ||
              typeValue === 'مقالي' ||
              typeValue === 'مقالى'
            ? ApiQuestionType.ESSAY
            : null;
    if (!type)
      throw new BadRequestException(
        `Invalid question type in Excel row ${rowNumber}`,
      );

    const pointsValue = read('points', 'score', 'الدرجة');
    const points = pointsValue === '' ? 1 : Number(pointsValue);
    if (!Number.isFinite(points) || points < 0) {
      throw new BadRequestException(
        `Invalid points value in Excel row ${rowNumber}`,
      );
    }

    if (type === ApiQuestionType.MCQ) {
      const choices = [1, 2, 3, 4]
        .map((number) =>
          String(
            read(
              `choice_${number}`,
              `choice${number}`,
              `option_${number}`,
              `اختيار ${number}`,
            ),
          ).trim(),
        )
        .filter(Boolean);
      if (choices.length < 2) {
        throw new BadRequestException(
          `MCQ row ${rowNumber} must have at least two choices`,
        );
      }
      const answer = String(
        read('correct_answer', 'correct', 'answer', 'الإجابة الصحيحة'),
      ).trim();
      const answerIndex = this.resolveChoiceIndex(answer, choices);
      if (answerIndex < 0) {
        throw new BadRequestException(
          `Correct answer in Excel row ${rowNumber} must be a choice number or exact choice text`,
        );
      }
      return {
        type,
        text,
        points,
        choices: choices.map((choice, index) => ({
          text: choice,
          isCorrect: index === answerIndex,
          orderIndex: index,
        })),
      };
    }

    if (type === ApiQuestionType.TRUE_FALSE) {
      const answer = this.normalizeExcelHeader(
        read('correct_answer', 'correct', 'answer', 'الإجابة الصحيحة'),
      );
      if (['true', '1', 'yes', 'صح', 'صحيح'].includes(answer)) {
        return { type, text, points, correctBoolean: true };
      }
      if (['false', '0', 'no', 'خطأ', 'غلط'].includes(answer)) {
        return { type, text, points, correctBoolean: false };
      }
      throw new BadRequestException(
        `True/False answer in Excel row ${rowNumber} must be true/false or صح/خطأ`,
      );
    }

    return {
      type,
      text,
      points,
      imageUrl:
        String(read('image_url', 'image', 'الصورة')).trim() || undefined,
    };
  }

  private resolveChoiceIndex(answer: string, choices: string[]) {
    const normalized = this.normalizeExcelHeader(answer);
    const number = Number(normalized);
    if (Number.isInteger(number) && number >= 1 && number <= choices.length)
      return number - 1;
    const choiceIndex = choices.findIndex(
      (choice) => this.normalizeExcelHeader(choice) === normalized,
    );
    return choiceIndex;
  }

  private normalizeExcelHeader(value: unknown) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  async generateAccessCodes(groupId: string, count: number = 1) {
    const group = await this.db.query(
      'SELECT id, teacher_id FROM groups WHERE id = $1',
      [groupId],
    );
    if (!group.rowCount) throw new NotFoundException('المجموعة غير موجودة');
    const teacherId = group.rows[0].teacher_id;

    const validCount = Math.min(Math.max(1, Number(count) || 1), 500);

    const insertedRows: any[] = [];
    let attempts = 0;

    while (insertedRows.length < validCount && attempts < 10) {
      attempts++;
      const needed = validCount - insertedRows.length;
      const valueClauses: string[] = [];
      const params: unknown[] = [teacherId, groupId, 1];
      let paramIdx = 4;

      for (let i = 0; i < needed; i++) {
        const code = randomBytes(4).toString('hex').toUpperCase();
        valueClauses.push(`($1, $2, $${paramIdx}, $3)`);
        params.push(code);
        paramIdx++;
      }

      const query = `
        INSERT INTO access_codes (teacher_id, group_id, code, max_uses)
        VALUES ${valueClauses.join(', ')}
        ON CONFLICT (code) DO NOTHING
        RETURNING id, group_id, code, is_active, max_uses, used_count, created_at
      `;

      const result = await this.db.query(query, params);
      if (result.rowCount) {
        insertedRows.push(...result.rows);
      }
    }

    return insertedRows;
  }

  async listGroupAccessCodes(groupId: string) {
    const result = await this.db.query(
      `SELECT ac.id, ac.group_id, ac.code, ac.is_active, ac.max_uses, ac.used_count, ac.created_at,
              st.name AS used_by_student_name,
              st.phone AS used_by_student_phone,
              e.joined_at AS used_at
       FROM access_codes ac
       LEFT JOIN enrollments e ON e.access_code_id = ac.id
       LEFT JOIN students st ON st.id = e.student_id
       WHERE ac.group_id = $1
       ORDER BY ac.created_at DESC, ac.id DESC`,
      [groupId],
    );
    return result.rows;
  }
}

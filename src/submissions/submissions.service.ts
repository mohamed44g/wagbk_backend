import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import {
  AnswerInputDto,
  GradeSubmissionDto,
  SubmitSubmissionDto,
} from './dto/submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(private readonly db: DatabaseService) {}

  async create(studentId: string, homeworkId: string) {
    await this.db.query(
      `UPDATE submissions
       SET started_at = COALESCE(started_at, now())
       WHERE homework_id = $1 AND student_id = $2 AND status = 'in_progress'`,
      [homeworkId, studentId],
    );
    const existing = await this.db.query(
      `SELECT s.id, s.homework_id, s.student_id, s.status, s.auto_score,
              s.manual_score, s.total_score, s.max_score, s.submitted_at, s.started_at
       FROM submissions s
       JOIN homeworks h ON h.id = s.homework_id
       WHERE s.homework_id = $1 AND s.student_id = $2 AND h.is_published = true`,
      [homeworkId, studentId],
    );
    if (existing.rowCount) return existing.rows[0];

    const result = await this.db.query(
      `INSERT INTO submissions (homework_id, student_id, teacher_id, group_id, max_score, started_at)
       SELECT h.id, e.student_id, h.teacher_id, h.group_id, COALESCE(SUM(q.points), 0), now()
       FROM homeworks h
       JOIN enrollments e ON e.group_id = h.group_id AND e.teacher_id = h.teacher_id
       LEFT JOIN questions q ON q.homework_id = h.id
       WHERE h.id = $1 AND e.student_id = $2 AND h.is_published = true
         AND (h.due_date IS NULL OR h.due_date > now())
       GROUP BY h.id, e.student_id
       ON CONFLICT (homework_id, student_id) DO UPDATE SET homework_id = EXCLUDED.homework_id
       RETURNING id, homework_id, student_id, status, auto_score, manual_score, total_score, max_score, submitted_at, started_at`,
      [homeworkId, studentId],
    );
    if (!result.rowCount) {
      throw new ConflictException('انتهى موعد تسليم الواجب');
    }
    return result.rows[0];
  }

  async findAllForStudent(studentId: string) {
    const result = await this.db.query(
      `SELECT s.id, s.homework_id, h.title, l.name AS lesson_name, s.status,
              s.auto_score, s.manual_score, s.total_score, s.max_score, s.submitted_at, s.graded_at,
              EXISTS (SELECT 1 FROM questions essay_question
                      WHERE essay_question.homework_id = h.id AND essay_question.type = 'essay') AS has_essay
       FROM submissions s JOIN homeworks h ON h.id = s.homework_id
       JOIN lessons l ON l.id = h.lesson_id
       WHERE s.student_id = $1 ORDER BY s.submitted_at DESC NULLS LAST`,
      [studentId],
    );
    return result.rows;
  }

  async findOneForStudent(studentId: string, submissionId: string) {
    const result = await this.db.query(
      `SELECT s.id, s.homework_id, h.title, s.status, s.auto_score, s.manual_score,
              s.total_score, s.max_score, s.submitted_at, s.graded_at
       FROM submissions s JOIN homeworks h ON h.id = s.homework_id
       WHERE s.id = $1 AND s.student_id = $2`,
      [submissionId, studentId],
    );
    if (!result.rowCount) throw new NotFoundException('Submission not found');
    const answers = await this.db.query(
      `SELECT a.id, a.question_id, q.text, q.type, a.selected_choice_id,
              a.selected_boolean, a.essay_text, a.essay_image_url, a.is_correct, a.score, a.teacher_feedback
       FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.submission_id = $1 ORDER BY q.order_index`,
      [submissionId],
    );
    return { ...result.rows[0], answers: answers.rows };
  }

  async submit(
    studentId: string,
    submissionId: string,
    dto: SubmitSubmissionDto,
  ) {
    return this.db.transaction(async (client) => {
      const submissionResult = await client.query<{
        id: string;
        homework_id: string;
        status: string;
        is_due_expired: boolean;
        is_duration_expired: boolean;
      }>(
        `SELECT s.id, s.homework_id, s.status,
                (h.due_date IS NOT NULL AND h.due_date <= now()) AS is_due_expired,
                (h.duration_minutes IS NOT NULL AND s.started_at IS NOT NULL
                 AND s.started_at + (h.duration_minutes * INTERVAL '1 minute') <= now()) AS is_duration_expired
         FROM submissions s
         JOIN homeworks h ON h.id = s.homework_id
         WHERE s.id = $1 AND s.student_id = $2 FOR UPDATE`,
        [submissionId, studentId],
      );
      const submission = submissionResult.rows[0];
      if (!submission) throw new NotFoundException('Submission not found');
      if (submission.status !== 'in_progress')
        throw new ConflictException('Submission has already been submitted');
      if (submission.is_due_expired)
        throw new ConflictException('انتهى موعد تسليم الواجب');
      if (submission.is_duration_expired && !dto.autoSubmit)
        throw new ConflictException('انتهى وقت حل الواجب');

      for (const answer of dto.answers)
        await this.upsertAnswer(
          client,
          submissionId,
          submission.homework_id,
          answer,
        );
      const scoreResult = await client.query<{ auto_score: string }>(
        `SELECT COALESCE(SUM(a.score) FILTER (WHERE q.type <> 'essay'), 0)::numeric AS auto_score
         FROM answers a JOIN questions q ON q.id = a.question_id WHERE a.submission_id = $1`,
        [submissionId],
      );
      const updated = await client.query(
         `UPDATE submissions SET status = 'submitted', auto_score = $2, submitted_at = now()
         WHERE id = $1
         RETURNING id, homework_id, status, auto_score, manual_score, total_score, max_score, submitted_at, started_at`,
        [submissionId, scoreResult.rows[0].auto_score],
      );
      return updated.rows[0];
    });
  }

  async findAllForTeacher(userId: string, homeworkId: string, isSuperAdmin: boolean = false) {
    const query = isSuperAdmin
      ? `SELECT s.id, s.homework_id, s.student_id, st.name AS student_name, st.phone AS student_phone,
                s.status, s.auto_score, s.manual_score, s.total_score, s.max_score, s.submitted_at, s.graded_at
         FROM submissions s JOIN students st ON st.id = s.student_id
         WHERE s.homework_id = $1 ORDER BY st.name`
      : `SELECT s.id, s.homework_id, s.student_id, st.name AS student_name, st.phone AS student_phone,
                s.status, s.auto_score, s.manual_score, s.total_score, s.max_score, s.submitted_at, s.graded_at
         FROM submissions s JOIN students st ON st.id = s.student_id
         WHERE s.homework_id = $1 AND s.teacher_id = $2 ORDER BY st.name`;
    const params = isSuperAdmin ? [homeworkId] : [homeworkId, userId];
    const result = await this.db.query(query, params);
    return result.rows;
  }

  async findOneForTeacher(userId: string, submissionId: string, isSuperAdmin: boolean = false) {
    const query = isSuperAdmin
      ? `SELECT s.id, s.homework_id, s.student_id, st.name AS student_name,
                h.title AS homework_title, s.status, s.auto_score, s.manual_score,
                s.total_score, s.max_score, s.submitted_at, s.graded_at
         FROM submissions s
         JOIN students st ON st.id = s.student_id
         JOIN homeworks h ON h.id = s.homework_id
         WHERE s.id = $1`
      : `SELECT s.id, s.homework_id, s.student_id, st.name AS student_name,
                h.title AS homework_title, s.status, s.auto_score, s.manual_score,
                s.total_score, s.max_score, s.submitted_at, s.graded_at
         FROM submissions s
         JOIN students st ON st.id = s.student_id
         JOIN homeworks h ON h.id = s.homework_id
         WHERE s.id = $1 AND s.teacher_id = $2`;
    const params = isSuperAdmin ? [submissionId] : [submissionId, userId];
    const result = await this.db.query(query, params);
    if (!result.rowCount) throw new NotFoundException('Submission not found');

    const answers = await this.db.query(
      `SELECT a.id, a.question_id, q.text AS question_text, q.type, q.points,
              a.selected_choice_id, selected_choice.text AS selected_choice_text,
              correct_choice.text AS correct_choice_text, a.selected_boolean,
              q.correct_boolean, a.essay_text, a.essay_image_url, a.is_correct, a.score, a.teacher_feedback
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN question_choices selected_choice ON selected_choice.id = a.selected_choice_id
       LEFT JOIN question_choices correct_choice
         ON correct_choice.question_id = q.id AND correct_choice.is_correct = true
       WHERE a.submission_id = $1
       ORDER BY q.order_index`,
      [submissionId],
    );
    return { ...result.rows[0], answers: answers.rows };
  }

  async grade(
    userId: string,
    submissionId: string,
    dto: GradeSubmissionDto,
    isSuperAdmin: boolean = false,
  ) {
    return this.db.transaction(async (client) => {
      const selectQuery = isSuperAdmin
        ? `SELECT id, status FROM submissions WHERE id = $1 FOR UPDATE`
        : `SELECT id, status FROM submissions WHERE id = $1 AND teacher_id = $2 FOR UPDATE`;
      const params = isSuperAdmin ? [submissionId] : [submissionId, userId];
      const submissionResult = await client.query<{
        id: string;
        status: string;
      }>(selectQuery, params);
      if (!submissionResult.rowCount)
        throw new NotFoundException('Submission not found');
      for (const answer of dto.answers) {
        const question = await client.query<{ points: string; type: string }>(
          `SELECT q.points, q.type FROM answers a JOIN questions q ON q.id = a.question_id
           WHERE a.submission_id = $1 AND a.question_id = $2`,
          [submissionId, answer.questionId],
        );
        const questionRow = question.rows[0];
        if (!questionRow)
          throw new NotFoundException(
            `Question ${answer.questionId} is not in this submission`,
          );

        if (answer.score !== undefined && answer.score !== null) {
          if (answer.score > Number(questionRow.points))
            throw new BadRequestException('Score cannot exceed question points');
          await client.query(
            `UPDATE answers SET score = $3::numeric, is_correct = ($3::numeric > 0), teacher_feedback = COALESCE($4, teacher_feedback)
             WHERE submission_id = $1 AND question_id = $2`,
            [
              submissionId,
              answer.questionId,
              answer.score,
              answer.teacherFeedback ?? null,
            ],
          );
        } else if (answer.teacherFeedback !== undefined) {
          await client.query(
            `UPDATE answers SET teacher_feedback = $3
             WHERE submission_id = $1 AND question_id = $2`,
            [submissionId, answer.questionId, answer.teacherFeedback ?? null],
          );
        }
      }
      const result = await client.query(
        `UPDATE submissions s SET status = 'graded',
          manual_score = COALESCE((SELECT SUM(a.score) FROM answers a JOIN questions q ON q.id = a.question_id
                                   WHERE a.submission_id = s.id AND q.type = 'essay'), 0),
          graded_at = now()
         WHERE s.id = $1 RETURNING id, status, auto_score, manual_score, total_score, max_score, graded_at`,
        [submissionId],
      );
      return result.rows[0];
    });
  }

  async findMistakes(studentId: string) {
    const result = await this.db.query(
      `SELECT a.id AS answer_id, q.id AS question_id, q.text AS question_text, q.type,
              q.points, q.correct_boolean, a.essay_text, a.essay_image_url, a.selected_boolean, a.selected_choice_id,
              selected_choice.text AS selected_choice_text, correct_choice.text AS correct_choice_text,
              a.score, a.teacher_feedback, h.id AS homework_id, h.title AS homework_title,
              l.id AS lesson_id, l.name AS lesson_name
       FROM answers a JOIN submissions s ON s.id = a.submission_id
       JOIN questions q ON q.id = a.question_id JOIN homeworks h ON h.id = s.homework_id
       JOIN lessons l ON l.id = h.lesson_id
       LEFT JOIN question_choices selected_choice ON selected_choice.id = a.selected_choice_id
       LEFT JOIN question_choices correct_choice ON correct_choice.question_id = q.id AND correct_choice.is_correct = true
       WHERE s.student_id = $1 AND s.status IN ('submitted', 'graded') AND a.is_correct = false
       ORDER BY l.order_index, h.created_at DESC, q.order_index`,
      [studentId],
    );
    return result.rows;
  }

  private async upsertAnswer(
    client: { query: (text: string, values?: unknown[]) => Promise<any> },
    submissionId: string,
    homeworkId: string,
    answer: AnswerInputDto,
  ) {
    const questionResult = await client.query(
      `SELECT id, type, points FROM questions WHERE id = $1 AND homework_id = $2`,
      [answer.questionId, homeworkId],
    );
    const question = questionResult.rows[0];
    if (!question)
      throw new BadRequestException(
        `Question ${answer.questionId} is invalid for this homework`,
      );

    let isCorrect: boolean | null = null;
    let score: number | null = null;
    let selectedChoiceId: string | null = answer.selectedChoiceId ?? null;
    let selectedBoolean: boolean | null = answer.selectedBoolean ?? null;
    let essayText: string | null = answer.essayText ?? null;
    let essayImageUrl: string | null = answer.essayImageUrl ?? null;

    if (question.type === 'mcq') {
      if (!selectedChoiceId)
        throw new BadRequestException('MCQ answer requires selectedChoiceId');
      const choice = await client.query(
        `SELECT is_correct FROM question_choices WHERE id = $1 AND question_id = $2`,
        [selectedChoiceId, answer.questionId],
      );
      if (!choice.rowCount)
        throw new BadRequestException('Selected choice is invalid');
      isCorrect = choice.rows[0].is_correct;
      score = isCorrect ? Number(question.points) : 0;
      selectedBoolean = null;
      essayText = null;
      essayImageUrl = null;
    } else if (question.type === 'true_false') {
      if (selectedBoolean === undefined || selectedBoolean === null)
        throw new BadRequestException(
          'True/False answer requires selectedBoolean',
        );
      const correct = await client.query(
        'SELECT correct_boolean FROM questions WHERE id = $1',
        [answer.questionId],
      );
      isCorrect = selectedBoolean === correct.rows[0].correct_boolean;
      score = isCorrect ? Number(question.points) : 0;
      selectedChoiceId = null;
      essayText = null;
      essayImageUrl = null;
    } else {
      if (!essayText?.trim() && !essayImageUrl)
        throw new BadRequestException('Essay answer requires text or an image');
      if (essayImageUrl && !essayImageUrl.startsWith('data:image/'))
        throw new BadRequestException('Essay answer image must be an image data URL');
      selectedChoiceId = null;
      selectedBoolean = null;
    }

    await client.query(
      `INSERT INTO answers (submission_id, question_id, selected_choice_id, selected_boolean, essay_text, essay_image_url, is_correct, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (submission_id, question_id) DO UPDATE SET selected_choice_id = EXCLUDED.selected_choice_id,
         selected_boolean = EXCLUDED.selected_boolean, essay_text = EXCLUDED.essay_text,
         essay_image_url = EXCLUDED.essay_image_url, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score`,
      [
        submissionId,
        answer.questionId,
        selectedChoiceId,
        selectedBoolean,
        essayText,
        essayImageUrl,
        isCorrect,
        score,
      ],
    );
  }
}

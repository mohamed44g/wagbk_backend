import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

type WeeklyEvaluationRow = {
  label: string;
  week_start: string;
  rating: number | string;
  completion_rate: number | string;
  average_score: number | string;
  available_count?: number | string;
  submitted_count: number | string;
  graded_count: number | string;
  assigned_count?: number | string;
  expected_count?: number | string;
  grading_rate?: number | string;
};

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeRow(row: WeeklyEvaluationRow) {
  return {
    label: row.label,
    weekStart: row.week_start,
    rating: numberValue(row.rating),
    completionRate: numberValue(row.completion_rate),
    averageScore: numberValue(row.average_score),
    ...(row.available_count !== undefined
      ? { availableCount: numberValue(row.available_count) }
      : {}),
    ...(row.assigned_count !== undefined
      ? { assignedCount: numberValue(row.assigned_count) }
      : {}),
    ...(row.expected_count !== undefined
      ? { expectedCount: numberValue(row.expected_count) }
      : {}),
    submittedCount: numberValue(row.submitted_count),
    gradedCount: numberValue(row.graded_count),
    ...(row.grading_rate !== undefined
      ? { gradingRate: numberValue(row.grading_rate) }
      : {}),
  };
}

function buildSummary(rows: ReturnType<typeof normalizeRow>[]) {
  const current = rows.at(-1) ?? {
    label: '',
    weekStart: '',
    rating: 0,
    completionRate: 0,
    averageScore: 0,
    submittedCount: 0,
    gradedCount: 0,
  };
  const previous = rows.at(-2);
  const averageRating = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.rating, 0) / rows.length)
    : 0;

  return {
    currentRating: current.rating,
    averageRating,
    ratingChange: current.rating - (previous?.rating ?? 0),
    currentWeekLabel: current.label,
    completionRate: current.completionRate,
    averageScore: current.averageScore,
    submittedCount: current.submittedCount,
    gradedCount: current.gradedCount,
  };
}

@Injectable()
export class WeeklyEvaluationsService {
  constructor(private readonly db: DatabaseService) {}

  async getStudentEvaluation(studentId: string) {
    const result = await this.db.query<WeeklyEvaluationRow>(
      `WITH relevant_homeworks AS (
         SELECT h.id, h.created_at
         FROM enrollments e
         JOIN homeworks h
           ON h.group_id = e.group_id
          AND h.teacher_id = e.teacher_id
          AND h.is_published = true
         WHERE e.student_id = $1
       ), weeks AS (
         SELECT date_trunc('week', created_at)::date AS week_start
         FROM relevant_homeworks
         UNION
         SELECT date_trunc('week', CURRENT_DATE)::date
       ), metrics AS (
         SELECT
           weeks.week_start,
           COUNT(DISTINCT h.id)::int AS available_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.submitted_at IS NOT NULL)::int AS submitted_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'graded')::int AS graded_count,
           COALESCE(AVG(
             CASE WHEN s.submitted_at IS NOT NULL AND s.max_score > 0
               THEN (100.0 * s.total_score / s.max_score)
             END
           ), 0)::numeric(7,2) AS average_score
         FROM weeks
         LEFT JOIN relevant_homeworks h
           ON date_trunc('week', h.created_at)::date = weeks.week_start
         LEFT JOIN submissions s
           ON s.homework_id = h.id
          AND s.student_id = $1
         GROUP BY weeks.week_start
       )
       SELECT
         TO_CHAR(week_start, 'DD/MM') AS label,
         week_start,
         ROUND(
           CASE WHEN available_count > 0
             THEN (0.4 * (100.0 * submitted_count / available_count))
                + (0.6 * average_score)
             ELSE 0
           END
         )::int AS rating,
         ROUND(CASE WHEN available_count > 0
           THEN (100.0 * submitted_count / available_count) ELSE 0 END, 2) AS completion_rate,
         average_score,
         available_count,
         submitted_count,
         graded_count
       FROM metrics
       ORDER BY week_start`,
      [studentId],
    );

    const weeklyTrend = result.rows.map(normalizeRow);
    return {
      audience: 'student' as const,
      summary: {
        ...buildSummary(weeklyTrend),
        availableCount: weeklyTrend.at(-1)?.availableCount ?? 0,
      },
      weeklyTrend,
    };
  }

  async getTeacherEvaluation(teacherId: string) {
    const result = await this.db.query<WeeklyEvaluationRow>(
      `WITH relevant_homeworks AS (
         SELECT h.id, h.group_id, h.teacher_id, h.created_at
         FROM homeworks h
         WHERE h.teacher_id = $1
           AND h.is_published = true
       ), weeks AS (
         SELECT date_trunc('week', created_at)::date AS week_start
         FROM relevant_homeworks
         UNION
         SELECT date_trunc('week', CURRENT_DATE)::date
       ), metrics AS (
         SELECT
           weeks.week_start,
           COUNT(DISTINCT h.id)::int AS assigned_count,
           COUNT(DISTINCT (h.id, e.student_id)) FILTER (WHERE e.student_id IS NOT NULL)::int AS expected_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.submitted_at IS NOT NULL)::int AS submitted_count,
           COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'graded')::int AS graded_count,
           COALESCE(AVG(
             CASE WHEN s.submitted_at IS NOT NULL AND s.max_score > 0
               THEN (100.0 * s.total_score / s.max_score)
             END
           ), 0)::numeric(7,2) AS average_score
         FROM weeks
         LEFT JOIN relevant_homeworks h
           ON date_trunc('week', h.created_at)::date = weeks.week_start
         LEFT JOIN enrollments e
           ON e.group_id = h.group_id
          AND e.teacher_id = h.teacher_id
         LEFT JOIN submissions s
           ON s.homework_id = h.id
          AND s.teacher_id = $1
          AND s.student_id = e.student_id
         GROUP BY weeks.week_start
       )
       SELECT
         TO_CHAR(week_start, 'DD/MM') AS label,
         week_start,
         ROUND(
           CASE WHEN expected_count > 0
             THEN (0.3 * (100.0 * submitted_count / expected_count))
                + (0.3 * (CASE WHEN submitted_count > 0
                    THEN (100.0 * graded_count / submitted_count) ELSE 0 END))
                + (0.4 * average_score)
             ELSE 0
           END
         )::int AS rating,
         ROUND(CASE WHEN expected_count > 0
           THEN (100.0 * submitted_count / expected_count) ELSE 0 END, 2) AS completion_rate,
         average_score,
         assigned_count,
         expected_count,
         submitted_count,
         graded_count,
         ROUND(CASE WHEN submitted_count > 0
           THEN (100.0 * graded_count / submitted_count) ELSE 0 END, 2) AS grading_rate
       FROM metrics
       ORDER BY week_start`,
      [teacherId],
    );

    const weeklyTrend = result.rows.map(normalizeRow);
    const current = weeklyTrend.at(-1);
    return {
      audience: 'teacher' as const,
      summary: {
        ...buildSummary(weeklyTrend),
        assignedCount: current?.assignedCount ?? 0,
        expectedCount: current?.expectedCount ?? 0,
        gradingRate: current?.gradingRate ?? 0,
      },
      weeklyTrend,
    };
  }
}

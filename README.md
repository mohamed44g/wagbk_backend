# Center Homework Management API

NestJS REST API using PostgreSQL through `pg`, Redis, handwritten SQL migrations, and Swagger.

## Local setup

1. Copy `.env.example` to `.env` and set `HOMEWORK_DB_PASSWORD` and a strong `JWT_SECRET`.
2. The local database is `homework_management`.
3. Run Redis with `docker compose up -d redis`.
4. Run migrations with `npm run db:migrate`.
5. Start the API with `npm run start:dev`.

Create the first administrator after migrations with:

`npm run db:create-admin -- admin@example.com StrongPassword "Admin name"`

The API uses the `/api/v1` prefix. Swagger is available at `/docs` and the OpenAPI JSON at `/docs-json`.

## REST resources

- `POST /api/v1/teachers` and `POST /api/v1/students` create accounts.
- `POST /api/v1/sessions` creates a JWT session.
- `GET|POST /api/v1/centers` manages teacher centers.
- `GET|POST /api/v1/centers/:centerId/groups` manages groups.
- `GET|POST /api/v1/groups/:groupId/access-codes` manages access codes.
- `GET|POST /api/v1/enrollments` manages student enrollment.
- `GET /api/v1/lessons` lists lessons already assigned to the teacher.
- `GET /api/v1/homeworks` lists homework resources for teachers and students.
- `GET /api/v1/admin/groups` lists groups available to the administrator.
- `GET|POST /api/v1/admin/content/homeworks` manages reusable admin homework templates.
- `POST /api/v1/admin/content/homeworks/:homeworkId/assign` assigns and publishes a template to a group.
- `GET|POST|PATCH /api/v1/submissions` manages submission resources.
- `GET /api/v1/mistakes` exposes the student's My Mistakes resource.

All implemented routes include Swagger metadata and require a Bearer token where applicable.

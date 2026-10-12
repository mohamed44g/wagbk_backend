import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { CentersModule } from './centers/centers.module';
import { GroupsModule } from './groups/groups.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { LessonsModule } from './lessons/lessons.module';
import { HomeworksModule } from './homeworks/homeworks.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SubjectsModule } from './subjects/subjects.module';
import { AdminContentModule } from './admin-content/admin-content.module';
import { WeeklyEvaluationsModule } from './weekly-evaluations/weekly-evaluations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    CentersModule,
    GroupsModule,
    EnrollmentsModule,
    LessonsModule,
    HomeworksModule,
    SubmissionsModule,
    SubjectsModule,
    AdminContentModule,
    WeeklyEvaluationsModule,
  ],
})
export class AppModule {}

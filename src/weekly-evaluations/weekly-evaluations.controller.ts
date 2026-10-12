import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/auth/auth.types';
import { WeeklyEvaluationsService } from './weekly-evaluations.service';

@ApiTags('Weekly Evaluations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RoleGuard)
export class WeeklyEvaluationsController {
  constructor(private readonly weeklyEvaluations: WeeklyEvaluationsService) {}

  @Get('teachers/:teacherId/weekly-evaluations')
  @Roles('teacher')
  @ApiOperation({ summary: 'Get the teacher weekly evaluation dashboard' })
  getTeacherEvaluation(
    @CurrentUser() user: AuthUser,
    @Param('teacherId') teacherId: string,
  ) {
    if (user.id !== teacherId) {
      throw new ForbiddenException('You can only view your own evaluation');
    }
    return this.weeklyEvaluations.getTeacherEvaluation(teacherId);
  }

  @Get('students/:studentId/weekly-evaluations')
  @Roles('student')
  @ApiOperation({ summary: 'Get the student weekly evaluation dashboard' })
  getStudentEvaluation(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    if (user.id !== studentId) {
      throw new ForbiddenException('You can only view your own evaluation');
    }
    return this.weeklyEvaluations.getStudentEvaluation(studentId);
  }
}

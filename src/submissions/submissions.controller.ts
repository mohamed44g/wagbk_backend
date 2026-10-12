import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { GradeSubmissionDto, SubmitSubmissionDto } from './dto/submission.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Submissions')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RoleGuard)
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post('homeworks/:homeworkId/submissions')
  @Roles('student')
  @ApiOperation({
    summary: 'Create or resume a submission for a published homework',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('homeworkId') homeworkId: string,
  ) {
    return this.submissions.create(user.id, homeworkId);
  }

  @Get('submissions')
  @Roles('student')
  @ApiOperation({ summary: 'List the student submissions' })
  findAllForStudent(@CurrentUser() user: AuthUser) {
    return this.submissions.findAllForStudent(user.id);
  }

  @Get('submissions/:submissionId')
  @Roles('student')
  @ApiOperation({ summary: 'Get one student submission with answers' })
  findOneForStudent(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissions.findOneForStudent(user.id, submissionId);
  }

  @Patch('submissions/:submissionId')
  @Roles('student')
  @ApiOperation({ summary: 'Submit answers for a student submission' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
    @Body() dto: SubmitSubmissionDto,
  ) {
    return this.submissions.submit(user.id, submissionId, dto);
  }

  @Get('homeworks/:homeworkId/submissions')
  @Roles('teacher', 'super_admin')
  @ApiOperation({ summary: 'List submissions for a homework' })
  findAllForTeacher(
    @CurrentUser() user: AuthUser,
    @Param('homeworkId') homeworkId: string,
  ) {
    return this.submissions.findAllForTeacher(
      user.id,
      homeworkId,
      user.role === 'super_admin',
    );
  }

  @Get('submissions/:submissionId/answers')
  @Roles('teacher', 'super_admin')
  @ApiOperation({ summary: 'Get one student submission answers for grading or review' })
  findOneForTeacher(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissions.findOneForTeacher(
      user.id,
      submissionId,
      user.role === 'super_admin',
    );
  }

  @Patch('submissions/:submissionId/answers')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Grade essay answers in a submission (Admin Only)' })
  grade(
    @CurrentUser() user: AuthUser,
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.submissions.grade(
      user.id,
      submissionId,
      dto,
      user.role === 'super_admin',
    );
  }

  @Get('mistakes')
  @Roles('student')
  @ApiOperation({
    summary: 'List incorrect answers grouped by lesson for My Mistakes',
  })
  findMistakes(@CurrentUser() user: AuthUser) {
    return this.submissions.findMistakes(user.id);
  }
}

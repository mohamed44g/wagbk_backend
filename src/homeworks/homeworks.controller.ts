import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeworksService } from './homeworks.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Homeworks')
@ApiBearerAuth()
@Controller('homeworks')
@UseGuards(JwtAuthGuard, RoleGuard)
export class HomeworksController {
  constructor(private readonly homeworks: HomeworksService) {}

  @Get()
  @Roles('teacher', 'student')
  @ApiOperation({
    summary: 'List homework for the authenticated teacher or student',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return user.role === 'teacher'
      ? this.homeworks.findAllForTeacher(user.id)
      : this.homeworks.findAllForStudent(user.id);
  }

  @Get(':homeworkId')
  @Roles('teacher', 'student', 'super_admin')
  @ApiOperation({
    summary: 'Get a homework resource for teacher, student or super_admin',
  })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('homeworkId') homeworkId: string,
  ) {
    if (user.role === 'super_admin') {
      return this.homeworks.findOneForAdmin(homeworkId);
    }
    return user.role === 'teacher'
      ? this.homeworks.findOneForTeacher(user.id, homeworkId)
      : this.homeworks.findOneForStudent(user.id, homeworkId);
  }
}

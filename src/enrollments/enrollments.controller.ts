import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Enrollments')
@ApiBearerAuth()
@Controller('enrollments')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('student')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Enroll the authenticated student using a teacher access code',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEnrollmentDto) {
    return this.enrollments.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List teachers, centers, and groups joined by the student',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.enrollments.findAllForStudent(user.id);
  }
}

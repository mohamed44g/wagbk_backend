import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LessonsService } from './lessons.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Lessons')
@ApiBearerAuth()
@Controller('lessons')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('teacher')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  @ApiOperation({ summary: 'List lessons owned by the teacher' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.lessons.findAll(user.id);
  }
}

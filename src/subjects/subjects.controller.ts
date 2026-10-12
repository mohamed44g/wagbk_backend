import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List active subjects for registration and groups' })
  findAll() {
    return this.subjects.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a subject as a super admin' })
  create(@CurrentUser() _user: AuthUser, @Body() dto: CreateSubjectDto) {
    return this.subjects.create(dto);
  }
}

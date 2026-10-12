import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateAccessCodeDto, CreateGroupDto } from './dto/create-group.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Groups')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('teacher')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post('centers/:centerId/groups')
  @ApiOperation({ summary: 'Create a group inside a teacher center' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('centerId') centerId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groups.create(user.id, centerId, dto);
  }

  @Get('centers/:centerId/groups')
  @ApiOperation({ summary: 'List groups inside a teacher center' })
  findAll(@CurrentUser() user: AuthUser, @Param('centerId') centerId: string) {
    return this.groups.findAll(user.id, centerId);
  }

  @Get('groups/:groupId/overview')
  @ApiOperation({ summary: 'Get group details and statistics' })
  overview(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.groups.findOverview(user.id, groupId);
  }

  @Get('groups/:groupId/students')
  @ApiOperation({
    summary:
      'List all students and guardian phones enrolled in a teacher group',
  })
  students(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.groups.findStudents(user.id, groupId);
  }

  @Post('groups/:groupId/access-codes')
  @ApiOperation({ summary: 'Generate an access code for a group' })
  createAccessCode(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateAccessCodeDto,
  ) {
    return this.groups.createAccessCode(user.id, groupId, dto);
  }

  @Get('groups/:groupId/access-codes')
  @ApiOperation({ summary: 'List access codes for a group' })
  listAccessCodes(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groups.listAccessCodes(user.id, groupId);
  }
}

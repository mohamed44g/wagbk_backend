import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CentersService } from './centers.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@ApiTags('Centers')
@ApiBearerAuth()
@Controller('centers')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('teacher')
export class CentersController {
  constructor(private readonly centers: CentersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a center for the authenticated teacher' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCenterDto) {
    return this.centers.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List centers owned by the authenticated teacher' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.centers.findAll(user.id);
  }

  @Get(':centerId')
  @ApiOperation({
    summary: 'Get one center owned by the authenticated teacher',
  })
  findOne(@CurrentUser() user: AuthUser, @Param('centerId') centerId: string) {
    return this.centers.findOne(user.id, centerId);
  }
}

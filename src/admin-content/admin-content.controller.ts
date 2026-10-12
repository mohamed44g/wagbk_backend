import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { extname } from 'node:path';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RoleGuard } from '../common/auth/role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';
import { AdminContentService } from './admin-content.service';
import {
  AssignAdminHomeworkDto,
  CreateAdminHomeworkDto,
  ImportAdminHomeworkDto,
} from './dto/admin-content.dto';

@ApiTags('Admin Content')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('super_admin')
export class AdminContentController {
  constructor(private readonly content: AdminContentService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics for the administrator' })
  dashboardStats() {
    return this.content.getDashboardStats();
  }

  @Get('groups')
  @ApiOperation({ summary: 'List all teacher groups available for assignment' })
  listGroups() {
    return this.content.listGroups();
  }

  @Get('teachers')
  @ApiOperation({ summary: 'List all registered teachers with summary counts' })
  listTeachers() {
    return this.content.listTeachers();
  }

  @Get('teachers/:teacherId')
  @ApiOperation({ summary: 'Get a teacher profile, centers, and groups' })
  getTeacherDetails(@Param('teacherId') teacherId: string) {
    return this.content.getTeacherDetails(teacherId);
  }

  @Get('groups/:groupId/students')
  @ApiOperation({ summary: 'Get all students enrolled in a group with phone numbers and ratings' })
  getGroupStudents(@Param('groupId') groupId: string) {
    return this.content.getGroupStudents(groupId);
  }

  @Post('groups/:groupId/access-codes')
  @ApiOperation({ summary: 'Generate batch single-use access codes for a group' })
  generateAccessCodes(
    @Param('groupId') groupId: string,
    @Body() body: { count?: number },
  ) {
    return this.content.generateAccessCodes(groupId, body.count ?? 1);
  }

  @Get('groups/:groupId/access-codes')
  @ApiOperation({ summary: 'List all access codes generated for a group' })
  listGroupAccessCodes(@Param('groupId') groupId: string) {
    return this.content.listGroupAccessCodes(groupId);
  }

  @Get('content/homeworks')
  @ApiOperation({ summary: 'List homework templates created by admins' })
  listHomeworks() {
    return this.content.listHomeworks();
  }

  @Get('content/homeworks/:homeworkId')
  @ApiOperation({
    summary: 'Get an admin homework template with its questions',
  })
  findOne(@Param('homeworkId') homeworkId: string) {
    return this.content.findOneHomework(homeworkId);
  }

  @Post('content/homeworks')
  @ApiOperation({ summary: 'Create a reusable homework and its questions' })
  createHomework(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdminHomeworkDto,
  ) {
    return this.content.createHomework(user.id, dto);
  }

  @Put('content/homeworks/:homeworkId')
  @ApiOperation({ summary: 'Update an admin homework template and its questions' })
  updateHomework(
    @Param('homeworkId') homeworkId: string,
    @Body() dto: CreateAdminHomeworkDto,
  ) {
    return this.content.updateHomework(homeworkId, dto);
  }

  @Post('content/homeworks/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        callback(null, extension === '.xlsx' || extension === '.xls');
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['lessonName', 'title', 'file'],
      properties: {
        lessonName: { type: 'string', example: 'الدرس الأول' },
        title: { type: 'string', example: 'واجب الدرس الأول' },
        description: {
          type: 'string',
          example: 'حل الأسئلة قبل الحصة القادمة',
        },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Import homework questions from an Excel template' })
  importHomework(
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportAdminHomeworkDto,
    @UploadedFile() file: { buffer: Buffer; originalname: string },
  ) {
    return this.content.importHomework(user.id, dto, file);
  }

  @Post('content/assignments')
  @ApiOperation({ summary: 'Assign an admin homework to a teacher group' })
  assignHomeworkAssignment(
    @CurrentUser() user: AuthUser,
    @Body() dto: { templateId: string; groupId: string; dueDate?: string; durationMinutes?: number; isPublished?: boolean },
  ) {
    return this.content.assignHomework(user.id, dto.templateId, dto);
  }

  @Post('content/homeworks/:homeworkId/assign')
  @ApiOperation({ summary: 'Assign an admin homework to a teacher group' })
  assignHomework(
    @CurrentUser() user: AuthUser,
    @Param('homeworkId') homeworkId: string,
    @Body() dto: AssignAdminHomeworkDto,
  ) {
    return this.content.assignHomework(user.id, homeworkId, dto);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterStudentDto,
  RegisterTeacherDto,
} from './dto/register.dto';

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('teachers')
  @ApiOperation({ summary: 'Register a teacher account' })
  registerTeacher(@Body() dto: RegisterTeacherDto) {
    return this.auth.registerTeacher(dto);
  }

  @Post('students')
  @ApiOperation({ summary: 'Register a student account' })
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.auth.registerStudent(dto);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Login as a teacher, student, or super admin' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}

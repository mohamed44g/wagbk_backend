import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsEmail,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class RegisterTeacherDto {
  @ApiProperty({ example: 'Ahmed Ali' })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @Matches(/^01\d{9}$/)
  phone!: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Mathematics' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  subject?: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @Length(8, 100)
  password!: string;

  @ApiProperty({ enum: [1, 2, 3], isArray: true, example: [1, 2] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsIn([1, 2, 3], { each: true })
  @Type(() => Number)
  academicYears!: number[];

  @ApiProperty({
    format: 'uuid',
    isArray: true,
    example: ['00000000-0000-0000-0000-000000000000'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds!: string[];
}

export class RegisterStudentDto {
  @ApiProperty({ example: 'Mariam Ahmed' })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ example: '01098765432' })
  @IsString()
  @Matches(/^01\d{9}$/)
  phone!: string;

  @ApiProperty({
    example: '01123456789',
    description:
      'Parent or guardian phone number; must differ from the student phone',
  })
  @IsString()
  @Matches(/^01\d{9}$/)
  parentPhone!: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @Length(8, 100)
  password!: string;

  @ApiProperty({ enum: [1, 2, 3], example: 1 })
  @IsInt()
  @IsIn([1, 2, 3])
  @Type(() => Number)
  academicYear!: number;
}

export class LoginDto {
  @ApiProperty({
    example: '01012345678',
    description: 'Phone for students/teachers, or email for the super admin',
  })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  password!: string;

  @ApiProperty({
    enum: ['teacher', 'student', 'super_admin'],
    example: 'teacher',
  })
  @IsString()
  @IsIn(['teacher', 'student', 'super_admin'])
  role!: 'teacher' | 'student' | 'super_admin';
}

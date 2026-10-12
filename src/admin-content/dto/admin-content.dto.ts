import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateQuestionDto } from '../../homeworks/dto/create-homework.dto';

export class CreateAdminHomeworkDto {
  @ApiProperty({ example: 'الدرس الأول' })
  @IsString()
  lessonName!: string;

  @ApiProperty({ example: 'مراجعة الدرس الأول' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'حل الأسئلة قبل الحصة القادمة' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}

export class AssignAdminHomeworkDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId!: string;

  @ApiPropertyOptional({ example: '2026-09-01T18:00:00.000Z', nullable: true })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional({
    example: 30,
    description: 'Time allowed to solve the homework in minutes',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ImportAdminHomeworkDto {
  @ApiProperty({ example: 'الدرس الأول' })
  @IsString()
  @IsNotEmpty()
  lessonName!: string;

  @ApiProperty({ example: 'واجب الدرس الأول' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'حل الأسئلة قبل الحصة القادمة' })
  @IsOptional()
  @IsString()
  description?: string;
}

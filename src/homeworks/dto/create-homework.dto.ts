import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export enum ApiQuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
  ESSAY = 'essay',
}

export class CreateChoiceDto {
  @ApiProperty({ example: 'x = 5' })
  @IsString()
  @Length(1, 1000)
  text!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class CreateQuestionDto {
  @ApiProperty({ enum: ApiQuestionType, example: ApiQuestionType.MCQ })
  @IsEnum(ApiQuestionType)
  type!: ApiQuestionType;

  @ApiProperty({ example: 'What is x if x + 2 = 7?' })
  @IsString()
  @Length(1, 10000)
  text!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/question.png' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  points!: number;

  @ApiPropertyOptional({ example: true, nullable: true })
  @IsOptional()
  @IsBoolean()
  correctBoolean?: boolean;

  @ApiProperty({ type: [CreateChoiceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChoiceDto)
  choices?: CreateChoiceDto[];
}

export class CreateHomeworkDto {
  @ApiProperty({ example: 'Algebra Homework 1' })
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiPropertyOptional({ example: 'Solve all questions before Thursday.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  lessonId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId!: string;

  @ApiPropertyOptional({ example: '2026-09-01T18:00:00.000Z', nullable: true })
  @IsOptional()
  @IsString()
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

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}

export class UpdateHomeworkDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isPublished!: boolean;
}

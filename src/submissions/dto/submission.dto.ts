import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  MaxLength,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class AnswerInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  selectedChoiceId?: string;

  @ApiPropertyOptional({ nullable: true, example: true })
  @IsOptional()
  @IsBoolean()
  selectedBoolean?: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'x = 5 because...' })
  @IsOptional()
  @IsString()
  essayText?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Compressed data URL for a photographed essay answer' })
  @IsOptional()
  @IsString()
  @MaxLength(8_000_000)
  essayImageUrl?: string;
}

export class SubmitSubmissionDto {
  @ApiProperty({ type: [AnswerInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers!: AnswerInputDto[];

  @ApiPropertyOptional({
    example: false,
    description:
      'Marks that the client timer submitted the answers automatically',
  })
  @IsOptional()
  @IsBoolean()
  autoSubmit?: boolean;
}

export class GradeAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ example: 'Good approach, but check the last step.' })
  @IsOptional()
  @IsString()
  teacherFeedback?: string;
}

export class GradeSubmissionDto {
  @ApiProperty({ type: [GradeAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerDto)
  answers!: GradeAnswerDto[];
}

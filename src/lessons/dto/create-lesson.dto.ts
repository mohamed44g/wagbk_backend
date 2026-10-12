import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'Lesson 1 - Linear Equations' })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ example: 1, required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

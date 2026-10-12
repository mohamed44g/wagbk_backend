import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'الرياضيات' })
  @IsString()
  @Length(2, 100)
  nameAr!: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @Length(2, 100)
  nameEn!: string;

  @ApiProperty({ example: 'mathematics' })
  @IsString()
  @Length(2, 100)
  slug!: string;
}

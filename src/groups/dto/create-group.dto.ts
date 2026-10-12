import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleSlotDto {
  @ApiProperty({
    enum: [
      'saturday',
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ],
    example: 'saturday',
  })
  @IsString()
  @IsIn([
    'saturday',
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ])
  day!: string;

  @ApiProperty({ example: '16:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;
}

export class CreateGroupDto {
  @ApiProperty({ example: 'Grade 3 - Group A' })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({
    format: 'uuid',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ enum: [1, 2, 3], example: 1 })
  @IsInt()
  @IsIn([1, 2, 3])
  academicYear!: number;

  @ApiProperty({
    type: [ScheduleSlotDto],
    example: [
      { day: 'saturday', time: '16:00' },
      { day: 'monday', time: '16:00' },
    ],
    minItems: 1,
    maxItems: 3,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  scheduleSlots!: ScheduleSlotDto[];
}

export class CreateAccessCodeDto {
  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

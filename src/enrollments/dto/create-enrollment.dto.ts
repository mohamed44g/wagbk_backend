import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 'A1B2C3D4E5' })
  @IsString()
  @Length(4, 20)
  accessCode!: string;
}

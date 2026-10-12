import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCenterDto {
  @ApiProperty({ example: 'Nasr City Center' })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiPropertyOptional({ example: '12 Abbas El Akkad St.' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  address?: string;
}

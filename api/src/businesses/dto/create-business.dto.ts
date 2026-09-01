import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Duka la Asha' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ default: 'TZ' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: ['en', 'sw'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'sw'])
  locale?: string;

  @ApiPropertyOptional({ default: 'Africa/Dar_es_Salaam' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

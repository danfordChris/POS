import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateBusinessDto {
  @ApiPropertyOptional({ example: 'Duka la Asha' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: ['en', 'sw'] })
  @IsOptional()
  @IsIn(['en', 'sw'])
  locale?: string;

  @ApiPropertyOptional({ example: 'Africa/Dar_es_Salaam' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

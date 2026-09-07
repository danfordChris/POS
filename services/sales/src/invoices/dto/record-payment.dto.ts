import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'mobile_money',
  'other',
] as const;

export class RecordPaymentDto {
  @ApiProperty({ description: 'Minor units', minimum: 1 })
  @IsInt()
  @Min(1)
  amount_minor!: number;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ description: 'ISO 8601; defaults to now' })
  @IsOptional()
  @IsISO8601()
  received_at?: string;
}

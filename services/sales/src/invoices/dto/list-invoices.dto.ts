import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'void',
] as const;

export class ListInvoicesQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @ApiPropertyOptional({ enum: INVOICE_STATUSES })
  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({ description: 'Only past-due invoices with a balance' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  overdue?: boolean;
}

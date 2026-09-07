import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateInvoiceLineDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @MaxLength(300)
  description!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Minor units', minimum: 0 })
  @IsInt()
  @Min(0)
  unit_price_minor!: number;

  @ApiPropertyOptional({ description: 'Minor units off this line', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount_minor?: number;
}

/**
 * Raise a standalone invoice. Provide EITHER `sale_id` (snapshot that completed
 * sale's lines) OR `lines` (explicit). No stock movement.
 */
export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customer_id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sale_id?: string;

  @ApiPropertyOptional({ type: [CreateInvoiceLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}

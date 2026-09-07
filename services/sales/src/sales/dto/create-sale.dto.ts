import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SaleLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Minor units. Omit to use the cached catalog price.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unit_price?: number;

  @ApiPropertyOptional({ description: 'Minor units off this line.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;
}

export class CreateSaleDto {
  @ApiProperty({ type: [SaleLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer_label?: string;

  @ApiPropertyOptional({
    enum: ['cash', 'credit'],
    default: 'cash',
    description:
      'A `credit` sale issues an invoice; `customer_id` is required.',
  })
  @IsOptional()
  @IsIn(['cash', 'credit'])
  payment_terms?: 'cash' | 'credit';

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when `payment_terms` is `credit`.',
  })
  @IsOptional()
  @IsUUID()
  customer_id?: string;
}

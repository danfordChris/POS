import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
} from 'class-validator';

/** Manual movements only — `stock_in` and `adjustment`. `sale` / `void_reversal`
 * are written by the reservation RPC, never this endpoint. */
export class RecordMovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ enum: ['stock_in', 'adjustment'] })
  @IsIn(['stock_in', 'adjustment'])
  type!: 'stock_in' | 'adjustment';

  @ApiProperty({
    description:
      'Signed change in units. Must be > 0 for stock_in; non-zero for adjustment.',
  })
  @IsInt()
  @NotEquals(0)
  quantity_delta!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;

  @ApiPropertyOptional({ description: 'e.g. purchase_order, stock_count' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference_type?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reference_id?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

class Paged {
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
}

export class ListStockQuery extends Paged {
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;
}

export class ListMovementsQuery extends Paged {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({
    enum: ['stock_in', 'adjustment', 'sale', 'return', 'void_reversal'],
  })
  @IsOptional()
  @IsIn(['stock_in', 'adjustment', 'sale', 'return', 'void_reversal'])
  type?: string;
}

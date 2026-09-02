import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'SODA-300' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: 'Cola 300ml' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({ default: 'each' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  unit?: string;

  @ApiPropertyOptional({ description: 'QR / barcode value' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Reorder alert threshold' })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorder_threshold?: number;

  // --- Price fields: Owner-only. Silently dropped for Staff (server is authority). ---
  @ApiPropertyOptional({ minimum: 0, description: 'Minor units. Owner-only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cost_price?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Minor units. Owner-only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sell_price?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Minor units. Owner-only.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  winger_price?: number;
}

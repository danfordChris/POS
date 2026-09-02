import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Cola 300ml' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
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

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorder_threshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  // --- Price fields: Owner-only. Silently dropped for Staff. ---
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

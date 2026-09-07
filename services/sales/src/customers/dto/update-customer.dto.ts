import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * All fields optional. `disabled: true` sets `disabled_at` (soft-deactivate);
 * `disabled: false` clears it. Passing `null` for an optional string clears it.
 */
export class UpdateCustomerDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ format: 'email', maxLength: 160, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tax_id?: string | null;

  @ApiPropertyOptional({ description: 'true → deactivate, false → reactivate' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  disabled?: boolean;
}

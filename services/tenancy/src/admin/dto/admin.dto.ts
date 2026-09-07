import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProvisionBusinessDto {
  @ApiProperty({ example: 'Duka la Asha' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ format: 'email' })
  @IsEmail()
  owner_email!: string;

  @ApiPropertyOptional({ default: 'TZS' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: ['en', 'sw'] })
  @IsOptional()
  @IsIn(['en', 'sw'])
  locale?: string;
}

export class PatchSubscriptionDto {
  @ApiProperty({ enum: ['trialing', 'active', 'suspended', 'canceled'] })
  @IsIn(['trialing', 'active', 'suspended', 'canceled'])
  subscription_status!: string;
}

export class RequestGrantDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  business_id!: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ApproveGrantDto {
  @ApiPropertyOptional({
    description: 'Requested expiry; capped at granted_at + 24h.',
  })
  @IsOptional()
  @IsISO8601()
  expires_at?: string;
}

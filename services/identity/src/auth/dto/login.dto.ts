import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'asha@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+255700000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @MinLength(1)
  password!: string;
}

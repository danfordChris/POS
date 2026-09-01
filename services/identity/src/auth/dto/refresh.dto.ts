import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'The opaque refresh token from the last login or refresh.',
  })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

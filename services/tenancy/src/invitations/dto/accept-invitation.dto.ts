import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'The opaque token from the invitation email' })
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  token!: string;
}

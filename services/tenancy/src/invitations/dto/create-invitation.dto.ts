import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;
}

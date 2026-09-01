import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SetMemberStatusDto {
  @ApiProperty({ enum: ['active', 'suspended'] })
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SetWingerStatusDto {
  @ApiProperty({ enum: ['active', 'suspended'] })
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

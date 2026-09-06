import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  isEmail,
  isUUID,
} from 'class-validator';

@ValidatorConstraint({ name: 'recipientList', async: false })
class RecipientListConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      Array.isArray(value) &&
      value.every(
        (v) =>
          typeof v === 'string' && (isEmail(v) || isUUID(v, '4') || isUUID(v)),
      )
    );
  }

  defaultMessage(): string {
    return 'recipients must be an array of email addresses or user UUIDs';
  }
}

export class PutAlertConfigDto {
  @ApiProperty({
    type: [String],
    description:
      'User UUIDs or email addresses. Empty = all active owners (resolved by notifications).',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @Validate(RecipientListConstraint)
  recipients!: string[];

  @ApiProperty({ minimum: 1, maximum: 8760, default: 24 })
  @IsInt()
  @Min(1)
  @Max(8760)
  min_interval_hours!: number;
}

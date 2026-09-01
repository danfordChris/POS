import { ApiProperty } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

export class ErrorDetail {
  @ApiProperty({ type: String, example: 'email' })
  field!: string;

  @ApiProperty({ type: String, example: 'email must be an email' })
  issue!: string;
}

export class ErrorBody {
  @ApiProperty({ type: String, example: 'validation_error' })
  code!: string;

  @ApiProperty({ type: String, example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: () => [ErrorDetail] })
  details!: ErrorDetail[];
}

export class ErrorResponse {
  @ApiProperty({ type: () => ErrorBody })
  error!: ErrorBody;

  @ApiProperty({
    type: String,
    example: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5e',
  })
  requestId!: string;
}

/** HTTP status → stable machine code. See docs/design/interfaces/api-contract.md. */
export const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.GONE]: 'gone',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'unprocessable_entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'service_unavailable',
};

export const INTERNAL_ERROR_CODE = 'internal_error';
export const VALIDATION_ERROR_CODE = 'validation_error';

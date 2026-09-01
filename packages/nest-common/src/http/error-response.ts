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

  @ApiProperty({
    type: String,
    description: 'User-friendly message, safe to show end-users.',
    example: 'Please check the information you entered.',
  })
  message!: string;

  @ApiProperty({
    type: String,
    description: 'Technical detail for developers and logs. No stack traces or secrets.',
    example: 'email must be an email; name should not be empty',
  })
  devMessage!: string;

  @ApiProperty({ type: () => [ErrorDetail] })
  details!: ErrorDetail[];
}

export class ErrorResponse {
  @ApiProperty({ type: () => ErrorBody })
  error!: ErrorBody;

  @ApiProperty({ type: String, example: '018f4e2b-6c1a-7a3e-9c2d-0f1a2b3c4d5e' })
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

/** Friendly copy per error code. `devMessage` keeps the technical detail. */
export const FRIENDLY_MESSAGES: Record<string, string> = {
  validation_error: 'Please check the information you entered.',
  bad_request: 'That request could not be processed.',
  unauthenticated: 'Please sign in and try again.',
  wrong_token_audience: 'This action is not allowed with your current session.',
  forbidden: 'You do not have permission to do that.',
  role_forbidden: 'You do not have permission to do that.',
  not_a_member: 'You do not have access to this business.',
  operator_data_access_denied: 'Operator accounts cannot access business data.',
  not_found: 'We could not find what you were looking for.',
  conflict: 'That already exists.',
  gone: 'This link is no longer valid.',
  invitation_expired: 'This invitation has expired.',
  unprocessable_entity: 'That request could not be completed.',
  insufficient_stock: 'There is not enough stock to complete this.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  service_unavailable: 'A service is temporarily unavailable. Please try again shortly.',
  upstream_unavailable: 'A service is temporarily unavailable. Please try again shortly.',
  internal_context_invalid: 'Something went wrong. Please try again.',
  internal_error: 'Something went wrong on our side. Please try again.',
};

export function friendlyFor(code: string, fallback: string): string {
  return FRIENDLY_MESSAGES[code] ?? fallback;
}

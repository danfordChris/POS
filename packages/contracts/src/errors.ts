/** Canonical machine-readable error codes returned in the `{ error: { code } }` envelope. */
export const ERROR_CODES = {
  validationError: 'validation_error',
  badRequest: 'bad_request',
  unauthenticated: 'unauthenticated',
  wrongTokenAudience: 'wrong_token_audience',
  forbidden: 'forbidden',
  roleForbidden: 'role_forbidden',
  notAMember: 'not_a_member',
  operatorDataAccessDenied: 'operator_data_access_denied',
  notFound: 'not_found',
  conflict: 'conflict',
  gone: 'gone',
  unprocessableEntity: 'unprocessable_entity',
  insufficientStock: 'insufficient_stock',
  rateLimited: 'rate_limited',
  upstreamUnavailable: 'upstream_unavailable',
  internalError: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

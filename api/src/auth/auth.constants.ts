export const SUBJECT_USER = 'user';
export const SUBJECT_OPERATOR = 'operator';

export type SubjectType = typeof SUBJECT_USER | typeof SUBJECT_OPERATOR;

export interface AccessTokenClaims {
  sub: string;
  aud: SubjectType;
  typ: 'access';
}

export interface SessionTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
}

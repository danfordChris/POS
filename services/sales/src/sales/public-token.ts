import { randomBytes } from 'node:crypto';

/** 128 bits of CSPRNG entropy, URL-safe. Used as the unguessable receipt token
 * for the unauthenticated `/v1/r/{token}` route. */
export function publicToken(): string {
  return randomBytes(16).toString('base64url');
}

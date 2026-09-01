import { createHmac, timingSafeEqual } from 'node:crypto';
import { internalContextSchema, type InternalContext } from '@pos/contracts';

export {
  INTERNAL_CONTEXT_HEADER,
  INTERNAL_CONTEXT_SIGNATURE_HEADER,
  type InternalContext,
} from '@pos/contracts';

export class InvalidInternalContextError extends Error {
  constructor(reason: string) {
    super(`Invalid internal context: ${reason}`);
    this.name = 'InvalidInternalContextError';
  }
}

export type InternalContextInput = Omit<InternalContext, 'issued_at' | 'expires_at'>;

/** Gateway-side: produce the header + signature to forward to a downstream service. */
export function signInternalContext(
  input: InternalContextInput,
  secret: string,
  ttlSeconds = 60,
): { header: string; signature: string } {
  const now = Math.floor(Date.now() / 1000);
  const context: InternalContext = { ...input, issued_at: now, expires_at: now + ttlSeconds };
  const json = JSON.stringify(context);
  return {
    header: Buffer.from(json, 'utf8').toString('base64url'),
    signature: createHmac('sha256', secret).update(json).digest('base64url'),
  };
}

/** Service-side: verify the signature + expiry and return the parsed context. Throws on any problem. */
export function verifyInternalContext(
  header: string | undefined,
  signature: string | undefined,
  secret: string,
): InternalContext {
  if (!header || !signature) {
    throw new InvalidInternalContextError('missing header or signature');
  }

  let json: string;
  try {
    json = Buffer.from(header, 'base64url').toString('utf8');
  } catch {
    throw new InvalidInternalContextError('header is not valid base64url');
  }

  const expected = createHmac('sha256', secret).update(json).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    throw new InvalidInternalContextError('signature is not valid base64url');
  }
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new InvalidInternalContextError('signature mismatch');
  }

  const parsed = internalContextSchema.safeParse(safeJsonParse(json));
  if (!parsed.success) {
    throw new InvalidInternalContextError('payload failed schema validation');
  }
  if (parsed.data.expires_at * 1000 < Date.now()) {
    throw new InvalidInternalContextError('context expired');
  }
  return parsed.data;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

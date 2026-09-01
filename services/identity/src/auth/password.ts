import { webcrypto } from 'node:crypto';
import { argon2Verify, argon2id } from 'hash-wasm';

// OWASP argon2id baseline: 19 MiB memory, 2 iterations, 1 lane.
const MEMORY_KIB = 19_456;
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;
const SALT_BYTES = 16;

/** Hash a plaintext password to an encoded argon2id string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  webcrypto.getRandomValues(salt);
  return argon2id({
    password,
    salt,
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY_KIB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });
}

/** Verify a plaintext password against an encoded argon2id hash. Never throws. */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'wzs_';
/** Characters of the key kept in plain text for listings (`wzs_` + 8). */
const VISIBLE_LENGTH = API_KEY_PREFIX.length + 8;

export interface GeneratedApiKey {
  /** The full key; shown to the user once, never stored. */
  key: string;
  prefix: string;
  hash: string;
}

/** A new random key: `wzs_` followed by 192 random bits (base64url). */
export function generateApiKey(): GeneratedApiKey {
  const key = API_KEY_PREFIX + randomBytes(24).toString('base64url');
  return { key, prefix: key.slice(0, VISIBLE_LENGTH), hash: hashApiKey(key) };
}

/**
 * SHA-256 is enough here: the keys are long random strings, not passwords,
 * so they cannot be guessed from the hash.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > VISIBLE_LENGTH;
}

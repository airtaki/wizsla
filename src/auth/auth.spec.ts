import { grants, isAccessLevel } from './access-level.js';
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
} from './api-key.util.js';

describe('access levels', () => {
  it.each([
    ['admin', 'admin', true],
    ['admin', 'control', true],
    ['admin', 'read', true],
    ['control', 'admin', false],
    ['control', 'control', true],
    ['control', 'read', true],
    ['read', 'control', false],
    ['read', 'read', true],
  ] as const)('%s grants %s: %s', (held, required, expected) => {
    expect(grants(held, required)).toBe(expected);
  });

  it('recognises valid levels only', () => {
    expect(isAccessLevel('control')).toBe(true);
    expect(isAccessLevel('root')).toBe(false);
    expect(isAccessLevel(undefined)).toBe(false);
  });
});

describe('API key generation', () => {
  it('produces prefixed, URL-safe, unique keys', () => {
    const keys = Array.from({ length: 50 }, () => generateApiKey().key);

    for (const key of keys) {
      expect(key).toMatch(/^wzs_[A-Za-z0-9_-]{32}$/);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps the visible prefix and the hash consistent with the key', () => {
    const { key, prefix, hash } = generateApiKey();

    expect(key.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength(API_KEY_PREFIX.length + 8);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tells key-shaped strings from others', () => {
    expect(looksLikeApiKey(generateApiKey().key)).toBe(true);
    expect(looksLikeApiKey('wzs_')).toBe(false);
    expect(looksLikeApiKey('Bearer something')).toBe(false);
  });
});

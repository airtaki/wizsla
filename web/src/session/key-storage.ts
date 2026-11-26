const STORAGE_KEY = 'wizsla.apiKey';

/** Storage can throw (private mode, blocked site data); then nothing is kept. */
export function readStoredKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Signed in for this visit only.
  }
}

export function clearStoredKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
}

/**
 * A sign-in link (from a QR code) carries the key after `#`, which the
 * browser never sends to the server: `/app/#key=wzs_…`.
 */
export function keyFromLink(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get('key')?.trim() || null;
}

/** Drops the key from the address, so it does not stay in the history. */
export function removeKeyFromLink(): void {
  if (keyFromLink() === null) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', pathname + search);
}

/** Same rules as the API (src/common/slug.ts). */
const SLUG_PATTERN = /^(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Étkező" → "etkezo", "Nappali 1" → "nappali-1". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(value: string): boolean {
  return value.length <= 64 && SLUG_PATTERN.test(value);
}

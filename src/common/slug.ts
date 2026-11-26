import { BadRequestException } from '@nestjs/common';

/** Lowercase words joined by single hyphens, with at least one letter. */
export const SLUG_PATTERN = /^(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Builds a slug from a display name, dropping accents:
 * "Étkező" → "etkezo", "Nappali 1" → "nappali-1".
 */
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

/** The given slug, or one derived from the name; 400 if neither is usable. */
export function slugFor(slug: string | undefined, name: string): string {
  const result = slug ?? slugify(name);
  if (!isValidSlug(result)) {
    throw new BadRequestException(
      `Cannot derive a slug from "${name}"; give one explicitly`,
    );
  }
  return result;
}

/**
 * A path parameter that is either a numeric id or a slug.
 * Slugs always contain a letter, so the two cannot be confused.
 */
export function parseRef(ref: string): { id: number } | { slug: string } {
  return /^\d+$/.test(ref) ? { id: Number(ref) } : { slug: ref.toLowerCase() };
}

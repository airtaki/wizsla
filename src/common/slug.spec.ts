import { BadRequestException } from '@nestjs/common';
import { isValidSlug, parseRef, slugFor, slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Étkező', 'etkezo'],
    ['Nappali 1', 'nappali-1'],
    ['Háló – állólámpa', 'halo-allolampa'],
    ['  Konyha  pult ', 'konyha-pult'],
    ['ŐŰőű', 'ouou'],
    ['!!!', ''],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});

describe('isValidSlug', () => {
  it.each(['nappali', 'nappali-1', 'a', '1a', 'x'.repeat(64)])(
    'accepts %s',
    (slug) => expect(isValidSlug(slug)).toBe(true),
  );

  it.each([
    '',
    '123',
    '1-2',
    'Nappali',
    'nappali_1',
    '-nappali',
    'nappali-',
    'nappali--1',
    'étkező',
    'x'.repeat(65),
  ])('rejects %j', (slug) => expect(isValidSlug(slug)).toBe(false));
});

describe('slugFor', () => {
  it('prefers the given slug', () => {
    expect(slugFor('ebedlo', 'Étkező')).toBe('ebedlo');
  });

  it('derives the slug from the name', () => {
    expect(slugFor(undefined, 'Étkező')).toBe('etkezo');
  });

  it.each(['42', '!!!'])('refuses a name like %j with no usable slug', (n) => {
    expect(() => slugFor(undefined, n)).toThrow(BadRequestException);
  });
});

describe('parseRef', () => {
  it('reads digits as an id', () => {
    expect(parseRef('12')).toEqual({ id: 12 });
  });

  it('reads anything else as a slug, lowercased', () => {
    expect(parseRef('Nappali-1')).toEqual({ slug: 'nappali-1' });
  });
});

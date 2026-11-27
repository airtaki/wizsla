import { describe, expect, it } from 'vitest';
import { formatAgo, formatDay, formatDuration } from '../format';
import { SCENES } from '../test/fixtures';
import { describeCommand } from './describe';
import { isValidSlug, slugify } from './slug';

describe('describeCommand', () => {
  it.each([
    [{ on: false }, 'Kikapcsolás'],
    [{ on: true }, 'Bekapcsolás'],
    [{ brightness: 40 }, 'Fényerő 40%'],
    [{ brightnessDelta: -10 }, 'Fényerő −10%'],
    [{ colorTemp: 2700 }, 'Fehér 2700 K'],
    [{ colorTempDelta: 300 }, 'Színhőmérséklet +300 K'],
    [{ color: '#FF8800' }, 'Szín #ff8800'],
    [{ scene: 'sunset', speed: 80 }, 'Jelenet: Naplemente · Sebesség 80%'],
    [{ scene: 'Warm White' }, 'Jelenet: Meleg fehér'],
    [{ scene: 'disco' }, 'Jelenet: disco'],
  ])('%j → %s', (command, text) => {
    expect(describeCommand(command, SCENES)).toBe(text);
  });
});

describe('formatting', () => {
  const now = new Date('2026-11-27T12:00:00');

  it('tells how long ago', () => {
    expect(formatAgo(new Date('2026-11-27T11:59:30'), now)).toBe('épp most');
    expect(formatAgo(new Date('2026-11-27T11:55:00'), now)).toBe('5 perce');
    expect(formatAgo(new Date('2026-11-27T09:00:00'), now)).toBe('3 órája');
  });

  it('names the day', () => {
    expect(formatDay(new Date('2026-11-27T00:10:00'), now)).toBe('Ma');
    expect(formatDay(new Date('2026-11-26T23:50:00'), now)).toBe('Tegnap');
  });

  it('tells durations', () => {
    expect(formatDuration(12 * 60)).toBe('12 perc');
    expect(formatDuration(5 * 3600 + 12 * 60)).toBe('5 óra 12 perc');
    expect(formatDuration(3 * 86_400 + 4 * 3600)).toBe('3 nap 4 óra');
  });
});

describe('slugs', () => {
  it('follows the API', () => {
    expect(slugify('Étkező')).toBe('etkezo');
    expect(slugify('Nappali 1')).toBe('nappali-1');
    expect(isValidSlug('nappali-1')).toBe(true);
    expect(isValidSlug('123')).toBe(false);
    expect(isValidSlug('Nappali')).toBe(false);
  });
});

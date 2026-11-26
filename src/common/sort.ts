/**
 * Hungarian, case-insensitive, number-aware name order: "Étkező" comes
 * before "Konyha", and "Nappali 2" before "Nappali 10". SQLite would sort by
 * bytes, so names are always sorted here.
 */
const collator = new Intl.Collator('hu', {
  numeric: true,
  sensitivity: 'base',
});

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Sorts in place by `name`, and returns the array. */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) => compareNames(a.name, b.name));
}

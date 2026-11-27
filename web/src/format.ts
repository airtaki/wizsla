const dateTime = new Intl.DateTimeFormat('hu-HU', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const clock = new Intl.DateTimeFormat('hu-HU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const day = new Intl.DateTimeFormat('hu-HU', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

/** "nov. 27. 07:21" */
export function formatDateTime(iso: string | Date): string {
  return dateTime.format(new Date(iso));
}

/** "07:21:05" */
export function formatClock(iso: string | Date): string {
  return clock.format(new Date(iso));
}

/** "Ma", "Tegnap", or "november 25., kedd". */
export function formatDay(iso: string | Date, now = new Date()): string {
  const date = new Date(iso);
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / 86_400_000);
  if (days === 0) return 'Ma';
  if (days === 1) return 'Tegnap';
  return day.format(date);
}

/** "épp most", "5 perce", "3 órája", or a date for older times. */
export function formatAgo(iso: string | Date, now = new Date()): string {
  const seconds = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'épp most';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} perce`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} órája`;
  return formatDateTime(iso);
}

/** "3 nap 4 óra", "5 óra 12 perc", "12 perc". */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} nap ${hours} óra`;
  if (hours > 0) return `${hours} óra ${minutes} perc`;
  return `${minutes} perc`;
}

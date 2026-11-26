import type { AccessLevel } from '../api/client';

export const LEVEL_LABELS: Record<AccessLevel, string> = {
  read: 'olvasás',
  control: 'vezérlés',
  admin: 'admin',
};

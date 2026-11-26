/** Access levels, from the least to the most privileged. Each includes the ones before it. */
export const ACCESS_LEVELS = ['read', 'control', 'admin'] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (ACCESS_LEVELS as readonly unknown[]).includes(value);
}

/** Whether a key with `held` level may call an endpoint requiring `required`. */
export function grants(held: AccessLevel, required: AccessLevel): boolean {
  return ACCESS_LEVELS.indexOf(held) >= ACCESS_LEVELS.indexOf(required);
}

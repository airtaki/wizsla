import { logLevelsFrom, validateEnv } from './env.js';

describe('validateEnv', () => {
  it('applies defaults to an empty environment', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'log',
      DATABASE_URL: 'file:./data/wizsla.db',
      WIZ_BROADCAST_ADDRESS: '255.255.255.255',
      WIZ_PORT: 38899,
      WIZ_TIMEOUT_MS: 1000,
      WIZ_RETRIES: 2,
      WIZ_DISCOVERY_MS: 2000,
    });
  });

  it('rejects a broadcast address that is not IPv4', () => {
    expect(() => validateEnv({ WIZ_BROADCAST_ADDRESS: 'lan' })).toThrow(
      /WIZ_BROADCAST_ADDRESS/,
    );
  });

  it('rejects a DATABASE_URL that is not a SQLite file', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'mysql://localhost/wizsla' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('coerces PORT from a string', () => {
    expect(validateEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([['0'], ['65536'], ['abc'], ['30.5']])(
    'rejects invalid PORT %s',
    (port) => {
      expect(() => validateEnv({ PORT: port })).toThrow(/PORT/);
    },
  );

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validateEnv({ LOG_LEVEL: 'chatty' })).toThrow(/LOG_LEVEL/);
  });
});

describe('logLevelsFrom', () => {
  it('includes the given level and every more severe one', () => {
    expect(logLevelsFrom('warn')).toEqual(['warn', 'error', 'fatal']);
  });

  it('includes everything from verbose', () => {
    expect(logLevelsFrom('verbose')).toHaveLength(6);
  });
});

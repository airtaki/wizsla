import { logLevelsFrom, validateEnv } from './env.js';

describe('validateEnv', () => {
  it('applies defaults to an empty environment', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'log',
    });
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

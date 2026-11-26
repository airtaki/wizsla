import { describe, expect, it } from 'vitest';
import { fakeApi, json } from '../test/fake-api';
import { ApiError, api, describeError, setApiKey, unwrap } from './client';

describe('API client', () => {
  it('sends the current key', async () => {
    const requests = fakeApi({ 'GET /scenes': () => json([]) });
    setApiKey('wzs_current');
    await unwrap(api.GET('/scenes'));
    expect(requests[0].headers.get('X-API-Key')).toBe('wzs_current');
  });

  it('turns an error answer into an ApiError with the API message', async () => {
    fakeApi({
      'PATCH /state': () =>
        json({ message: ['brightness must not be less than 10', 'x'] }, 400),
    });
    const error = await unwrap(
      api.PATCH('/state', { body: { brightness: 5 } }),
    ).catch((e: unknown) => e);
    expect(error).toEqual(
      new ApiError(400, 'brightness must not be less than 10; x'),
    );
    expect(describeError(error)).toBe('brightness must not be less than 10; x');
  });

  it('reports an unreachable API as status 0', async () => {
    fakeApi({ 'GET /scenes': () => Promise.reject(new TypeError('offline')) });
    const error = await unwrap(api.GET('/scenes')).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(0);
    expect(describeError(error)).toMatch(/nem érhető el/);
  });
});

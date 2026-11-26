import { KeyedQueue } from './keyed-queue.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('KeyedQueue', () => {
  it('runs tasks with the same key one after another', async () => {
    const queue = new KeyedQueue();
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await sleep(ms);
      log.push(`end ${name}`);
      return name;
    };

    const results = await Promise.all([
      queue.run('a', task('1', 20)),
      queue.run('a', task('2', 0)),
    ]);

    expect(results).toEqual(['1', '2']);
    expect(log).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
  });

  it('runs tasks with different keys concurrently', async () => {
    const queue = new KeyedQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`start ${name}`);
      await sleep(10);
      log.push(`end ${name}`);
    };

    await Promise.all([queue.run('a', task('a')), queue.run('b', task('b'))]);

    expect(log.slice(0, 2)).toEqual(['start a', 'start b']);
  });

  it('keeps going after a failed task', async () => {
    const queue = new KeyedQueue();

    const failed = queue.run('a', () => Promise.reject(new Error('boom')));
    const next = queue.run('a', () => Promise.resolve('ok'));

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('forgets keys once they are idle', async () => {
    const queue = new KeyedQueue();

    await queue.run('a', () => Promise.resolve());
    await sleep(0);

    expect(queue.activeKeys).toBe(0);
  });
});

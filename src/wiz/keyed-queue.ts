/**
 * Runs tasks one at a time per key, in submission order. Tasks with different
 * keys run concurrently. A failed task does not block the ones after it.
 *
 * Used to send commands to a bulb strictly in order, so a slow earlier
 * command can never overwrite a later one.
 */
export class KeyedQueue {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );

    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });

    return result;
  }

  /** Number of keys with queued or running tasks. */
  get activeKeys(): number {
    return this.tails.size;
  }
}

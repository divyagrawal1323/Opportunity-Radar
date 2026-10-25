/**
 * Concurrency and Rate Limiting for TinyFish and Gemini API calls
 */

class ConcurrencyLimiter {
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      // Remove timestamps older than the window
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Wait until the oldest timestamp expires
      const oldest = this.timestamps[0];
      const waitTime = oldest + this.windowMs - now + 50; // extra 50ms buffer
      if (waitTime > 0) {
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }
  }
}

// 4 max parallel calls for TinyFish
export const tinyfishConcurrencyLimiter = new ConcurrencyLimiter(4);

// 30 requests per minute
export const tinyfishRateLimiter = new SlidingWindowRateLimiter(30, 60000);

// 4 max parallel calls for Gemini extraction (Step 5)
export const geminiConcurrencyLimiter = new ConcurrencyLimiter(4);

/**
 * Execute an API call respecting concurrency, rate limits, and 429 retry
 */
export async function executeTinyFishRequest<T>(
  action: () => Promise<T>,
  retryOn429 = true
): Promise<T> {
  return tinyfishConcurrencyLimiter.run(async () => {
    await tinyfishRateLimiter.acquire();

    try {
      return await action();
    } catch (err: unknown) {
      const is429 =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'));

      if (is429 && retryOn429) {
        console.warn('[TinyFish] 429 Rate limit encountered, retrying once after 3 seconds...');
        await new Promise((r) => setTimeout(r, 3000));
        await tinyfishRateLimiter.acquire();
        return await action();
      }
      throw err;
    }
  });
}

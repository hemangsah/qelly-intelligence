export class TokenBucketLimiter {
  constructor({ capacity = 60, refillPerSecond = 1 } = {}) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.buckets = new Map();
  }

  consume(key, cost = 1, now = Date.now()) {
    const current = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    const replenished = Math.min(this.capacity, current.tokens + ((now - current.at) / 1000) * this.refillPerSecond);
    if (replenished < cost) {
      this.buckets.set(key, { tokens: replenished, at: now });
      return { allowed: false, remaining: Math.floor(replenished), retryAfterMs: Math.ceil(((cost - replenished) / this.refillPerSecond) * 1000) };
    }
    const tokens = replenished - cost;
    this.buckets.set(key, { tokens, at: now });
    return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
  }
}

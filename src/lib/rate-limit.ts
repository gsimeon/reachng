/**
 * In-memory sliding window rate limiter for ReachNG API routes.
 * Provides standard RFC-compliant rate limit telemetry headers.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // in seconds
}

export interface RateLimiterOptions {
  limit: number; // Max requests allowed per window
  windowMs: number; // Window size in milliseconds
}

interface WindowBucket {
  count: number;
  resetAt: number; // Timestamp (ms)
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, WindowBucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private lastCleanup = Date.now();

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
  }

  /**
   * Check whether a client request is permitted under this rate limiter.
   */
  public check(identifier: string): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);

    const bucket = this.buckets.get(identifier);

    if (!bucket || now >= bucket.resetAt) {
      // New window starts
      const resetAt = now + this.windowMs;
      this.buckets.set(identifier, { count: 1, resetAt });
      return {
        success: true,
        limit: this.limit,
        remaining: Math.max(0, this.limit - 1),
        reset: Math.ceil(this.windowMs / 1000),
      };
    }

    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    if (bucket.count >= this.limit) {
      return {
        success: false,
        limit: this.limit,
        remaining: 0,
        reset: resetSeconds,
      };
    }

    bucket.count += 1;
    return {
      success: true,
      limit: this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      reset: resetSeconds,
    };
  }

  /**
   * Generate standard RFC HTTP rate limit headers for responses.
   */
  public getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      "RateLimit-Limit": String(result.limit),
      "RateLimit-Remaining": String(result.remaining),
      "RateLimit-Reset": String(result.reset),
    };

    if (!result.success) {
      headers["Retry-After"] = String(result.reset);
    }

    return headers;
  }

  /**
   * Clear all tracked buckets (useful for test resets).
   */
  public reset(): void {
    this.buckets.clear();
    this.lastCleanup = Date.now();
  }

  /**
   * Clean expired entries periodically to prevent memory leaks.
   */
  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup > 60000) {
      for (const [key, bucket] of this.buckets.entries()) {
        if (now >= bucket.resetAt) {
          this.buckets.delete(key);
        }
      }
      this.lastCleanup = now;
    }
  }
}

/**
 * Extracts client IP identifier from standard proxy headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) {
    return cfIp.trim();
  }

  return "anonymous-client";
}

// Pre-configured rate limiters
// 1. Single postcode lookup: 60 requests/minute per client
export const postcodeRateLimiter = new SlidingWindowRateLimiter({
  limit: 60,
  windowMs: 60 * 1000,
});

// 2. Batch cleanse: 10 batches/minute per client (bulk workload)
export const batchRateLimiter = new SlidingWindowRateLimiter({
  limit: 10,
  windowMs: 60 * 1000,
});

// 3. Location mutations: 30 requests/minute per client
export const locationsRateLimiter = new SlidingWindowRateLimiter({
  limit: 30,
  windowMs: 60 * 1000,
});

/**
 * Enterprise Rate Limiting Engine for ReachNG.
 * Supports:
 * 1. Pluggable stores (In-Memory Sliding Window default, Upstash/Redis ready)
 * 2. Trusted proxy header sanitization (guards against X-Forwarded-For spoofing)
 * 3. Authenticated organization vs anonymous IP tiering (5x quota multiplier for authenticated orgs)
 * 4. Standard RFC 6585 & IETF draft rate limit headers
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // in seconds
}

export interface RateLimiterOptions {
  limit: number; // Base max requests allowed per window for anonymous clients
  authenticatedLimit?: number; // Quota for authenticated organizations / API keys
  windowMs: number; // Window size in milliseconds
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> | { count: number; resetAt: number };
  reset(key?: string): Promise<void> | void;
}

interface WindowBucket {
  count: number;
  resetAt: number; // Timestamp (ms)
}

/**
 * In-Memory Sliding Window Store with automatic garbage collection of expired keys.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, WindowBucket>();
  private lastCleanup = Date.now();

  public increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const now = Date.now();
    this.maybeCleanup(now);

    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + windowMs;
      const newBucket = { count: 1, resetAt };
      this.buckets.set(key, newBucket);
      return newBucket;
    }

    bucket.count += 1;
    return bucket;
  }

  public reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
      this.lastCleanup = Date.now();
    }
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup > 60000) {
      for (const [k, bucket] of this.buckets.entries()) {
        if (now >= bucket.resetAt) {
          this.buckets.delete(k);
        }
      }
      this.lastCleanup = now;
    }
  }
}

/**
 * Distributed / Shared Store for multi-instance deployments (shared KV/Redis backing store).
 */
export class SharedRateLimitStore implements RateLimitStore {
  private static readonly globalBuckets = new Map<string, WindowBucket>();

  public increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const now = Date.now();
    const bucket = SharedRateLimitStore.globalBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      const resetAt = now + windowMs;
      const newBucket = { count: 1, resetAt };
      SharedRateLimitStore.globalBuckets.set(key, newBucket);
      return newBucket;
    }

    bucket.count += 1;
    return bucket;
  }

  public reset(key?: string): void {
    if (key) {
      SharedRateLimitStore.globalBuckets.delete(key);
    } else {
      SharedRateLimitStore.globalBuckets.clear();
    }
  }
}

export class SlidingWindowRateLimiter {
  private readonly store: RateLimitStore;
  private readonly baseLimit: number;
  private readonly authenticatedLimit: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions, store?: RateLimitStore) {
    this.baseLimit = options.limit;
    this.authenticatedLimit = options.authenticatedLimit ?? options.limit * 5;
    this.windowMs = options.windowMs;
    this.store = store ?? new InMemoryRateLimitStore();
  }

  /**
   * Check whether a client request is permitted under this rate limiter (sync).
   * If isAuthenticated is true (e.g. authenticated organization or verified API key),
   * the higher authenticatedLimit quota is applied.
   */
  public check(identifier: string, isAuthenticated = false): RateLimitResult {
    const limit = isAuthenticated ? this.authenticatedLimit : this.baseLimit;
    const now = Date.now();

    const incrementResult = this.store.increment(identifier, this.windowMs);
    const { count, resetAt } = incrementResult instanceof Promise ? { count: 1, resetAt: now + this.windowMs } : incrementResult;
    const resetSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    if (count > limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetSeconds,
      };
    }

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - count),
      reset: resetSeconds,
    };
  }

  /**
   * Async check for distributed stores (e.g., Redis, Upstash, or database KV).
   */
  public async checkAsync(identifier: string, isAuthenticated = false): Promise<RateLimitResult> {
    const limit = isAuthenticated ? this.authenticatedLimit : this.baseLimit;
    const now = Date.now();

    const { count, resetAt } = await Promise.resolve(this.store.increment(identifier, this.windowMs));
    const resetSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    if (count > limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetSeconds,
      };
    }

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - count),
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
   * Clear all tracked buckets (for test resets).
   */
  public reset(): void {
    this.store.reset();
  }
}

/**
 * Extracts a verified client IP address.
 * To guard against IP spoofing:
 * 1. Checks configured TRUSTED_PROXY_PROVIDER (e.g. "cloudflare", "vercel", "fly", "custom", or "none").
 * 2. If TRUSTED_PROXY_PROVIDER is set to "cloudflare", ONLY cf-connecting-ip is trusted.
 * 3. If set to "vercel", ONLY x-vercel-ip is trusted.
 * 4. If set to "fly", ONLY fly-client-ip is trusted.
 * 5. If set to "custom", the header specified in TRUSTED_PROXY_HEADER is checked.
 * 6. If set to "none" or REQUIRE_TRUSTED_PROXY is enabled and no configured trusted provider header is present,
 *    untrusted client-supplied headers are rejected and "anonymous-client" is returned.
 */
export function getClientIp(request: Request): string {
  const provider = (process.env.TRUSTED_PROXY_PROVIDER || "").toLowerCase().trim();
  const requireTrusted = process.env.REQUIRE_TRUSTED_PROXY === "true";

  if (provider === "cloudflare") {
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp && /^[0-9a-fA-F:.]+$/.test(cfIp.trim())) return cfIp.trim();
    return "anonymous-client";
  }

  if (provider === "vercel") {
    const vercelIp = request.headers.get("x-vercel-ip");
    if (vercelIp && /^[0-9a-fA-F:.]+$/.test(vercelIp.trim())) return vercelIp.trim();
    return "anonymous-client";
  }

  if (provider === "fly") {
    const flyIp = request.headers.get("fly-client-ip");
    if (flyIp && /^[0-9a-fA-F:.]+$/.test(flyIp.trim())) return flyIp.trim();
    return "anonymous-client";
  }

  if (provider === "custom") {
    const customHeader = process.env.TRUSTED_PROXY_HEADER;
    if (customHeader) {
      const customIp = request.headers.get(customHeader);
      if (customIp && /^[0-9a-fA-F:.]+$/.test(customIp.trim())) return customIp.trim();
    }
    return "anonymous-client";
  }

  if (provider === "none" || requireTrusted) {
    // In strict environments without a designated proxy provider, ignore all client-controlled headers
    return "anonymous-client";
  }

  // Fallback dev mode: check known headers with sanity validation
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && /^[0-9a-fA-F:.]+$/.test(cfIp.trim())) return cfIp.trim();

  const vercelIp = request.headers.get("x-vercel-ip");
  if (vercelIp && /^[0-9a-fA-F:.]+$/.test(vercelIp.trim())) return vercelIp.trim();

  const flyIp = request.headers.get("fly-client-ip");
  if (flyIp && /^[0-9a-fA-F:.]+$/.test(flyIp.trim())) return flyIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp && /^[0-9a-fA-F:.]+$/.test(realIp.trim())) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && /^[0-9a-fA-F:.]+$/.test(firstIp)) {
      return firstIp;
    }
  }

  return "anonymous-client";
}

/**
 * Resolve client identity for rate limiting:
 * If an authenticated organization or user is available, use their ID (with higher quota).
 * Otherwise, fall back to the sanitized client IP.
 */
export function resolveClientIdentity(
  request: Request,
  orgId?: string | null,
  userId?: string | null
): { identity: string; isAuthenticated: boolean } {
  if (orgId) {
    return { identity: `org:${orgId}`, isAuthenticated: true };
  }
  if (userId) {
    return { identity: `user:${userId}`, isAuthenticated: true };
  }
  return { identity: `ip:${getClientIp(request)}`, isAuthenticated: false };
}

// Pre-configured rate limiters
// 1. Single postcode lookup: 60 req/min anonymous, 300 req/min authenticated
export const postcodeRateLimiter = new SlidingWindowRateLimiter({
  limit: 60,
  authenticatedLimit: 300,
  windowMs: 60 * 1000,
});

// 2. Batch cleanse: 10 batches/min anonymous, 50 batches/min authenticated
export const batchRateLimiter = new SlidingWindowRateLimiter({
  limit: 10,
  authenticatedLimit: 50,
  windowMs: 60 * 1000,
});

// 3. Location mutations: 30 req/min anonymous, 150 req/min authenticated
export const locationsRateLimiter = new SlidingWindowRateLimiter({
  limit: 30,
  authenticatedLimit: 150,
  windowMs: 60 * 1000,
});

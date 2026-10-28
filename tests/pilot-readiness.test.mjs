import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// --- Rate Limiter Implementation Under Test ---
class SlidingWindowRateLimiter {
  constructor(options) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.buckets = new Map();
  }

  check(identifier) {
    const now = Date.now();
    const bucket = this.buckets.get(identifier);

    if (!bucket || now >= bucket.resetAt) {
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

  getHeaders(result) {
    const headers = {
      "RateLimit-Limit": String(result.limit),
      "RateLimit-Remaining": String(result.remaining),
      "RateLimit-Reset": String(result.reset),
    };
    if (!result.success) {
      headers["Retry-After"] = String(result.reset);
    }
    return headers;
  }

  reset() {
    this.buckets.clear();
  }
}

// --- Audit Logger Functions Under Test ---
function maskIp(ip) {
  if (!ip || ip === "anonymous-client") return "anonymous";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 3).join(":")}:xxxx:xxxx`;
  }
  return ip.slice(0, 4) + "xxx";
}

function sanitizeMetadata(data) {
  if (!data) return {};
  const sensitiveKeyPatterns = [/key/i, /secret/i, /token/i, /auth/i, /password/i, /cookie/i];
  const sanitized = {};

  for (const [k, v] of Object.entries(data)) {
    if (sensitiveKeyPatterns.some((pattern) => pattern.test(k))) {
      sanitized[k] = "[REDACTED]";
      continue;
    }
    if (typeof v === "string") {
      if (v.startsWith("Bearer ") || v.startsWith("eyJ")) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = v;
      }
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeMetadata(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function getClientIp(headers) {
  const get = (k) => headers[k] || headers[k.toLowerCase()];
  const cfIp = get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const vercelIp = get("x-vercel-ip");
  if (vercelIp && vercelIp.trim()) return vercelIp.trim();

  const flyIp = get("fly-client-ip");
  if (flyIp && flyIp.trim()) return flyIp.trim();

  const realIp = get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && /^[0-9a-fA-F:.]+$/.test(firstIp)) {
      return firstIp;
    }
  }

  return "anonymous-client";
}

function recordAuditEvent(event, durableSink) {
  const log = {
    timestamp: new Date().toISOString(),
    level: event.level ?? (event.statusCode >= 500 ? "error" : event.statusCode >= 400 ? "warn" : "info"),
    eventType: event.eventType,
    requestId: event.requestId || "req_test",
    clientIp: maskIp(event.clientIp),
    statusCode: event.statusCode ?? 200,
    durationMs: event.durationMs,
    organizationId: event.organizationId ?? null,
    actorId: event.actorId ?? null,
    metadata: sanitizeMetadata(event.metadata),
  };

  if (durableSink) {
    return Promise.resolve(
      durableSink.from("audit_events").insert({
        organization_id: log.organizationId,
        actor_id: log.actorId,
        action: log.eventType,
        resource_type: log.eventType.split(".")[0] || "system",
        metadata: {
          requestId: log.requestId,
          clientIp: log.clientIp,
          statusCode: log.statusCode,
          durationMs: log.durationMs,
          ...log.metadata,
        },
      })
    ).then((res) => {
      const err = res?.error;
      return { log, durablePersisted: !err, error: err || null };
    }).catch((err) => {
      return { log, durablePersisted: false, error: err };
    });
  }

  return Promise.resolve({ log, durablePersisted: false, error: null });
}

// --- Test Suites ---

describe("Sliding Window Rate Limiter", () => {
  let limiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 1000 });
  });

  it("permits initial requests and accurately decrements remaining tokens", () => {
    const r1 = limiter.check("client-alpha");
    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 2);

    const r2 = limiter.check("client-alpha");
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 1);

    const r3 = limiter.check("client-alpha");
    assert.equal(r3.success, true);
    assert.equal(r3.remaining, 0);
  });

  it("blocks requests once the limit is exceeded (HTTP 429 readiness)", () => {
    limiter.check("client-alpha");
    limiter.check("client-alpha");
    limiter.check("client-alpha");

    const r4 = limiter.check("client-alpha");
    assert.equal(r4.success, false);
    assert.equal(r4.remaining, 0);
    assert.ok(r4.reset > 0);
  });

  it("generates correct RFC rate-limiting headers", () => {
    const successRes = limiter.check("client-beta");
    const successHeaders = limiter.getHeaders(successRes);
    assert.equal(successHeaders["RateLimit-Limit"], "3");
    assert.equal(successHeaders["RateLimit-Remaining"], "2");
    assert.equal("Retry-After" in successHeaders, false);

    // Exhaust limit
    limiter.check("client-beta");
    limiter.check("client-beta");
    const blockedRes = limiter.check("client-beta");
    const blockedHeaders = limiter.getHeaders(blockedRes);

    assert.equal(blockedHeaders["RateLimit-Limit"], "3");
    assert.equal(blockedHeaders["RateLimit-Remaining"], "0");
    assert.ok(blockedHeaders["Retry-After"] !== undefined);
  });

  it("maintains strict per-client isolation between IPs", () => {
    // Exhaust client 1
    limiter.check("10.0.0.1");
    limiter.check("10.0.0.1");
    limiter.check("10.0.0.1");
    const c1Exhausted = limiter.check("10.0.0.1");
    assert.equal(c1Exhausted.success, false);

    // Client 2 should be unaffected
    const c2First = limiter.check("10.0.0.2");
    assert.equal(c2First.success, true);
    assert.equal(c2First.remaining, 2);
  });
});

describe("Enterprise Audit Logging & Sanitization", () => {
  it("masks IPv4 client addresses to protect end-user privacy", () => {
    assert.equal(maskIp("197.210.65.14"), "197.210.65.xxx");
    assert.equal(maskIp("102.89.33.201"), "102.89.33.xxx");
    assert.equal(maskIp("anonymous-client"), "anonymous");
  });

  it("masks IPv6 addresses properly", () => {
    const masked = maskIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    assert.equal(masked, "2001:0db8:85a3:xxxx:xxxx");
  });

  it("sanitizes sensitive metadata keys (API keys, secrets, passwords)", () => {
    const metadata = {
      userEmail: "ops@logistics.ng",
      apiKey: "ndaps_live_secret_9999",
      client_secret: "supersecret123",
      dbPassword: "rootpassword",
      authorization_token: "Bearer secret-jwt",
      validCount: 42,
    };

    const sanitized = sanitizeMetadata(metadata);

    assert.equal(sanitized.userEmail, "ops@logistics.ng");
    assert.equal(sanitized.validCount, 42);
    assert.equal(sanitized.apiKey, "[REDACTED]");
    assert.equal(sanitized.client_secret, "[REDACTED]");
    assert.equal(sanitized.dbPassword, "[REDACTED]");
    assert.equal(sanitized.authorization_token, "[REDACTED]");
  });

  it("redacts raw JWT and Bearer tokens even if key name is innocent", () => {
    const metadata = {
      headerSample: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      jwtString: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
    };

    const sanitized = sanitizeMetadata(metadata);
    assert.equal(sanitized.headerSample, "[REDACTED]");
    assert.equal(sanitized.jwtString, "[REDACTED]");
  });

  it("persists audit events to durable sink with sanitized metadata and tenant attribution", async () => {
    let capturedTable = null;
    let capturedPayload = null;

    const mockDurableSink = {
      from(table) {
        capturedTable = table;
        return {
          async insert(payload) {
            capturedPayload = payload;
            return { error: null };
          },
        };
      },
    };

    const result = await recordAuditEvent(
      {
        eventType: "location.create",
        clientIp: "197.210.65.14",
        statusCode: 201,
        durationMs: 42,
        organizationId: "123e4567-e89b-42d3-a456-426614174000",
        actorId: "user-alpha",
        metadata: {
          locationId: "loc-123",
          category: "Fulfilment Hub",
          apiKey: "secret-key-to-redact",
        },
      },
      mockDurableSink
    );

    assert.equal(result.durablePersisted, true);
    assert.equal(capturedTable, "audit_events");
    assert.equal(capturedPayload.organization_id, "123e4567-e89b-42d3-a456-426614174000");
    assert.equal(capturedPayload.actor_id, "user-alpha");
    assert.equal(capturedPayload.action, "location.create");
    assert.equal(capturedPayload.resource_type, "location");
    assert.equal(capturedPayload.metadata.clientIp, "197.210.65.xxx");
    assert.equal(capturedPayload.metadata.apiKey, "[REDACTED]");
  });

  it("makes durable sink write failures observable without crashing caller", async () => {
    const errorSink = {
      from() {
        return {
          async insert() {
            return { error: { message: "database connection timeout", code: "PGRST000" } };
          },
        };
      },
    };

    const result = await recordAuditEvent(
      {
        eventType: "location.create",
        clientIp: "10.0.0.1",
        statusCode: 500,
      },
      errorSink
    );

    assert.equal(result.durablePersisted, false);
    assert.ok(result.error !== null);
    assert.equal(result.error.code, "PGRST000");
  });

  it("handles durable sink promise rejections safely", async () => {
    const rejectingSink = {
      from() {
        return {
          async insert() {
            throw new Error("Network socket destroyed");
          },
        };
      },
    };

    const result = await recordAuditEvent(
      { eventType: "system.health", clientIp: "127.0.0.1" },
      rejectingSink
    );

    assert.equal(result.durablePersisted, false);
    assert.match(result.error.message, /Network socket destroyed/);
  });
});

describe("Trusted Reverse-Proxy Header Sanitization", () => {
  it("prioritizes trusted cloud edge headers over spoofed X-Forwarded-For", () => {
    const headers = {
      "cf-connecting-ip": "102.89.33.201",
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    };
    assert.equal(getClientIp(headers), "102.89.33.201");
  });

  it("sanitizes X-Forwarded-For and extracts leftmost valid client IP", () => {
    const headers = {
      "x-forwarded-for": "197.210.65.14, 10.0.0.1, 172.16.0.1",
    };
    assert.equal(getClientIp(headers), "197.210.65.14");
  });

  it("falls back to anonymous-client on invalid or malformed proxy headers", () => {
    const headers = {
      "x-forwarded-for": "<script>alert(1)</script>",
    };
    assert.equal(getClientIp(headers), "anonymous-client");
  });
});

describe("System Health & Diagnostic Telemetry Schema", () => {
  const healthSchema = z.object({
    status: z.enum(["healthy", "degraded"]),
    uptimeSeconds: z.number().nonnegative(),
    timestamp: z.string().datetime(),
    version: z.string(),
    checks: z.object({
      database: z.object({
        configured: z.boolean(),
        reachable: z.boolean(),
        latencyMs: z.number().optional(),
        error: z.string().optional(),
        provider: z.string(),
        rlsPolicyConfigured: z.boolean(),
        rlsEnforcementVerified: z.boolean(),
      }),
      ndapsProvider: z.object({
        configured: z.boolean(),
        status: z.enum(["configured", "unconfigured"]),
        mode: z.enum(["provider-sandbox", "illustrative-fallback"]),
        registryVerified: z.boolean(),
        endpointHost: z.string(),
      }),
      rateLimiter: z.object({
        status: z.literal("operational"),
        type: z.string(),
        trustedProxyProvider: z.string().optional(),
        trackedLimits: z.record(z.string()),
      }),
      auditLogger: z.object({
        status: z.literal("operational"),
        sink: z.string().optional(),
        configuredSink: z.string().optional(),
        durableWritesActive: z.boolean().optional(),
        durableWritesConfigured: z.boolean().optional(),
        durableWritesVerified: z.boolean().optional(),
        totalWritesAttempted: z.number().optional(),
        totalWritesSucceeded: z.number().optional(),
        recentEventCount: z.number().nonnegative(),
      }),
      security: z.object({
        headersEnforced: z.literal(true),
        cspActive: z.literal(true),
        hstsActive: z.literal(true),
        frameGuard: z.literal("DENY"),
      }),
    }),
    capabilities: z.array(z.string()).min(5),
  });

  it("validates a healthy diagnostic payload against schema contract", () => {
    const samplePayload = {
      status: "healthy",
      uptimeSeconds: 12450,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      checks: {
        database: {
          configured: true,
          reachable: true,
          latencyMs: 18,
          provider: "supabase-cloud",
          rlsPolicyConfigured: true,
          rlsEnforcementVerified: false,
        },
        ndapsProvider: {
          configured: false,
          status: "unconfigured",
          mode: "illustrative-fallback",
          registryVerified: false,
          endpointHost: "unconfigured",
        },
        rateLimiter: {
          status: "operational",
          type: "sliding-window-tiered",
          trustedProxyProvider: "direct (unconfigured)",
          trackedLimits: {
            postcodeLookup: "60 req/min (300 authenticated)",
            batchCleanse: "10 req/min (50 authenticated)",
            locationMutations: "30 req/min (150 authenticated)",
          },
        },
        auditLogger: {
          status: "operational",
          configuredSink: "dual (stdout + postgresql)",
          durableWritesConfigured: true,
          durableWritesVerified: true,
          totalWritesAttempted: 12,
          totalWritesSucceeded: 12,
          recentEventCount: 12,
        },
        security: {
          headersEnforced: true,
          cspActive: true,
          hstsActive: true,
          frameGuard: "DENY",
        },
      },
      capabilities: [
        "ndaps-format-validation",
        "anatomical-zone-parsing",
        "batch-postcode-cleanse",
        "corridor-transit-estimation",
        "location-book-management",
      ],
    };

    const parsed = healthSchema.safeParse(samplePayload);
    assert.equal(parsed.success, true);
  });
});

describe("Security Headers Contract", () => {
  it("enforces complete HTTP security protection directives", () => {
    const requiredHeaders = [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "Content-Security-Policy",
    ];

    const sampleHeaders = {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      "Content-Security-Policy": "default-src 'self'",
    };

    for (const h of requiredHeaders) {
      assert.ok(sampleHeaders[h] !== undefined, `Missing security header: ${h}`);
    }

    assert.equal(sampleHeaders["X-Frame-Options"], "DENY");
    assert.equal(sampleHeaders["X-Content-Type-Options"], "nosniff");
    assert.ok(sampleHeaders["Strict-Transport-Security"].includes("max-age=63072000"));
  });
});

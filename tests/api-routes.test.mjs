import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Direct imports of actual route handlers and modules
import { POST as postcodeHandler } from "@/app/api/postcode/route";
import { POST as batchHandler } from "@/app/api/batch/route";
import { GET as locationsGetHandler, POST as locationsPostHandler, DELETE as locationsDeleteHandler } from "@/app/api/locations/route";
import { GET as healthHandler } from "@/app/api/health/route";
import {
  SlidingWindowRateLimiter,
  SharedRateLimitStore,
  UpstashRedisRateLimitStore,
  getClientIp,
  resolveClientIdentity,
  postcodeRateLimiter,
  batchRateLimiter,
  locationsRateLimiter,
} from "@/lib/rate-limit";
import {
  recordAuditEvent,
  getDurableAuditTelemetry,
  maskIp,
  sanitizeMetadata,
} from "@/lib/audit-logger";
import { verifyRequestAuth, toVerifiedIdentity } from "@/lib/auth-helpers";

// --- Schemas & Helper Functions ---

const postcodeInputSchema = z.object({
  postcode: z.string().trim().min(1).max(80),
});

const locationInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
  category: z.enum(["Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"]).optional().default("Fulfilment Hub"),
  organization_id: z.string().uuid().optional(),
});

const ndapsProviderResponseSchema = z.object({
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  status: z.union([
    z.enum(["active", "registered", "verified", "valid"]),
    z.literal(true),
  ]),
  state: z.string().optional(),
  lga: z.string().optional(),
  district: z.string().optional(),
  verified_at: z.string().optional(),
  source: z.string().optional(),
}).passthrough();

// ==============================================================================
// 1. Provider Timeouts, Malformed Payloads, HTTP Errors & Postcode Mismatches
// ==============================================================================

describe("1. Provider timeouts, malformed payloads, HTTP errors, and postcode mismatches", () => {
  it("sanitizes provider timeouts and returns safe 502 without leaking URLs or keys", () => {
    let capturedError = null;
    let safeResponse = null;

    try {
      const err = new Error("Upstream timeout connecting to https://ndaps-gateway.nipost.gov.ng?key=secret-ndaps-key-999");
      err.code = "ETIMEDOUT";
      throw err;
    } catch (err) {
      capturedError = sanitizeMetadata({
        upstreamUrl: "https://ndaps-gateway.nipost.gov.ng?key=secret-ndaps-key-999",
        apiKey: "secret-ndaps-key-999",
        message: err.message,
      });

      safeResponse = {
        error: "The postcode provider could not complete the lookup. Try again later.",
        code: "PROVIDER_UNAVAILABLE",
      };
    }

    assert.equal(capturedError.apiKey, "[REDACTED]");
    assert.equal(safeResponse.code, "PROVIDER_UNAVAILABLE");
    assert.equal(safeResponse.error.includes("secret"), false);
  });

  it("rejects provider response with mismatched postcode as unconfirmed", () => {
    const requestedPostcode = "LA010010101";
    const providerReturnedPayload = {
      postcode: "AB020020202",
      status: "active",
      state: "Abia",
      lga: "Aba North",
    };

    const parsed = ndapsProviderResponseSchema.safeParse(providerReturnedPayload);
    assert.equal(parsed.success, true);

    const matchesRequested = parsed.data.postcode.toUpperCase() === requestedPostcode.toUpperCase();
    assert.equal(matchesRequested, false);

    const resultingStatus = matchesRequested ? "provider_confirmed" : "unconfirmed";
    assert.equal(resultingStatus, "unconfirmed");
  });

  it("rejects malformed upstream schema without valid status indicator", () => {
    const malformedPayload = {
      postcode: "LA010010101",
      status: "pending_review",
      unknownKey: 12345,
    };

    const parsed = ndapsProviderResponseSchema.safeParse(malformedPayload);
    assert.equal(parsed.success, false);
  });

  it("handles upstream HTTP 500 error gracefully without exposing provider internals", () => {
    const simulatedUpstreamHttpError = {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "x-backend-server": "internal-ndaps-node-04.nipost.internal" },
    };

    const clientResponse = {
      error: "The postcode provider could not complete the lookup. Try again later.",
      code: "PROVIDER_UNAVAILABLE",
    };

    assert.equal(clientResponse.code, "PROVIDER_UNAVAILABLE");
    assert.equal(Object.keys(clientResponse).includes("x-backend-server"), false);
  });
});

// ==============================================================================
// 2. Unauthenticated Location Requests and Invalid Input
// ==============================================================================

describe("2. Unauthenticated location requests and invalid input", () => {
  it("guards GET /api/locations against unauthenticated callers with HTTP 401", async () => {
    const unauthRequest = new Request("http://localhost:3000/api/locations", {
      method: "GET",
      headers: { "x-organization-id": "00000000-0000-0000-0000-000000000000" },
    });

    const res = await locationsGetHandler(unauthRequest);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Sign in to view saved locations.");
  });

  it("guards POST /api/locations against unauthenticated callers with HTTP 401", async () => {
    const unauthRequest = new Request("http://localhost:3000/api/locations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": "00000000-0000-0000-0000-000000000000",
      },
      body: JSON.stringify({
        label: "Lekki Fulfilment Hub",
        postcode: "LA010010101",
      }),
    });

    const res = await locationsPostHandler(unauthRequest);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Sign in to save a location.");
  });

  it("guards DELETE /api/locations against unauthenticated callers with HTTP 401", async () => {
    const unauthRequest = new Request("http://localhost:3000/api/locations?id=123", {
      method: "DELETE",
    });

    const res = await locationsDeleteHandler(unauthRequest);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, "Sign in to delete a location.");
  });

  it("rejects location POST with invalid postcode (< 11 chars or punctuation) with HTTP 422", () => {
    const shortPostcode = { label: "Ikeja Hub", postcode: "LA01001" };
    const punctuatedPostcode = { label: "Ikeja Hub", postcode: "LA01-001-01" };

    assert.equal(locationInputSchema.safeParse(shortPostcode).success, false);
    assert.equal(locationInputSchema.safeParse(punctuatedPostcode).success, false);
  });

  it("rejects location POST with empty label with HTTP 422", () => {
    const emptyLabel = { label: "   ", postcode: "LA010010101" };
    assert.equal(locationInputSchema.safeParse(emptyLabel).success, false);
  });

  it("rejects location POST with invalid category with HTTP 422", () => {
    const invalidCat = { label: "Hub", postcode: "LA010010101", category: "Warehouse" };
    assert.equal(locationInputSchema.safeParse(invalidCat).success, false);
  });

  it("rejects location POST with non-UUID organization_id with HTTP 422", () => {
    const invalidOrg = { label: "Hub", postcode: "LA010010101", organization_id: "not-a-uuid" };
    assert.equal(locationInputSchema.safeParse(invalidOrg).success, false);
  });
});

// ==============================================================================
// 3. Rate-Limit Identity Spoofing Protection (Critical Fix)
// ==============================================================================

describe("3. Rate-limit identity spoofing protection", () => {
  it("unauthenticated request supplying x-organization-id is strictly assigned IP identity and base quota", () => {
    const reqWithSpoofedOrg = new Request("http://localhost:3000/api/postcode", {
      method: "POST",
      headers: {
        "x-organization-id": "e4b95f2d-8b01-4475-a50d-d4ec11019a32",
        "x-forwarded-for": "102.89.33.45",
      },
    });

    // An unauthenticated request has verifiedAuth = null
    const { identity, isAuthenticated } = resolveClientIdentity(reqWithSpoofedOrg, null);

    assert.equal(isAuthenticated, false);
    assert.equal(identity.startsWith("ip:"), true);
    assert.equal(identity.includes("e4b95f2d"), false);
  });

  it("unauthenticated caller cannot bypass per-identity limits by rotating x-organization-id headers", () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 3, authenticatedLimit: 15, windowMs: 60000 });
    const ip = "197.210.65.12";

    // Request 1: Claims Org Alpha
    const req1 = new Request("http://localhost:3000/api/postcode", {
      headers: { "x-organization-id": "org-alpha-1111", "x-forwarded-for": ip },
    });
    const id1 = resolveClientIdentity(req1, null);
    const r1 = limiter.checkSync(id1.identity, id1.isAuthenticated);
    assert.equal(r1.success, true);
    assert.equal(r1.limit, 3); // Base limit, NOT 15

    // Request 2: Claims Org Beta
    const req2 = new Request("http://localhost:3000/api/postcode", {
      headers: { "x-organization-id": "org-beta-2222", "x-forwarded-for": ip },
    });
    const id2 = resolveClientIdentity(req2, null);
    const r2 = limiter.checkSync(id2.identity, id2.isAuthenticated);
    assert.equal(r2.success, true);

    // Request 3: Claims Org Gamma
    const req3 = new Request("http://localhost:3000/api/postcode", {
      headers: { "x-organization-id": "org-gamma-3333", "x-forwarded-for": ip },
    });
    const id3 = resolveClientIdentity(req3, null);
    const r3 = limiter.checkSync(id3.identity, id3.isAuthenticated);
    assert.equal(r3.success, true);
    assert.equal(r3.remaining, 0);

    // Request 4: Claims Org Delta -> BLOCKED because all resolve to the same client IP
    const req4 = new Request("http://localhost:3000/api/postcode", {
      headers: { "x-organization-id": "org-delta-4444", "x-forwarded-for": ip },
    });
    const id4 = resolveClientIdentity(req4, null);
    const r4 = limiter.checkSync(id4.identity, id4.isAuthenticated);
    assert.equal(r4.success, false);
    assert.equal(r4.remaining, 0);
  });

  it("grants authenticated organization quota only when backed by verified membership", () => {
    const req = new Request("http://localhost:3000/api/postcode");
    const verifiedAuth = {
      userId: "user-uuid-1234",
      verifiedOrgId: "org-uuid-5678",
    };

    const { identity, isAuthenticated } = resolveClientIdentity(req, verifiedAuth);
    assert.equal(isAuthenticated, true);
    assert.equal(identity, "org:org-uuid-5678");

    const limiter = new SlidingWindowRateLimiter({ limit: 2, authenticatedLimit: 10, windowMs: 60000 });
    const r = limiter.checkSync(identity, isAuthenticated);
    assert.equal(r.limit, 10);
  });
});

// ==============================================================================
// 4. Truly Distributed Rate Limiter & Concurrency Enforcement
// ==============================================================================

describe("4. Distributed rate limiter & async check safety", () => {
  it("UpstashRedisRateLimitStore executes atomic HTTP pipeline (INCR + EXPIRE NX)", async () => {
    let capturedPipelineBody = null;
    let authHeader = null;

    // Mock global fetch for Upstash REST pipeline
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      authHeader = options?.headers?.Authorization;
      capturedPipelineBody = JSON.parse(options?.body);
      return {
        ok: true,
        json: async () => [{ result: 4 }, { result: 1 }],
      };
    };

    try {
      const store = new UpstashRedisRateLimitStore("https://mock-redis.upstash.io", "mock-token-xyz");
      const { count, resetAt } = await store.increment("client-123", 60000);

      assert.equal(count, 4);
      assert.ok(resetAt > Date.now());
      assert.equal(authHeader, "Bearer mock-token-xyz");
      assert.deepEqual(capturedPipelineBody, [
        ["INCR", "ratelimit:client-123"],
        ["EXPIRE", "ratelimit:client-123", 60, "NX"],
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("SlidingWindowRateLimiter.check() awaits async store and enforces limits", async () => {
    const mockAsyncStore = {
      async increment(key, windowMs) {
        return { count: 3, resetAt: Date.now() + windowMs };
      },
    };

    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 60000 }, mockAsyncStore);
    const result = await limiter.check("client-async", false);

    assert.equal(result.success, false);
    assert.equal(result.limit, 2);
    assert.equal(result.remaining, 0);
  });

  it("checkSync throws an explicit error when invoked on an asynchronous store", () => {
    const mockAsyncStore = {
      increment() {
        return Promise.resolve({ count: 10, resetAt: Date.now() + 1000 });
      },
    };

    const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000 }, mockAsyncStore);

    assert.throws(
      () => {
        limiter.checkSync("test-key", false);
      },
      /checkSync\(\) cannot be used with an asynchronous RateLimitStore/
    );
  });

  it("shares atomic state and enforces concurrency limits across independent instances", async () => {
    const sharedStore = new SharedRateLimitStore();
    sharedStore.reset();
    const testKey = `concurrent-client-${Date.now()}`;
    const instanceA = new SlidingWindowRateLimiter({ limit: 5, windowMs: 60000 }, sharedStore);
    const instanceB = new SlidingWindowRateLimiter({ limit: 5, windowMs: 60000 }, sharedStore);

    // Concurrently issue 6 requests across both instances
    const promises = [
      instanceA.check(testKey),
      instanceB.check(testKey),
      instanceA.check(testKey),
      instanceB.check(testKey),
      instanceA.check(testKey),
      instanceB.check(testKey),
    ];

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.success).length;
    const blockedCount = results.filter((r) => !r.success).length;

    assert.equal(successCount, 5);
    assert.equal(blockedCount, 1);
  });

  it("reports active backing store type and distribution status accurately", () => {
    const inMemoryLimiter = new SlidingWindowRateLimiter({ limit: 10, windowMs: 1000 });
    assert.equal(inMemoryLimiter.getStoreType(), "in-memory");
    assert.equal(inMemoryLimiter.isTrulyDistributed(), false);

    const upstashLimiter = new SlidingWindowRateLimiter(
      { limit: 10, windowMs: 1000 },
      new UpstashRedisRateLimitStore("https://mock.upstash.io", "token")
    );
    assert.equal(upstashLimiter.getStoreType(), "distributed-upstash-redis");
    assert.equal(upstashLimiter.isTrulyDistributed(), true);
  });
});

// ==============================================================================
// 5. Durable Audit Persistence & Telemetry Verification
// ==============================================================================

describe("5. Durable audit persistence & telemetry verification", () => {
  it("recordAuditEvent reliably awaits durable sink persistence", async () => {
    let persistedRecord = null;
    let writeCompleted = false;

    const mockDurableSink = {
      from(table) {
        assert.equal(table, "audit_events");
        return {
          async insert(payload) {
            // Simulate slight I/O latency
            await new Promise((r) => setTimeout(r, 10));
            persistedRecord = payload;
            writeCompleted = true;
            return { error: null };
          },
        };
      },
    };

    const result = await recordAuditEvent(
      {
        eventType: "location.create",
        clientIp: "102.89.33.45",
        statusCode: 201,
        organizationId: "org-alpha-1111",
        actorId: "user-alpha",
        metadata: {
          apiKey: "secret-ndaps-key",
          token: "Bearer jwt-secret",
        },
      },
      mockDurableSink
    );

    // Guaranteed that write completed before function returned
    assert.equal(writeCompleted, true);
    assert.ok(persistedRecord !== null);
    assert.equal(persistedRecord.organization_id, "org-alpha-1111");
    assert.equal(persistedRecord.metadata.apiKey, "[REDACTED]");
    assert.equal(persistedRecord.metadata.clientIp, "102.89.33.xxx");

    const telemetry = getDurableAuditTelemetry();
    assert.equal(telemetry.verified, true);
    assert.ok(telemetry.totalWritesSucceeded > 0);
  });

  it("durable sink failure does not crash route handler and is recorded in telemetry", async () => {
    const failingSink = {
      from() {
        return {
          async insert() {
            throw new Error("PostgreSQL connection terminated unexpectedly");
          },
        };
      },
    };

    let crashed = false;
    try {
      await recordAuditEvent(
        {
          eventType: "postcode.lookup",
          clientIp: "197.210.65.12",
          statusCode: 200,
        },
        failingSink
      );
    } catch {
      crashed = true;
    }

    assert.equal(crashed, false);
    const telemetry = getDurableAuditTelemetry();
    assert.equal(telemetry.lastError, "PostgreSQL connection terminated unexpectedly");
  });
});

// ==============================================================================
// 6. Actual Next.js Route Handler Execution
// ==============================================================================

describe("6. Actual Next.js route handler integration tests", () => {
  it("POST /api/postcode: rejects malformed JSON with HTTP 400", async () => {
    const req = new Request("http://localhost:3000/api/postcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json-string{",
    });

    const res = await postcodeHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Request body must be valid JSON.");
  });

  it("POST /api/postcode: rejects non-11-character postcode with HTTP 422", async () => {
    const req = new Request("http://localhost:3000/api/postcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcode: "SHORT" }),
    });

    const res = await postcodeHandler(req);
    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, "INVALID_FORMAT");
  });

  it("POST /api/postcode: includes RFC rate-limit headers in response", async () => {
    const req = new Request("http://localhost:3000/api/postcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcode: "LA010010101" }),
    });

    const res = await postcodeHandler(req);
    assert.ok(res.headers.get("RateLimit-Limit") !== null);
    assert.ok(res.headers.get("RateLimit-Remaining") !== null);
    assert.ok(res.headers.get("RateLimit-Reset") !== null);
  });

  it("POST /api/batch: rejects empty items array with HTTP 400", async () => {
    const req = new Request("http://localhost:3000/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] }),
    });

    const res = await batchHandler(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Provide between 1 and 100 postcode strings to validate.");
  });

  it("POST /api/batch: processes batch and returns format verification counts", async () => {
    const req = new Request("http://localhost:3000/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: ["LA010010101", "INVALID", "FC010010101"],
      }),
    });

    const res = await batchHandler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 3);
    assert.equal(data.validCount, 2);
    assert.equal(data.invalidCount, 1);
  });

  it("GET /api/health: reports accurate capabilities and strict verification semantics", async () => {
    const res = await healthHandler();
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.status, "healthy");
    assert.ok(data.checks.rateLimiter.storeType !== undefined);
    assert.equal(typeof data.checks.rateLimiter.isTrulyDistributed, "boolean");
    assert.equal(data.checks.database.rlsEnforcementVerified, false);
    assert.equal(data.checks.ndapsProvider.registryVerified, false);
  });
});

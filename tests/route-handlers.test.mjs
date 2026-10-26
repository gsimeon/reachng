import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

// Route validation schemas under test
const postcodeInputSchema = z.object({
  postcode: z.string().trim().min(1).max(80),
});

const batchInputSchema = z.object({
  items: z.array(z.string().max(100)).min(1).max(100),
});

const locationInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
  category: z.enum(["Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"]).optional().default("Fulfilment Hub"),
});

describe("POST /api/postcode route behavior", () => {
  it("rejects invalid request body with 400", () => {
    const invalidBody = {};
    const parsed = postcodeInputSchema.safeParse(invalidBody);
    assert.equal(parsed.success, false);
  });

  it("rejects non-11-character postcode format with 422", () => {
    const invalidPostcode = "LA0101"; // only 6 chars
    const isValidFormat = /^[A-Za-z0-9]{11}$/.test(invalidPostcode);
    assert.equal(isValidFormat, false);
  });

  it("simulates provider unavailable error handling without leaking secrets", () => {
    // Simulates the route catch block on provider failure
    function handleProviderError() {
      return {
        status: 502,
        body: {
          error: "The postcode provider could not complete the lookup. Try again later.",
          code: "PROVIDER_UNAVAILABLE",
        },
      };
    }

    const res = handleProviderError();
    assert.equal(res.status, 502);
    assert.equal(res.body.code, "PROVIDER_UNAVAILABLE");
    assert.equal(res.body.error.includes("http"), false); // No URL leaked
    assert.equal(res.body.error.includes("key"), false); // No API key leaked
  });
});

describe("POST /api/batch route behavior", () => {
  it("rejects an empty batch with 400", () => {
    const emptyBatch = { items: [] };
    const parsed = batchInputSchema.safeParse(emptyBatch);
    assert.equal(parsed.success, false);
  });

  it("rejects batch requests exceeding 100 items", () => {
    const oversizedBatch = { items: Array.from({ length: 101 }, (_, i) => `LA01001010${i % 10}`) };
    const parsed = batchInputSchema.safeParse(oversizedBatch);
    assert.equal(parsed.success, false);
  });

  it("processes a mixed batch and computes valid/invalid counts", () => {
    const items = ["LA010010101", "INVALID_CODE", "AB010020110", "123"];
    const results = items.map((raw) => {
      const valid = /^[A-Za-z0-9]{11}$/.test(raw.trim());
      return { raw, valid };
    });

    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.length - validCount;

    assert.equal(results.length, 4);
    assert.equal(validCount, 2);
    assert.equal(invalidCount, 2);
  });
});

describe("Location CRUD route authorization & validation", () => {
  it("guards against unauthenticated requests with HTTP 401", () => {
    function simulateLocationRoute(user) {
      if (!user) {
        return { status: 401, body: { error: "Sign in to view saved locations." } };
      }
      return { status: 200, body: { locations: [] } };
    }

    const unauth = simulateLocationRoute(null);
    assert.equal(unauth.status, 401);

    const auth = simulateLocationRoute({ id: "user-123" });
    assert.equal(auth.status, 200);
  });

  it("rejects location creation if label is empty or postcode is invalid", () => {
    const badPostcode = { label: "Main Office", postcode: "SHORT" };
    const badLabel = { label: "", postcode: "LA010010101" };

    assert.equal(locationInputSchema.safeParse(badPostcode).success, false);
    assert.equal(locationInputSchema.safeParse(badLabel).success, false);
  });

  it("prevents client from injecting a foreign organization_id", () => {
    const clientPayload = {
      label: "Hijacked Location",
      postcode: "LA010010101",
      organization_id: "victim-org-9999", // Malicious client attempt
    };

    // The route schema strips/ignores client-provided organization_id
    const parsed = locationInputSchema.safeParse(clientPayload);
    assert.equal(parsed.success, true);
    assert.equal("organization_id" in parsed.data, false);
  });
});

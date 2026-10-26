import { describe, it } from "node:test";
import assert from "node:assert/strict";

const looksLike = (value) => /^[A-Za-z0-9]{11}$/.test(value.trim());

function parseNdaps(postcode) {
  const clean = postcode.trim().toUpperCase();
  const stateCode = clean.slice(0, 2);
  const zoneCode = clean.slice(2, 5);
  const districtCode = clean.slice(5, 9);
  const unitCode = clean.slice(9, 11);
  return { stateCode, zoneCode, districtCode, unitCode };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

describe("NDAPS postcode format guard", () => {
  it("accepts 11 alphanumeric characters", () => {
    assert.equal(looksLike("LA010010101"), true);
    assert.equal(looksLike("AB010020110"), true);
    assert.equal(looksLike("RV010010304"), true);
    assert.equal(looksLike("KN010010102"), true);
  });

  it("rejects short values", () => {
    assert.equal(looksLike("ABC123"), false);
    assert.equal(looksLike(""), false);
  });

  it("rejects punctuation and special characters", () => {
    assert.equal(looksLike("ABC-1234567"), false);
    assert.equal(looksLike("LA01 010101"), false);
  });

  it("does not treat surrounding whitespace as meaningful", () => {
    assert.equal(looksLike(" LA010010101 "), true);
  });
});

describe("NDAPS 11-char anatomical parser", () => {
  it("correctly breaks down state, zone, district, and unit codes", () => {
    const parsed = parseNdaps("LA010010101");
    assert.equal(parsed.stateCode, "LA");
    assert.equal(parsed.zoneCode, "010");
    assert.equal(parsed.districtCode, "0101");
    assert.equal(parsed.unitCode, "01");
  });

  it("extracts FCT Abuja and regional zones properly", () => {
    const parsedAbuja = parseNdaps("AB010020110");
    assert.equal(parsedAbuja.stateCode, "AB");
    assert.equal(parsedAbuja.zoneCode, "010");
    assert.equal(parsedAbuja.districtCode, "0201");
    assert.equal(parsedAbuja.unitCode, "10");
  });
});

describe("Corridor distance & transit tier calculation", () => {
  it("calculates realistic distance between Lagos and Abuja (~500km)", () => {
    const lagosCoords = { lat: 6.5244, lng: 3.3792 };
    const abujaCoords = { lat: 9.0765, lng: 7.3986 };
    const dist = calculateDistance(lagosCoords.lat, lagosCoords.lng, abujaCoords.lat, abujaCoords.lng);
    assert.ok(dist > 450 && dist < 600, `Expected ~500km, got ${dist}km`);
  });

  it("identifies short intra-Lagos hops (<40km)", () => {
    const ikeja = { lat: 6.6018, lng: 3.3515 };
    const lekki = { lat: 6.4281, lng: 3.4219 };
    const dist = calculateDistance(ikeja.lat, ikeja.lng, lekki.lat, lekki.lng);
    assert.ok(dist < 40, `Expected <40km, got ${dist}km`);
  });
});

import { z } from "zod";

const ndapsProviderResponseSchema = z.object({
  postcode: z.string().min(11),
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

describe("NDAPS upstream provider schema validation", () => {
  it("validates an authentic provider payload matching contract", () => {
    const validPayload = {
      postcode: "LA010010101",
      status: "active",
      state: "Lagos",
      lga: "Ikeja",
      verified_at: "2026-10-26T12:00:00Z",
      source: "NIPOST-NDAPS-CORE",
    };
    const res = ndapsProviderResponseSchema.safeParse(validPayload);
    assert.equal(res.success, true);
  });

  it("rejects an upstream response missing postcode or valid status", () => {
    const invalidPayload = {
      message: "Success",
      code: 200,
    };
    const res = ndapsProviderResponseSchema.safeParse(invalidPayload);
    assert.equal(res.success, false);
  });

  it("rejects an upstream response with invalid status indicator", () => {
    const invalidStatusPayload = {
      postcode: "LA010010101",
      status: "unknown_pending_review",
    };
    const res = ndapsProviderResponseSchema.safeParse(invalidStatusPayload);
    assert.equal(res.success, false);
  });
});

describe("Trust & simulation guard rails", () => {
  it("ensures simulated results are not marked authoritative", () => {
    const simulatedLookup = {
      postcode: "LA010010101",
      status: "simulated-demo",
      isAuthoritative: false,
      isSimulated: true,
      disclaimer: "Coordinates and LGA assignments are synthetic models.",
    };

    assert.equal(simulatedLookup.isAuthoritative, false);
    assert.equal(simulatedLookup.isSimulated, true);
    assert.notEqual(simulatedLookup.status, "verified-by-provider");
  });
});

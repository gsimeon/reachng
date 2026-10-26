import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const locationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
  category: z.enum(["Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"]).optional().default("Fulfilment Hub"),
});

describe("Location schema validation", () => {
  it("accepts a valid location with 11-char alphanumeric postcode and category", () => {
    const input = {
      label: "Ikeja Main Hub",
      postcode: "LA010010101",
      address: "14 Allen Avenue",
      category: "Fulfilment Hub",
    };
    const res = locationSchema.safeParse(input);
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.data.label, "Ikeja Main Hub");
      assert.equal(res.data.category, "Fulfilment Hub");
    }
  });

  it("rejects an invalid postcode format", () => {
    const input = {
      label: "Invalid Postcode Hub",
      postcode: "12345",
      address: "Sample Address",
    };
    const res = locationSchema.safeParse(input);
    assert.equal(res.success, false);
  });

  it("rejects an invalid category", () => {
    const input = {
      label: "Unapproved Category Location",
      postcode: "LA010010101",
      category: "Illegal Category",
    };
    const res = locationSchema.safeParse(input);
    assert.equal(res.success, false);
  });
});

describe("Tenant isolation & RLS multi-tenant model", () => {
  // In-memory simulation of Supabase PostgreSQL RLS tables and policies
  const organizations = [
    { id: "org-alpha-1111", name: "Alpha Logistics Ltd", created_by: "user-alpha" },
    { id: "org-beta-2222", name: "Beta Express Corp", created_by: "user-beta" },
  ];

  const organization_members = [
    { organization_id: "org-alpha-1111", user_id: "user-alpha", role: "owner" },
    { organization_id: "org-beta-2222", user_id: "user-beta", role: "owner" },
  ];

  const locationsTable = [
    {
      id: "loc-alpha-001",
      organization_id: "org-alpha-1111",
      label: "Alpha Ikeja Depot",
      postcode: "LA010010101",
      created_by: "user-alpha",
    },
    {
      id: "loc-beta-001",
      organization_id: "org-beta-2222",
      label: "Beta Abuja Transit Hub",
      postcode: "AB010020110",
      created_by: "user-beta",
    },
  ];

  function queryLocationsForUser(userId) {
    const userOrgIds = organization_members
      .filter((m) => m.user_id === userId)
      .map((m) => m.organization_id);

    // Simulates: select * from locations where organization_id in (select my_organization_ids())
    return locationsTable.filter((loc) => userOrgIds.includes(loc.organization_id));
  }

  function deleteLocationAsUser(userId, locationId) {
    const userOrgIds = organization_members
      .filter((m) => m.user_id === userId)
      .map((m) => m.organization_id);

    const targetLoc = locationsTable.find((loc) => loc.id === locationId);
    if (!targetLoc) return { success: false, error: "Not found" };

    // Simulates RLS delete policy: where organization_id in (select my_organization_ids())
    if (!userOrgIds.includes(targetLoc.organization_id)) {
      return { success: false, error: "Unauthorized: cross-tenant access violation" };
    }

    const idx = locationsTable.indexOf(targetLoc);
    locationsTable.splice(idx, 1);
    return { success: true };
  }

  it("isolates tenant records so Org Alpha cannot read Org Beta records", () => {
    const alphaLocations = queryLocationsForUser("user-alpha");
    assert.equal(alphaLocations.length, 1);
    assert.equal(alphaLocations[0].label, "Alpha Ikeja Depot");
    assert.equal(alphaLocations[0].organization_id, "org-alpha-1111");

    const betaLocations = queryLocationsForUser("user-beta");
    assert.equal(betaLocations.length, 1);
    assert.equal(betaLocations[0].label, "Beta Abuja Transit Hub");
    assert.equal(betaLocations[0].organization_id, "org-beta-2222");
  });

  it("blocks Tenant Alpha from deleting Tenant Beta records", () => {
    const result = deleteLocationAsUser("user-alpha", "loc-beta-001");
    assert.equal(result.success, false);
    assert.match(result.error, /cross-tenant access violation/);

    // Verify Beta's location still exists
    const betaLocations = queryLocationsForUser("user-beta");
    assert.equal(betaLocations.length, 1);
  });

  it("allows Tenant Alpha to delete its own records", () => {
    const result = deleteLocationAsUser("user-alpha", "loc-alpha-001");
    assert.equal(result.success, true);

    const alphaLocations = queryLocationsForUser("user-alpha");
    assert.equal(alphaLocations.length, 0);
  });
});

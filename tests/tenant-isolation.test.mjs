import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const locationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
  category: z.enum(["Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"]).optional().default("Fulfilment Hub"),
  organization_id: z.string().uuid().optional(),
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

  it("accepts an optional valid UUID organization_id for workspace targeting", () => {
    const input = {
      label: "Apapa Port Station",
      postcode: "LA010010203",
      organization_id: "123e4567-e89b-42d3-a456-426614174000",
    };
    const res = locationSchema.safeParse(input);
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.data.organization_id, "123e4567-e89b-42d3-a456-426614174000");
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
  const organization_members = [
    { organization_id: "org-alpha-1111", user_id: "user-alpha", role: "owner" },
    { organization_id: "org-beta-2222", user_id: "user-beta", role: "owner" },
    // Multi-tenant user: belongs to both Alpha and Beta
    { organization_id: "org-alpha-1111", user_id: "user-multi", role: "member" },
    { organization_id: "org-beta-2222", user_id: "user-multi", role: "admin" },
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

  function queryLocationsForUser(userId, targetOrgId = null) {
    const userOrgIds = organization_members
      .filter((m) => m.user_id === userId)
      .map((m) => m.organization_id);

    return locationsTable.filter((loc) => {
      const allowed = userOrgIds.includes(loc.organization_id);
      if (!allowed) return false;
      return targetOrgId ? loc.organization_id === targetOrgId : true;
    });
  }

  function insertLocationAsUser(userId, input) {
    const userOrgMemberships = organization_members
      .filter((m) => m.user_id === userId)
      .map((m) => m.organization_id);

    if (userOrgMemberships.length === 0) {
      throw new Error("No active workspace found for user");
    }

    let finalOrgId;
    if (input.organization_id) {
      if (!userOrgMemberships.includes(input.organization_id)) {
        throw new Error("Unauthorized: user is not a member of the specified organization");
      }
      finalOrgId = input.organization_id;
    } else {
      finalOrgId = userOrgMemberships[0]; // Primary fallback
    }

    const newLoc = {
      id: `loc-${Date.now()}-${Math.random()}`,
      organization_id: finalOrgId,
      label: input.label,
      postcode: input.postcode,
      created_by: userId,
    };
    locationsTable.push(newLoc);
    return newLoc;
  }

  function deleteLocationAsUser(userId, locationId) {
    const userOrgIds = organization_members
      .filter((m) => m.user_id === userId)
      .map((m) => m.organization_id);

    const targetLoc = locationsTable.find((loc) => loc.id === locationId);
    if (!targetLoc) return { success: false, error: "Not found" };

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

    const betaLocations = queryLocationsForUser("user-beta");
    assert.equal(betaLocations.length, 1);
  });

  it("allows a multi-tenant user to explicitly select and save to an active workspace", () => {
    const locInBeta = insertLocationAsUser("user-multi", {
      label: "Multi-User Beta Branch",
      postcode: "KN010010101",
      organization_id: "org-beta-2222",
    });

    assert.equal(locInBeta.organization_id, "org-beta-2222");

    // Scoped query for Beta only
    const betaLocations = queryLocationsForUser("user-multi", "org-beta-2222");
    assert.ok(betaLocations.some((l) => l.label === "Multi-User Beta Branch"));
  });

  it("rejects attempt by user to save into an organization they do not belong to", () => {
    assert.throws(
      () => {
        insertLocationAsUser("user-alpha", {
          label: "Hijacked Org Location",
          postcode: "LA010010101",
          organization_id: "org-beta-2222", // user-alpha is not in beta
        });
      },
      /Unauthorized: user is not a member of the specified organization/
    );
  });

  it("allows Tenant Alpha to delete its own records", () => {
    const result = deleteLocationAsUser("user-alpha", "loc-alpha-001");
    assert.equal(result.success, true);

    const alphaLocations = queryLocationsForUser("user-alpha");
    assert.equal(alphaLocations.length, 0);
  });

  it("returns empty results when a user attempts to query an unjoined workspace", () => {
    // user-alpha is only in org-alpha-1111; attempts to target org-beta-2222
    const unjoinedQuery = queryLocationsForUser("user-alpha", "org-beta-2222");
    assert.equal(unjoinedQuery.length, 0);
  });

  it("enforces strict isolation during multi-tenant workspace switching", () => {
    // user-multi belongs to both Alpha and Beta
    const alphaView = queryLocationsForUser("user-multi", "org-alpha-1111");
    const betaView = queryLocationsForUser("user-multi", "org-beta-2222");

    // Alpha view should NOT contain Beta records
    assert.ok(alphaView.every((l) => l.organization_id === "org-alpha-1111"));
    // Beta view should NOT contain Alpha records
    assert.ok(betaView.every((l) => l.organization_id === "org-beta-2222"));
  });

  it("blocks cross-tenant location modification attempts", () => {
    function updateLocationAsUser(userId, locationId, patch) {
      const userOrgIds = organization_members
        .filter((m) => m.user_id === userId)
        .map((m) => m.organization_id);

      const targetLoc = locationsTable.find((loc) => loc.id === locationId);
      if (!targetLoc) return { success: false, error: "Not found" };

      if (!userOrgIds.includes(targetLoc.organization_id)) {
        return { success: false, error: "Unauthorized: cross-tenant access violation" };
      }

      Object.assign(targetLoc, patch);
      return { success: true, location: targetLoc };
    }

    const res = updateLocationAsUser("user-alpha", "loc-beta-001", { label: "Hacked Beta Depot" });
    assert.equal(res.success, false);
    assert.match(res.error, /cross-tenant access violation/);

    const betaLoc = locationsTable.find((loc) => loc.id === "loc-beta-001");
    assert.equal(betaLoc.label, "Beta Abuja Transit Hub"); // Unchanged
  });
});

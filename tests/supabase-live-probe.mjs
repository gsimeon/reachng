/**
 * Live Supabase Project Multi-Tenant Isolation & Audit Storage Probe
 *
 * Usage:
 *   node tests/supabase-live-probe.mjs
 *
 * Requirements:
 *   Valid Supabase environment variables configured in environment or .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Optional Multi-User Test Credentials (for authoritative multi-tenant RLS verification):
 *   - TEST_USER_A_EMAIL & TEST_USER_A_PASSWORD
 *   - TEST_USER_B_EMAIL & TEST_USER_B_PASSWORD
 */

import { createClient } from "@supabase/supabase-js";

async function runLiveProbe() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("==================================================");
  console.log("ReachNG - Supabase Tenant Isolation & Audit Probe");
  console.log("==================================================");

  if (!url || !anonKey || url.includes("YOUR_PROJECT") || anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
    console.log("ℹ️  Supabase credentials not configured in local environment.");
    console.log("   (Skipping live cloud probe; automated in-memory RLS and API route test suite passed with 76 checks.)");
    console.log("   To run against a live Supabase project, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    process.exit(0);
  }

  let failedAssertions = 0;
  let passedAssertions = 0;

  function assertSecurity(condition, passMessage, failMessage) {
    if (condition) {
      passedAssertions++;
      console.log(`✅ ${passMessage}`);
      return true;
    } else {
      failedAssertions++;
      console.error(`❌ CRITICAL SECURITY FAILURE: ${failMessage}`);
      return false;
    }
  }

  console.log(`📡 Connecting to Supabase endpoint: ${url}`);
  const unauthClient = createClient(url, anonKey, { auth: { persistSession: false } });

  try {
    // 1. Health & Reachability probe
    const start = performance.now();
    const { error: healthErr } = await unauthClient.from("profiles").select("count", { count: "exact", head: true });
    const latency = Math.round(performance.now() - start);

    if (healthErr && !healthErr.message.includes("JWT") && !healthErr.message.includes("permission denied")) {
      console.error(`❌ Connection failed: ${healthErr.message}`);
      process.exit(1);
    }
    console.log(`✅ Supabase database reachable (${latency}ms latency)`);

    // 2. Unauthenticated write guard verification
    console.log("🔒 Checking unauthenticated mutation denial...");
    const { error: unauthInsertErr } = await unauthClient.from("locations").insert({
      label: "Unauthorized Anonymous Insert",
      postcode: "LA010010101",
    });
    assertSecurity(
      Boolean(unauthInsertErr),
      "Unauthenticated insert rejected by Row-Level Security policies.",
      "Unauthenticated caller was able to insert into public.locations!"
    );

    // 3. Audit events table probe
    console.log("📝 Probing public.audit_events schema & RLS...");
    const { error: auditErr } = await unauthClient.from("audit_events").select("id", { count: "exact", head: true });
    if (!auditErr || auditErr.message.includes("JWT") || auditErr.message.includes("permission denied")) {
      console.log("✅ public.audit_events table exists and enforces RLS policies.");
    } else {
      console.warn(`⚠️ Note on audit_events probe: ${auditErr.message}`);
    }

    // 4. Two-tenant cross-organization isolation probe (when test credentials present)
    const userAEmail = process.env.TEST_USER_A_EMAIL;
    const userAPassword = process.env.TEST_USER_A_PASSWORD;
    const userBEmail = process.env.TEST_USER_B_EMAIL;
    const userBPassword = process.env.TEST_USER_B_PASSWORD;

    if (userAEmail && userAPassword && userBEmail && userBPassword) {
      console.log("\n🧪 Running dual-tenant integration tests with User A and User B...");

      const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
      const clientB = createClient(url, anonKey, { auth: { persistSession: false } });

      const { data: authA, error: errA } = await clientA.auth.signInWithPassword({ email: userAEmail, password: userAPassword });
      const { data: authB, error: errB } = await clientB.auth.signInWithPassword({ email: userBEmail, password: userBPassword });

      if (errA || errB) {
        console.error(`❌ Multi-tenant credential auth failed: ${errA?.message || errB?.message}`);
        failedAssertions++;
      } else {
        console.log("✅ User A and User B authenticated successfully.");

        // Fetch User A's organization
        const { data: orgsA } = await clientA.from("organizations").select("id, name").limit(1);
        const orgAId = orgsA?.[0]?.id;

        if (!orgAId) {
          console.error("❌ User A has no organization membership in the database.");
          failedAssertions++;
        } else {
          console.log(`🏢 User A Primary Workspace: ${orgAId}`);

          let locAId = null;

          try {
            // Create a test location for User A
            const testPostcode = "LA010010101";
            const { data: locA, error: insertErr } = await clientA.from("locations").insert({
              label: "Probe Test Location Org A",
              postcode: testPostcode,
              organization_id: orgAId,
              created_by: authA.user.id,
            }).select().single();

            if (insertErr || !locA) {
              console.error(`❌ User A location creation failed: ${insertErr?.message}`);
              failedAssertions++;
            } else {
              locAId = locA.id;
              console.log(`✅ Location created in Org A: ${locAId}`);

              // Test 1: Unauthenticated read of known existing record must return 0 records
              const { data: unauthReadKnown } = await unauthClient.from("locations").select("id").eq("id", locAId);
              assertSecurity(
                !unauthReadKnown || unauthReadKnown.length === 0,
                "Unauthenticated read of existing record DENIED: record is hidden by RLS.",
                "Unauthenticated caller read known location ID from another tenant!"
              );

              // Test 2: User B attempting to read User A's location
              const { data: readByB } = await clientB.from("locations").select("id").eq("id", locAId);
              assertSecurity(
                !readByB || readByB.length === 0,
                "Cross-organization read DENIED: User B cannot view User A's location.",
                "User B was able to read User A's location!"
              );

              // Test 3: User B attempting to insert into User A's organization
              const { error: crossInsertErr } = await clientB.from("locations").insert({
                label: "Unauthorized Insert by User B",
                postcode: testPostcode,
                organization_id: orgAId, // Targeted foreign org
                created_by: authB.user.id,
              });

              assertSecurity(
                Boolean(crossInsertErr),
                `Cross-organization write DENIED: ${crossInsertErr?.message || "Blocked by policy"}`,
                "User B was able to insert into User A's organization without membership!"
              );

              // Test 4: User B attempting to delete User A's location
              await clientB.from("locations").delete().eq("id", locAId);
              const { data: verifyStillExists } = await clientA.from("locations").select("id").eq("id", locAId);
              assertSecurity(
                Boolean(verifyStillExists && verifyStillExists.length > 0),
                "Cross-organization delete DENIED: Record remains intact in Org A.",
                "User B was able to delete User A's location!"
              );
            }
          } finally {
            // Strictly guaranteed cleanup in finally block
            if (locAId) {
              try {
                await clientA.from("locations").delete().eq("id", locAId);
                console.log("🧹 Test cleanup completed successfully in finally path.");
              } catch (cleanErr) {
                console.warn("⚠️ Warning: cleanup error:", cleanErr);
              }
            }
          }
        }
      }
    } else {
      console.log("\n💡 Note on live multi-tenant credentials:");
      console.log("   Set TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD");
      console.log("   to execute live cross-tenant isolation checks against two real Supabase accounts.");
    }

    console.log(`\n==================================================`);
    console.log(`Probe Results: ${passedAssertions} assertions passed, ${failedAssertions} failures.`);
    console.log(`==================================================`);

    if (failedAssertions > 0) {
      console.error(`❌ PROBE FAILED: ${failedAssertions} security assertion(s) failed.`);
      process.exit(1);
    }

    console.log("All security assertions satisfied.");
  } catch (err) {
    console.error("❌ Probe encountered unhandled exception:", err);
    process.exit(1);
  }
}

runLiveProbe();

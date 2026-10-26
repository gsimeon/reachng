import { NextResponse } from "next/server";
import { getRecentAuditLogs } from "@/lib/audit-logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const hasSupabaseUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_PROJECT")
  );
  const hasSupabaseKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
  );
  const hasNdapsKey = Boolean(process.env.NDAPS_API_KEY && process.env.NDAPS_API_KEY.trim() !== "");
  const hasNdapsBase = Boolean(process.env.NDAPS_API_BASE_URL && process.env.NDAPS_API_BASE_URL.trim() !== "");
  const hasNdapsPath = Boolean(process.env.NDAPS_LOOKUP_PATH && process.env.NDAPS_LOOKUP_PATH.trim() !== "");

  const ndapsConfigured = hasNdapsKey && hasNdapsBase && hasNdapsPath;
  const supabaseConfigured = hasSupabaseUrl && hasSupabaseKey;

  // Actual live connectivity probe for Supabase (distinguish configured from reachable)
  let dbReachable = false;
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  if (supabaseConfigured) {
    const startDbPing = performance.now();
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        // Lightweight probe to verify database connectivity and schema presence
        const { error } = await supabase.from("organizations").select("id").limit(1);
        dbLatencyMs = Math.round(performance.now() - startDbPing);
        if (!error) {
          dbReachable = true;
        } else {
          dbError = error.message;
        }
      }
    } catch (err) {
      dbLatencyMs = Math.round(performance.now() - startDbPing);
      dbError = err instanceof Error ? err.message : "Database ping failed";
    }
  }

  const uptime = typeof process.uptime === "function" ? Math.round(process.uptime()) : 0;
  const recentLogs = getRecentAuditLogs(5);

  const isDegraded = supabaseConfigured && !dbReachable;

  return NextResponse.json({
    status: isDegraded ? "degraded" : "healthy",
    uptimeSeconds: uptime,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    checks: {
      database: {
        configured: supabaseConfigured,
        reachable: dbReachable,
        latencyMs: dbLatencyMs,
        error: dbError,
        provider: supabaseConfigured ? "supabase-cloud" : "local-browser-fallback",
        rlsEnforced: supabaseConfigured && dbReachable,
      },
      ndapsProvider: {
        configured: ndapsConfigured,
        status: ndapsConfigured ? "live" : "simulated",
        mode: ndapsConfigured ? "authoritative" : "illustrative-fallback",
        endpointHost: hasNdapsBase
          ? new URL(process.env.NDAPS_API_BASE_URL!).hostname
          : "unconfigured",
      },
      rateLimiter: {
        status: "operational",
        type: "sliding-window-tiered",
        trackedLimits: {
          postcodeLookup: "60 req/min (300 authenticated)",
          batchCleanse: "10 req/min (50 authenticated)",
          locationMutations: "30 req/min (150 authenticated)",
        },
      },
      auditLogger: {
        status: "operational",
        sink: supabaseConfigured && dbReachable ? "dual (stdout + postgresql)" : "stdout-json",
        recentEventCount: recentLogs.length,
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
      "developer-api-sandbox",
      "rate-limiting-telemetry",
      "structured-audit-logging",
      "active-workspace-selection",
    ],
  });
}

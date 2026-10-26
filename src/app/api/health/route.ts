import { NextResponse } from "next/server";
import { getRecentAuditLogs } from "@/lib/audit-logger";

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

  const ndapsReady = hasNdapsKey && hasNdapsBase && hasNdapsPath;
  const supabaseReady = hasSupabaseUrl && hasSupabaseKey;

  const uptime = typeof process.uptime === "function" ? Math.round(process.uptime()) : 0;
  const recentLogs = getRecentAuditLogs(5);

  return NextResponse.json({
    status: "healthy",
    uptimeSeconds: uptime,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    checks: {
      database: {
        status: supabaseReady ? "ready" : "unconfigured",
        provider: supabaseReady ? "supabase-cloud" : "local-browser-fallback",
        rlsEnforced: supabaseReady,
      },
      ndapsProvider: {
        status: ndapsReady ? "live" : "simulated",
        mode: ndapsReady ? "authoritative" : "illustrative-fallback",
        upstreamConfigured: ndapsReady,
      },
      rateLimiter: {
        status: "operational",
        type: "in-memory-sliding-window",
        trackedLimits: {
          postcodeLookup: "60 req/min",
          batchCleanse: "10 req/min",
          locationMutations: "30 req/min",
        },
      },
      auditLogger: {
        status: "operational",
        sink: "stdout-json",
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
    ],
  });
}

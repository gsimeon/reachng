import { NextResponse } from "next/server";

export async function GET() {
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_PROJECT"));
  const hasSupabaseKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY"));
  const hasNdapsKey = Boolean(process.env.NDAPS_API_KEY && process.env.NDAPS_API_KEY.trim() !== "");
  const hasNdapsBase = Boolean(process.env.NDAPS_API_BASE_URL && process.env.NDAPS_API_BASE_URL.trim() !== "");
  const hasNdapsPath = Boolean(process.env.NDAPS_LOOKUP_PATH && process.env.NDAPS_LOOKUP_PATH.trim() !== "");

  const ndapsReady = hasNdapsKey && hasNdapsBase && hasNdapsPath;
  const supabaseReady = hasSupabaseUrl && hasSupabaseKey;

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    environment: {
      provider: ndapsReady ? "ndaps-live" : "ndaps-simulation-fallback",
      database: supabaseReady ? "supabase-cloud" : "local-storage-fallback",
      providerConfigured: ndapsReady,
      supabaseConfigured: supabaseReady,
    },
    capabilities: [
      "ndaps-format-validation",
      "anatomical-zone-parsing",
      "batch-postcode-cleanse",
      "location-book-management",
      "developer-api-sandbox",
    ],
  });
}

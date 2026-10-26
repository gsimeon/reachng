import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { locationsRateLimiter, getClientIp } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit-logger";

const locationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
  category: z.enum(["Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"]).optional().default("Fulfilment Hub"),
});

export async function GET(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  const rateLimitResult = locationsRateLimiter.check(clientIp);
  const rateLimitHeaders = locationsRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/locations [GET]", limit: rateLimitResult.limit },
    });

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503, headers: rateLimitHeaders });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view saved locations." }, { status: 401, headers: rateLimitHeaders });

  const { data, error } = await supabase
    .from("locations")
    .select("id, label, postcode, address, category, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const durationMs = performance.now() - start;

  if (error) {
    recordAuditEvent({
      eventType: "location.list",
      level: "error",
      requestId,
      clientIp,
      statusCode: 500,
      durationMs,
      metadata: { userId: user.id },
    });
    return NextResponse.json({ error: "Could not load locations." }, { status: 500, headers: rateLimitHeaders });
  }

  recordAuditEvent({
    eventType: "location.list",
    level: "info",
    requestId,
    clientIp,
    statusCode: 200,
    durationMs,
    metadata: { userId: user.id, count: data?.length ?? 0 },
  });

  return NextResponse.json({ locations: data }, { status: 200, headers: rateLimitHeaders });
}

export async function POST(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  const rateLimitResult = locationsRateLimiter.check(clientIp);
  const rateLimitHeaders = locationsRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/locations [POST]", limit: rateLimitResult.limit },
    });

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503, headers: rateLimitHeaders });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save a location." }, { status: 401, headers: rateLimitHeaders });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: rateLimitHeaders });
  }
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the location label, category, and 11-character postcode." }, { status: 422, headers: rateLimitHeaders });

  // Database trigger derives user's organization; client-supplied org id is never trusted.
  const { data, error } = await supabase.from("locations").insert({
    label: parsed.data.label,
    postcode: parsed.data.postcode.toUpperCase(),
    address: parsed.data.address,
    category: parsed.data.category,
    created_by: user.id,
  }).select("id, label, postcode, address, category, created_at").single();

  const durationMs = performance.now() - start;

  if (error) {
    recordAuditEvent({
      eventType: "location.create",
      level: "error",
      requestId,
      clientIp,
      statusCode: 400,
      durationMs,
      metadata: { userId: user.id, category: parsed.data.category, error: error.message },
    });
    return NextResponse.json({ error: `Could not save location: ${error.message}` }, { status: 400, headers: rateLimitHeaders });
  }

  recordAuditEvent({
    eventType: "location.create",
    level: "info",
    requestId,
    clientIp,
    statusCode: 201,
    durationMs,
    metadata: { userId: user.id, locationId: data?.id, category: parsed.data.category },
  });

  return NextResponse.json({ location: data }, { status: 201, headers: rateLimitHeaders });
}

export async function DELETE(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  const rateLimitResult = locationsRateLimiter.check(clientIp);
  const rateLimitHeaders = locationsRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503, headers: rateLimitHeaders });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete a location." }, { status: 401, headers: rateLimitHeaders });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing location ID." }, { status: 400, headers: rateLimitHeaders });

  const { error } = await supabase.from("locations").delete().eq("id", id);
  const durationMs = performance.now() - start;

  if (error) {
    recordAuditEvent({
      eventType: "location.delete",
      level: "error",
      requestId,
      clientIp,
      statusCode: 400,
      durationMs,
      metadata: { userId: user.id, locationId: id },
    });
    return NextResponse.json({ error: "Could not delete location." }, { status: 400, headers: rateLimitHeaders });
  }

  recordAuditEvent({
    eventType: "location.delete",
    level: "info",
    requestId,
    clientIp,
    statusCode: 200,
    durationMs,
    metadata: { userId: user.id, locationId: id },
  });

  return NextResponse.json({ success: true }, { status: 200, headers: rateLimitHeaders });
}

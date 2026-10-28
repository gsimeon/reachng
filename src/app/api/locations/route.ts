import { NextResponse } from "next/server";
import { z } from "zod";
import { locationsRateLimiter, getClientIp, resolveClientIdentity } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit-logger";
import { verifyRequestAuth, toVerifiedIdentity } from "@/lib/auth-helpers";

const locationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
  category: z.enum(["Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"]).optional().default("Fulfilment Hub"),
  organization_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const { searchParams } = new URL(request.url);
  const targetOrgId = searchParams.get("organization_id") || request.headers.get("x-organization-id");

  // 1. IP-level rate-limiting guard (prevents authentication endpoint brute-forcing)
  const ipCheck = await locationsRateLimiter.check(`ip:${clientIp}`, false);
  if (!ipCheck.success) {
    const rateLimitHeaders = locationsRateLimiter.getHeaders(ipCheck);
    await recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/locations [GET]", limit: ipCheck.limit },
    });

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // 2. Authoritative authentication and membership verification
  const auth = await verifyRequestAuth(request, targetOrgId);
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in to view saved locations." }, { status: 401 });
  }

  if (!auth.client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  // If a specific organization was targeted, verify the user is a confirmed member
  if (targetOrgId && !auth.isMemberOfRequestedOrg) {
    const durationMs = performance.now() - start;
    await recordAuditEvent({
      eventType: "location.list",
      level: "warn",
      requestId,
      clientIp,
      statusCode: 403,
      durationMs,
      organizationId: targetOrgId,
      actorId: auth.user.id,
      metadata: { error: "MEMBERSHIP_REQUIRED", targetOrgId },
    }, auth.client);

    return NextResponse.json(
      { error: "You do not have access to this organization.", code: "UNAUTHORIZED" },
      { status: 403 }
    );
  }

  // 3. Authenticated quota check (derived strictly from verified identity)
  const verifiedIdentity = toVerifiedIdentity(auth);
  const { identity, isAuthenticated } = resolveClientIdentity(request, verifiedIdentity);
  const rateLimitResult = await locationsRateLimiter.check(identity, isAuthenticated);
  const rateLimitHeaders = locationsRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    await recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      organizationId: auth.verifiedOrgId,
      actorId: auth.user.id,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/locations [GET]", limit: rateLimitResult.limit },
    }, auth.client);

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // 4. Query database with row-level security
  let query = auth.client
    .from("locations")
    .select("id, organization_id, label, postcode, address, category, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (targetOrgId && z.string().uuid().safeParse(targetOrgId).success) {
    query = query.eq("organization_id", targetOrgId);
  }

  const { data, error } = await query;
  const durationMs = performance.now() - start;

  if (error) {
    await recordAuditEvent({
      eventType: "location.list",
      level: "error",
      requestId,
      clientIp,
      statusCode: 500,
      durationMs,
      organizationId: auth.verifiedOrgId,
      actorId: auth.user.id,
      metadata: { userId: auth.user.id },
    }, auth.client);

    return NextResponse.json({ error: "Could not load locations." }, { status: 500, headers: rateLimitHeaders });
  }

  await recordAuditEvent({
    eventType: "location.list",
    level: "info",
    requestId,
    clientIp,
    statusCode: 200,
    durationMs,
    organizationId: auth.verifiedOrgId,
    actorId: auth.user.id,
    metadata: { userId: auth.user.id, count: data?.length ?? 0, targetOrgId: targetOrgId || "all-memberships" },
  }, auth.client);

  return NextResponse.json({ locations: data }, { status: 200, headers: rateLimitHeaders });
}

export async function POST(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const orgHeader = request.headers.get("x-organization-id");

  // 1. IP-level rate-limiting guard
  const ipCheck = await locationsRateLimiter.check(`ip:${clientIp}`, false);
  if (!ipCheck.success) {
    const rateLimitHeaders = locationsRateLimiter.getHeaders(ipCheck);
    await recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/locations [POST]", limit: ipCheck.limit },
    });

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // 2. Parse body first to extract targeted organization_id if provided
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the location label, category, and 11-character postcode." }, { status: 422 });
  }

  const targetOrgId = parsed.data.organization_id || orgHeader;

  // 3. Authoritative authentication and membership verification
  const auth = await verifyRequestAuth(request, targetOrgId);
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in to save a location." }, { status: 401 });
  }

  if (!auth.client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (targetOrgId && !auth.isMemberOfRequestedOrg) {
    const durationMs = performance.now() - start;
    await recordAuditEvent({
      eventType: "location.create",
      level: "warn",
      requestId,
      clientIp,
      statusCode: 403,
      durationMs,
      organizationId: targetOrgId,
      actorId: auth.user.id,
      metadata: { error: "MEMBERSHIP_REQUIRED", targetOrgId },
    }, auth.client);

    return NextResponse.json(
      { error: "You do not have permission to add locations to this workspace.", code: "UNAUTHORIZED" },
      { status: 403 }
    );
  }

  // 4. Authenticated quota check (strictly derived)
  const verifiedIdentity = toVerifiedIdentity(auth);
  const { identity, isAuthenticated } = resolveClientIdentity(request, verifiedIdentity);
  const rateLimitResult = await locationsRateLimiter.check(identity, isAuthenticated);
  const rateLimitHeaders = locationsRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    await recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      organizationId: auth.verifiedOrgId,
      actorId: auth.user.id,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/locations [POST]", limit: rateLimitResult.limit },
    }, auth.client);

    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // 5. Build insert payload
  const insertPayload: Record<string, unknown> = {
    label: parsed.data.label,
    postcode: parsed.data.postcode.toUpperCase(),
    address: parsed.data.address,
    category: parsed.data.category,
    created_by: auth.user.id,
  };

  if (parsed.data.organization_id) {
    insertPayload.organization_id = parsed.data.organization_id;
  } else if (auth.verifiedOrgId) {
    insertPayload.organization_id = auth.verifiedOrgId;
  }

  const { data, error } = await auth.client
    .from("locations")
    .insert(insertPayload)
    .select("id, organization_id, label, postcode, address, category, created_at")
    .single();

  const durationMs = performance.now() - start;

  if (error) {
    const isAuthError = error.message.toLowerCase().includes("unauthorized") || error.message.toLowerCase().includes("not a member");
    const status = isAuthError ? 403 : 400;

    await recordAuditEvent({
      eventType: "location.create",
      level: "error",
      requestId,
      clientIp,
      statusCode: status,
      durationMs,
      organizationId: parsed.data.organization_id ?? auth.verifiedOrgId,
      actorId: auth.user.id,
      metadata: { userId: auth.user.id, category: parsed.data.category, error: error.message },
    }, auth.client);

    const clientSafeMessage = isAuthError
      ? "You do not have permission to add locations to this workspace."
      : "Could not save location. Please check the provided information and try again.";

    return NextResponse.json(
      { error: clientSafeMessage, code: isAuthError ? "UNAUTHORIZED" : "SAVE_FAILED" },
      { status, headers: rateLimitHeaders }
    );
  }

  await recordAuditEvent({
    eventType: "location.create",
    level: "info",
    requestId,
    clientIp,
    statusCode: 201,
    durationMs,
    organizationId: (data?.organization_id as string | undefined) ?? auth.verifiedOrgId,
    actorId: auth.user.id,
    metadata: { userId: auth.user.id, locationId: data?.id, organizationId: data?.organization_id, category: parsed.data.category },
  }, auth.client);

  return NextResponse.json({ location: data }, { status: 201, headers: rateLimitHeaders });
}

export async function DELETE(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  // 1. IP-level rate-limiting guard
  const ipCheck = await locationsRateLimiter.check(`ip:${clientIp}`, false);
  if (!ipCheck.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: locationsRateLimiter.getHeaders(ipCheck) }
    );
  }

  // 2. Authoritative authentication
  const auth = await verifyRequestAuth(request);
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in to delete a location." }, { status: 401 });
  }

  if (!auth.client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  // 3. Authenticated quota check
  const verifiedIdentity = toVerifiedIdentity(auth);
  const { identity, isAuthenticated } = resolveClientIdentity(request, verifiedIdentity);
  const rateLimitResult = await locationsRateLimiter.check(identity, isAuthenticated);
  const rateLimitHeaders = locationsRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again.", code: "RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing location ID." }, { status: 400, headers: rateLimitHeaders });

  // 4. Delete operation constrained by RLS (only allowed if user belongs to location's organization)
  const { error } = await auth.client.from("locations").delete().eq("id", id);
  const durationMs = performance.now() - start;

  if (error) {
    await recordAuditEvent({
      eventType: "location.delete",
      level: "error",
      requestId,
      clientIp,
      statusCode: 400,
      durationMs,
      actorId: auth.user.id,
      metadata: { userId: auth.user.id, locationId: id },
    }, auth.client);

    return NextResponse.json({ error: "Could not delete location." }, { status: 400, headers: rateLimitHeaders });
  }

  await recordAuditEvent({
    eventType: "location.delete",
    level: "info",
    requestId,
    clientIp,
    statusCode: 200,
    durationMs,
    actorId: auth.user.id,
    metadata: { userId: auth.user.id, locationId: id },
  }, auth.client);

  return NextResponse.json({ success: true }, { status: 200, headers: rateLimitHeaders });
}

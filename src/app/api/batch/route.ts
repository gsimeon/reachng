import { NextResponse } from "next/server";
import { z } from "zod";
import { looksLikeNdapsPostcode } from "@/lib/postcode";
import { parseNdapsPostcode } from "@/lib/nigeria-data";
import { batchRateLimiter, getClientIp, resolveClientIdentity } from "@/lib/rate-limit";
import { recordAuditEvent, getServerAuditSink } from "@/lib/audit-logger";
import { verifyRequestAuth, toVerifiedIdentity } from "@/lib/auth-helpers";

const batchSchema = z.object({
  items: z.array(z.string().max(100)).min(1).max(100),
});

export async function POST(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const orgHeader = request.headers.get("x-organization-id");

  // 1. Authoritative identity resolution:
  // Strictly verifies session and workspace membership before granting higher quota tier.
  // Unauthenticated requests or spoofed organization headers are strictly assigned IP identity and base quota.
  const auth = await verifyRequestAuth(request, orgHeader);
  const verifiedIdentity = toVerifiedIdentity(auth);
  const { identity, isAuthenticated } = resolveClientIdentity(request, verifiedIdentity);
  const auditSink = await getServerAuditSink();

  // 2. Asynchronous rate limiting enforcement
  const rateLimitResult = await batchRateLimiter.check(identity, isAuthenticated);
  const rateLimitHeaders = batchRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    await recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      organizationId: auth.verifiedOrgId,
      actorId: auth.user?.id ?? null,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/batch", limit: rateLimitResult.limit, identity },
    }, auditSink);

    return NextResponse.json(
      {
        error: "Too many batch requests. Please slow down and try again.",
        code: "RATE_LIMITED",
        retryAfter: rateLimitResult.reset,
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // 3. Request body parsing
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await recordAuditEvent({
      eventType: "postcode.batch",
      level: "warn",
      requestId,
      clientIp,
      organizationId: auth.verifiedOrgId,
      actorId: auth.user?.id ?? null,
      statusCode: 400,
      durationMs: performance.now() - start,
      metadata: { error: "INVALID_JSON" },
    }, auditSink);

    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    await recordAuditEvent({
      eventType: "postcode.batch",
      level: "warn",
      requestId,
      clientIp,
      organizationId: auth.verifiedOrgId,
      actorId: auth.user?.id ?? null,
      statusCode: 400,
      durationMs: performance.now() - start,
      metadata: { error: "INVALID_BATCH_SIZE" },
    }, auditSink);

    return NextResponse.json(
      { error: "Provide between 1 and 100 postcode strings to validate." },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  const results = parsed.data.items.map((raw) => {
    const trimmed = raw.trim().toUpperCase();
    const valid = looksLikeNdapsPostcode(trimmed);
    if (!valid) {
      return {
        raw,
        cleanPostcode: trimmed,
        valid: false,
        error: "Invalid format. Expected 11 alphanumeric characters.",
      };
    }

    const anatomy = parseNdapsPostcode(trimmed);
    return {
      raw,
      cleanPostcode: trimmed,
      valid: true,
      formatVerified: true,
      isSimulated: true,
      stateCode: anatomy.stateCode,
      stateName: anatomy.stateName,
      lgaName: anatomy.lgaName,
      districtName: anatomy.districtName,
      coordinates: anatomy.coordinates,
      isEstimatedCoords: true,
      coordinateAccuracy: anatomy.coordinateAccuracy,
      zoneCategory: anatomy.zoneCategory,
      roadAccessibility: anatomy.roadAccessibility,
      verificationNote: "11-character format valid. Derived topology is an illustrative simulation, not confirmed by an authoritative NDAPS provider.",
    };
  });

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.length - validCount;
  const durationMs = performance.now() - start;

  await recordAuditEvent({
    eventType: "postcode.batch",
    level: "info",
    requestId,
    clientIp,
    organizationId: auth.verifiedOrgId,
    actorId: auth.user?.id ?? null,
    statusCode: 200,
    durationMs,
    metadata: {
      total: results.length,
      validCount,
      invalidCount,
    },
  }, auditSink);

  return NextResponse.json(
    {
      total: results.length,
      validCount,
      invalidCount,
      disclaimer: "Batch validation confirms 11-character alphanumeric structural syntax. Ground topology and coordinates are illustrative models and require authoritative NDAPS credentials for live verification.",
      processedAt: new Date().toISOString(),
      results,
    },
    { status: 200, headers: rateLimitHeaders }
  );
}

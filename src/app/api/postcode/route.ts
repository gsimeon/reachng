import { NextResponse } from "next/server";
import { z } from "zod";
import { looksLikeNdapsPostcode, lookupPostcode } from "@/lib/postcode";
import { postcodeRateLimiter, getClientIp, resolveClientIdentity } from "@/lib/rate-limit";
import { recordAuditEvent, getServerAuditSink } from "@/lib/audit-logger";

const bodySchema = z.object({ postcode: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  const start = performance.now();
  const clientIp = getClientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const orgHeader = request.headers.get("x-organization-id");
  const { identity, isAuthenticated } = resolveClientIdentity(request, orgHeader);
  const auditSink = await getServerAuditSink();

  // 1. Rate limiting enforcement (supports 5x tier for authenticated orgs)
  const rateLimitResult = postcodeRateLimiter.check(identity, isAuthenticated);
  const rateLimitHeaders = postcodeRateLimiter.getHeaders(rateLimitResult);

  if (!rateLimitResult.success) {
    recordAuditEvent({
      eventType: "rate_limit.exceeded",
      level: "warn",
      requestId,
      clientIp,
      organizationId: orgHeader ?? null,
      statusCode: 429,
      durationMs: performance.now() - start,
      metadata: { route: "/api/postcode", limit: rateLimitResult.limit },
    }, auditSink);

    return NextResponse.json(
      {
        error: "Too many requests. Please slow down and try again.",
        code: "RATE_LIMITED",
        retryAfter: rateLimitResult.reset,
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  // 2. Body parsing
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordAuditEvent({
      eventType: "postcode.lookup",
      level: "warn",
      requestId,
      clientIp,
      organizationId: orgHeader ?? null,
      statusCode: 400,
      durationMs: performance.now() - start,
      metadata: { error: "INVALID_JSON" },
    }, auditSink);

    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    recordAuditEvent({
      eventType: "postcode.lookup",
      level: "warn",
      requestId,
      clientIp,
      organizationId: orgHeader ?? null,
      statusCode: 400,
      durationMs: performance.now() - start,
      metadata: { error: "EMPTY_POSTCODE" },
    }, auditSink);

    return NextResponse.json(
      { error: "Enter a postcode to continue." },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  const postcode = parsed.data.postcode.trim().toUpperCase();
  if (!looksLikeNdapsPostcode(postcode)) {
    recordAuditEvent({
      eventType: "postcode.lookup",
      level: "warn",
      requestId,
      clientIp,
      organizationId: orgHeader ?? null,
      statusCode: 422,
      durationMs: performance.now() - start,
      metadata: { postcodeLength: postcode.length, code: "INVALID_FORMAT" },
    }, auditSink);

    return NextResponse.json(
      {
        error: "The postcode should contain 11 letters and numbers. This format check does not confirm that it exists.",
        code: "INVALID_FORMAT",
      },
      { status: 422, headers: rateLimitHeaders }
    );
  }

  try {
    const result = await lookupPostcode(postcode);
    const durationMs = performance.now() - start;

    recordAuditEvent({
      eventType: "postcode.lookup",
      level: "info",
      requestId,
      clientIp,
      organizationId: orgHeader ?? null,
      statusCode: 200,
      durationMs,
      metadata: {
        status: result.status,
        isAuthoritative: result.isAuthoritative,
        isSimulated: result.isSimulated,
      },
    }, auditSink);

    return NextResponse.json(result, { status: 200, headers: rateLimitHeaders });
  } catch {
    // Do not leak provider URLs, headers, API keys, or response bodies in errors.
    const durationMs = performance.now() - start;

    recordAuditEvent({
      eventType: "postcode.lookup",
      level: "error",
      requestId,
      clientIp,
      organizationId: orgHeader ?? null,
      statusCode: 502,
      durationMs,
      metadata: { code: "PROVIDER_UNAVAILABLE" },
    }, auditSink);

    return NextResponse.json(
      {
        error: "The postcode provider could not complete the lookup. Try again later.",
        code: "PROVIDER_UNAVAILABLE",
      },
      { status: 502, headers: rateLimitHeaders }
    );
  }
}

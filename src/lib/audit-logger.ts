/**
 * Structured enterprise audit logger & telemetry emitter for ReachNG.
 * Produces structured JSON output with secret sanitization and PII masking.
 * Supports dual-sink output: stdout (container log ingestors) and durable PostgreSQL table (when Supabase active).
 */

export type AuditLogLevel = "info" | "warn" | "error";

export interface AuditEventPayload {
  eventType:
    | "postcode.lookup"
    | "postcode.batch"
    | "location.list"
    | "location.create"
    | "location.delete"
    | "rate_limit.exceeded"
    | "system.health";
  level?: AuditLogLevel;
  requestId?: string;
  clientIp?: string;
  statusCode?: number;
  durationMs?: number;
  organizationId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StructuredAuditLog {
  timestamp: string;
  level: AuditLogLevel;
  eventType: string;
  requestId: string;
  clientIp: string;
  statusCode: number;
  durationMs?: number;
  organizationId?: string | null;
  actorId?: string | null;
  metadata: Record<string, unknown>;
}

// In-memory buffer of recent logs for telemetry inspection and tests
const MAX_LOG_BUFFER = 100;
const auditLogBuffer: StructuredAuditLog[] = [];

/**
 * Anonymize client IP address (masks last segment).
 */
export function maskIp(ip?: string): string {
  if (!ip || ip === "anonymous-client") return "anonymous";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 3).join(":")}:xxxx:xxxx`;
  }
  return ip.slice(0, 4) + "xxx";
}

/**
 * Deep sanitization of objects to strip API keys, auth headers, and secrets.
 */
export function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  const sensitiveKeyPatterns = [/key/i, /secret/i, /token/i, /auth/i, /password/i, /cookie/i];
  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(data)) {
    if (sensitiveKeyPatterns.some((pattern) => pattern.test(k))) {
      sanitized[k] = "[REDACTED]";
      continue;
    }

    if (typeof v === "string") {
      if (v.startsWith("Bearer ") || v.startsWith("eyJ")) {
        sanitized[k] = "[REDACTED]";
      } else if (v.length > 500) {
        sanitized[k] = `${v.slice(0, 500)}... (truncated)`;
      } else {
        sanitized[k] = v;
      }
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export interface DurableAuditSink {
  from(table: string): {
    insert(payload: Record<string, unknown>): PromiseLike<{ error?: unknown } | unknown> | { error?: unknown };
  };
}

export interface DurableAuditTelemetry {
  configured: boolean;
  verified: boolean;
  totalWritesAttempted: number;
  totalWritesSucceeded: number;
  lastWriteAt?: string;
  lastError?: string;
}

const durableTelemetry: DurableAuditTelemetry = {
  configured: false,
  verified: false,
  totalWritesAttempted: 0,
  totalWritesSucceeded: 0,
};

/**
 * Resolve server-side durable audit sink.
 * Uses SUPABASE_SERVICE_ROLE_KEY if available for tamper-evident server-side writes,
 * or falls back to server client with user/anon session.
 */
export async function getServerAuditSink(): Promise<DurableAuditSink | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey && !url.includes("YOUR_PROJECT") && !serviceKey.includes("YOUR_SERVICE_KEY")) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch {
      // Fallback below
    }
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const client = await createSupabaseServerClient();
    return client;
  } catch {
    return null;
  }
}

/**
 * Record a structured audit event.
 * If a durable sink (Supabase client) is provided, also attempts to persist to public.audit_events.
 * Updates durable audit telemetry to make persistence and failures observable.
 */
export function recordAuditEvent(event: AuditEventPayload, durableSink?: DurableAuditSink | null): StructuredAuditLog {
  const log: StructuredAuditLog = {
    timestamp: new Date().toISOString(),
    level:
      event.level ??
      (event.statusCode && event.statusCode >= 500
        ? "error"
        : event.statusCode && event.statusCode >= 400
        ? "warn"
        : "info"),
    eventType: event.eventType,
    requestId:
      event.requestId ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req_${Date.now()}`),
    clientIp: maskIp(event.clientIp),
    statusCode: event.statusCode ?? 200,
    durationMs: event.durationMs !== undefined ? Math.round(event.durationMs) : undefined,
    organizationId: event.organizationId ?? null,
    actorId: event.actorId ?? null,
    metadata: sanitizeMetadata(event.metadata),
  };

  // Add to in-memory telemetry buffer
  auditLogBuffer.unshift(log);
  if (auditLogBuffer.length > MAX_LOG_BUFFER) {
    auditLogBuffer.pop();
  }

  // Dual-sink: standard JSON stdout for container log ingestors
  if (process.env.NODE_ENV !== "test") {
    const formatted = JSON.stringify(log);
    if (log.level === "error") {
      console.error(formatted);
    } else if (log.level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  // Durable sink write to PostgreSQL audit_events (non-blocking async)
  if (durableSink) {
    durableTelemetry.configured = true;
    durableTelemetry.totalWritesAttempted += 1;

    Promise.resolve(
      durableSink.from("audit_events").insert({
        organization_id: log.organizationId,
        actor_id: log.actorId,
        action: log.eventType,
        resource_type: log.eventType.split(".")[0] || "system",
        metadata: {
          requestId: log.requestId,
          clientIp: log.clientIp,
          statusCode: log.statusCode,
          durationMs: log.durationMs,
          ...log.metadata,
        },
      })
    )
      .then((res) => {
        const potentialError = (res as { error?: unknown })?.error;
        if (potentialError) {
          durableTelemetry.lastError =
            typeof potentialError === "object" && potentialError !== null && "message" in potentialError
              ? String((potentialError as { message: unknown }).message)
              : String(potentialError);
          if (process.env.NODE_ENV !== "test") {
            console.warn("[audit-logger] Warning: durable sink write returned error:", potentialError);
          }
        } else {
          durableTelemetry.verified = true;
          durableTelemetry.totalWritesSucceeded += 1;
          durableTelemetry.lastWriteAt = new Date().toISOString();
          durableTelemetry.lastError = undefined;
        }
      })
      .catch((err) => {
        durableTelemetry.lastError = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV !== "test") {
          console.warn("[audit-logger] Warning: durable sink write failed:", err instanceof Error ? err.message : err);
        }
      });
  }

  return log;
}

/**
 * Retrieve durable audit telemetry (for health diagnostics and observability).
 */
export function getDurableAuditTelemetry(): DurableAuditTelemetry {
  return { ...durableTelemetry };
}

/**
 * Retrieve recent telemetry logs (for health/diagnostics inspection).
 */
export function getRecentAuditLogs(limit = 20): StructuredAuditLog[] {
  return auditLogBuffer.slice(0, limit);
}

/**
 * Clear the audit log buffer and telemetry (for unit test isolation).
 */
export function clearAuditLogBuffer(): void {
  auditLogBuffer.length = 0;
  durableTelemetry.configured = false;
  durableTelemetry.verified = false;
  durableTelemetry.totalWritesAttempted = 0;
  durableTelemetry.totalWritesSucceeded = 0;
  durableTelemetry.lastWriteAt = undefined;
  durableTelemetry.lastError = undefined;
}

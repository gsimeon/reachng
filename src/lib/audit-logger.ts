/**
 * Structured enterprise audit logger & telemetry emitter for ReachNG.
 * Produces structured JSON output with secret sanitization and PII masking.
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

/**
 * Record a structured audit event.
 */
export function recordAuditEvent(event: AuditEventPayload): StructuredAuditLog {
  const log: StructuredAuditLog = {
    timestamp: new Date().toISOString(),
    level: event.level ?? (event.statusCode && event.statusCode >= 500 ? "error" : event.statusCode && event.statusCode >= 400 ? "warn" : "info"),
    eventType: event.eventType,
    requestId: event.requestId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `req_${Date.now()}`),
    clientIp: maskIp(event.clientIp),
    statusCode: event.statusCode ?? 200,
    durationMs: event.durationMs !== undefined ? Math.round(event.durationMs) : undefined,
    metadata: sanitizeMetadata(event.metadata),
  };

  // Add to in-memory telemetry buffer
  auditLogBuffer.unshift(log);
  if (auditLogBuffer.length > MAX_LOG_BUFFER) {
    auditLogBuffer.pop();
  }

  // Write structured JSON to stdout for log ingestors (DataDog, CloudWatch, GCP Logging)
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

  return log;
}

/**
 * Retrieve recent telemetry logs (for health/diagnostics inspection).
 */
export function getRecentAuditLogs(limit = 20): StructuredAuditLog[] {
  return auditLogBuffer.slice(0, limit);
}

/**
 * Clear the audit log buffer (for unit test isolation).
 */
export function clearAuditLogBuffer(): void {
  auditLogBuffer.length = 0;
}

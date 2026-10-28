import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VerifiedIdentity } from "@/lib/rate-limit";

export interface VerifiedAuthResult {
  user: { id: string; email?: string } | null;
  verifiedOrgId: string | null;
  isMemberOfRequestedOrg: boolean;
  client: Awaited<ReturnType<typeof createSupabaseServerClient>> | null;
}

/**
 * Authoritatively verify client session and organization membership from database.
 * NEVER trusts client-supplied headers (like x-organization-id) or query parameters
 * without confirming the caller's identity and membership in public.organization_members.
 */
export async function verifyRequestAuth(
  request: Request,
  requestedOrgId?: string | null
): Promise<VerifiedAuthResult> {
  const supabase = await createSupabaseServerClient();
  let client = supabase;
  let user: { id: string; email?: string } | null = null;

  // 1. Check for Authorization: Bearer <token> header (API callers)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && anonKey && !url.includes("YOUR_PROJECT")) {
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const bearerClient = createClient(url, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data } = await bearerClient.auth.getUser(token);
          if (data?.user) {
            user = { id: data.user.id, email: data.user.email };
            client = bearerClient as unknown as typeof supabase;
          }
        } catch {
          // Fall through to session cookie client
        }
      }
    }
  }

  // 2. Check for cookie-based session if Bearer auth not established
  if (!user && supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        user = { id: data.user.id, email: data.user.email };
      }
    } catch {
      // Supabase unavailable or invalid cookie
    }
  }

  if (!user || !client) {
    return {
      user: null,
      verifiedOrgId: null,
      isMemberOfRequestedOrg: false,
      client: null,
    };
  }

  // 3. Verify organization membership in database
  const isUuid = requestedOrgId ? /^[0-9a-fA-F-]{36}$/.test(requestedOrgId) : false;

  if (requestedOrgId && isUuid) {
    const { data: membership } = await client
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", requestedOrgId)
      .maybeSingle();

    if (membership?.organization_id) {
      return {
        user,
        verifiedOrgId: membership.organization_id,
        isMemberOfRequestedOrg: true,
        client,
      };
    }

    // Explicit organization requested, but user is NOT a member
    return {
      user,
      verifiedOrgId: null,
      isMemberOfRequestedOrg: false,
      client,
    };
  }

  // No specific org requested; fetch user's primary/first organization membership
  const { data: memberships } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  const primaryOrgId = memberships?.[0]?.organization_id ?? null;

  return {
    user,
    verifiedOrgId: primaryOrgId,
    isMemberOfRequestedOrg: true,
    client,
  };
}

/**
 * Format VerifiedIdentity for rate limiter.
 */
export function toVerifiedIdentity(auth: VerifiedAuthResult): VerifiedIdentity | null {
  if (!auth.user) return null;
  return {
    userId: auth.user.id,
    verifiedOrgId: auth.verifiedOrgId,
  };
}

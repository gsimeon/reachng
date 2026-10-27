import { z } from "zod";
import { parseNdapsPostcode, type PostcodeAnatomy } from "./nigeria-data";

/**
 * Authoritative verification states in accordance with NDAPS integration standards:
 * - provider_confirmed: Upstream official NDAPS provider verified the exact 11-char code and returned active status.
 * - format_checked: 11-character alphanumeric structural syntax is compliant, but not queried against the registry.
 * - unconfirmed_provider_response: Provider responded HTTP 200, but payload failed schema or returned mismatched postcode.
 * - provider_unavailable: Upstream provider timed out, returned 5xx, or failed network connection.
 * - demo: Upstream provider credentials not configured; local synthetic reference model used.
 */
export type LookupStatus =
  | "provider_confirmed"
  | "format_checked"
  | "unconfirmed_provider_response"
  | "provider_unavailable"
  | "demo";

export interface ProviderConfirmedData {
  postcode: string;
  status: string;
  state?: string;
  lga?: string;
  district?: string;
  verified_at?: string;
  source?: string;
  [key: string]: unknown;
}

export interface LookupResult {
  postcode: string;
  status: LookupStatus;
  message: string;
  isAuthoritative: boolean;
  isSimulated: boolean;
  providerData?: ProviderConfirmedData | unknown;
  anatomy?: PostcodeAnatomy;
  disclaimer: string;
}

const postcodePattern = /^[A-Za-z0-9]{11}$/;

/**
 * Format validation is only a syntactic sanity check. It proves 11-character alphanumeric
 * structural compliance, but does NOT prove that a postcode exists, belongs to an occupant,
 * or has been registered in the official NDAPS database.
 */
export function looksLikeNdapsPostcode(value: string): boolean {
  return postcodePattern.test(value.trim());
}

/**
 * Documented response schema contract for authoritative NDAPS provider lookups.
 * Must include the matching 11-character postcode and an active status indicator.
 */
export const ndapsProviderResponseSchema = z.object({
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  status: z.union([
    z.enum(["active", "registered", "verified", "valid"]),
    z.literal(true),
  ]),
  state: z.string().optional(),
  lga: z.string().optional(),
  district: z.string().optional(),
  verified_at: z.string().optional(),
  source: z.string().optional(),
}).passthrough();

export async function lookupPostcode(rawPostcode: string): Promise<LookupResult> {
  const postcode = rawPostcode.trim().toUpperCase();
  const baseUrl = process.env.NDAPS_API_BASE_URL;
  const apiKey = process.env.NDAPS_API_KEY;
  const lookupPath = process.env.NDAPS_LOOKUP_PATH;

  const anatomy = parseNdapsPostcode(postcode);

  if (!baseUrl || !apiKey || !lookupPath) {
    return {
      postcode,
      status: "demo",
      isAuthoritative: false,
      isSimulated: true,
      message: "Illustrative simulation. Upstream NDAPS provider is not configured. This preview is derived from 11-character postal structural rules, not an authoritative registry.",
      disclaimer: "Format valid. Derived topology and coordinates are synthetic models for prototyping and are not authoritative ground-surveyed records.",
      anatomy,
    };
  }

  // API contract supports official NIPOST query param (?code=...) and fallback (?postcode=...)
  const url = new URL(lookupPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const queryParam = process.env.NDAPS_QUERY_PARAM || "code";
  url.searchParams.set(queryParam, postcode);
  if (queryParam !== "postcode") {
    url.searchParams.set("postcode", postcode);
  }

  const headerName = process.env.NDAPS_AUTH_HEADER || "Authorization";
  const scheme = process.env.NDAPS_AUTH_SCHEME ?? "Bearer";
  const authValue = scheme.toLowerCase() === "raw" ? apiKey : `${scheme} ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { [headerName]: authValue, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}`);
    }

    const rawJson: unknown = await response.json();
    const validation = ndapsProviderResponseSchema.safeParse(rawJson);

    if (validation.success) {
      const providerPostcode = validation.data.postcode.trim().toUpperCase();

      // Enforce strict exact match between requested postcode and provider response
      if (providerPostcode !== postcode) {
        return {
          postcode,
          status: "unconfirmed_provider_response",
          isAuthoritative: false,
          isSimulated: false,
          message: `Upstream provider returned mismatched postcode "${providerPostcode}". Verification contract rejected.`,
          disclaimer: "Provider response postcode does not match the requested postcode.",
          providerData: rawJson,
          anatomy,
        };
      }

      return {
        postcode,
        status: "provider_confirmed",
        isAuthoritative: true,
        isSimulated: false,
        message: "Authoritative NDAPS provider response validated. Postal registration confirmed.",
        providerData: validation.data as ProviderConfirmedData,
        // Crucial: When verified by provider, do NOT claim synthetic coordinates are ground truth
        anatomy: {
          ...anatomy,
          stateName: validation.data.state || anatomy.stateName,
          lgaName: validation.data.lga || anatomy.lgaName,
          districtName: validation.data.district || anatomy.districtName,
        },
        disclaimer: "Official NDAPS registration confirmed by upstream provider. Coordinates remain regional benchmark approximations.",
      };
    }

    return {
      postcode,
      status: "unconfirmed_provider_response",
      isAuthoritative: false,
      isSimulated: false,
      message: "Upstream provider returned an HTTP 200 response, but the response schema failed the official NDAPS verification contract. Review raw payload.",
      disclaimer: "Provider response does not conform to the documented verification schema; cannot be treated as authoritative.",
      providerData: rawJson,
      anatomy,
    };
  } finally {
    clearTimeout(timeout);
  }
}

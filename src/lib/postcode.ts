import { z } from "zod";
import { parseNdapsPostcode, type PostcodeAnatomy } from "./nigeria-data";

export type LookupStatus = "verified-by-provider" | "unconfirmed-provider-response" | "simulated-demo" | "demo";

export interface LookupResult {
  postcode: string;
  status: LookupStatus;
  message: string;
  isAuthoritative: boolean;
  isSimulated: boolean;
  providerData?: unknown;
  anatomy?: PostcodeAnatomy;
  disclaimer?: string;
}

const postcodePattern = /^[A-Za-z0-9]{11}$/;

/**
 * Format validation is only a client-side sanity check. It proves 11-character alphanumeric
 * structural compliance, but does NOT prove that a postcode exists, belongs to a person,
 * or has been registered in the official NDAPS database.
 */
export function looksLikeNdapsPostcode(value: string): boolean {
  return postcodePattern.test(value.trim());
}

/**
 * Documented response schema contract for authoritative NDAPS provider lookups.
 * Only responses that strictly validate against this contract and indicate an active/verified
 * status will be marked as "verified-by-provider".
 */
export const ndapsProviderResponseSchema = z.object({
  postcode: z.string().min(11),
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
      status: "simulated-demo",
      isAuthoritative: false,
      isSimulated: true,
      message: "Illustrative simulation. Upstream NDAPS provider is not configured. This preview is derived from 11-character postal structural rules, not an authoritative registry.",
      disclaimer: "Coordinates, LGA assignments, and district names are synthetic models generated for demonstration and are not authoritative ground-surveyed records.",
      anatomy,
    };
  }

  // API contract is configuration-driven. Confirm the official provider's path,
  // request method, query parameter, and response schema before production usage.
  const url = new URL(lookupPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("postcode", postcode);

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
      return {
        postcode,
        status: "verified-by-provider",
        isAuthoritative: true,
        isSimulated: false,
        message: "Authoritative NDAPS provider response validated. Postal registration confirmed.",
        providerData: validation.data,
        anatomy,
      };
    }

    return {
      postcode,
      status: "unconfirmed-provider-response",
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

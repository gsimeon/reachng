import { parseNdapsPostcode, type PostcodeAnatomy } from "./nigeria-data";

export type LookupResult = {
  postcode: string;
  status: "verified-by-provider" | "demo";
  message: string;
  providerData?: unknown;
  anatomy?: PostcodeAnatomy;
  isSimulated?: boolean;
};

const postcodePattern = /^[A-Za-z0-9]{11}$/;

/**
 * Format validation is only a client-side sanity check. It does not prove that a
 * postcode exists, belongs to a person, or is deliverable.
 */
export function looksLikeNdapsPostcode(value: string): boolean {
  return postcodePattern.test(value.trim());
}

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
      message: "Format accepted. Provider verification is not configured yet; this is a simulated preview based on NDAPS postal layout.",
      anatomy,
      isSimulated: true,
    };
  }

  // API contract is deliberately configuration-driven. Confirm the official
  // provider's path, request method, query parameter, and response schema before use.
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
    const providerData: unknown = await response.json();
    return {
      postcode,
      status: "verified-by-provider",
      message: "The provider returned a successful response. Review the raw response before treating any fields as authoritative.",
      providerData,
      anatomy,
      isSimulated: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

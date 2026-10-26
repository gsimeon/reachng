import { NextResponse } from "next/server";
import { z } from "zod";
import { looksLikeNdapsPostcode, lookupPostcode } from "@/lib/postcode";

const bodySchema = z.object({ postcode: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a postcode to continue." }, { status: 400 });
  }

  const postcode = parsed.data.postcode.trim().toUpperCase();
  if (!looksLikeNdapsPostcode(postcode)) {
    return NextResponse.json({
      error: "The postcode should contain 11 letters and numbers. This format check does not confirm that it exists.",
      code: "INVALID_FORMAT",
    }, { status: 422 });
  }

  try {
    const result = await lookupPostcode(postcode);
    return NextResponse.json(result, { status: 200 });
  } catch {
    // Do not leak provider URLs, headers, API keys, or response bodies in errors.
    return NextResponse.json({
      error: "The postcode provider could not complete the lookup. Try again later.",
      code: "PROVIDER_UNAVAILABLE",
    }, { status: 502 });
  }
}

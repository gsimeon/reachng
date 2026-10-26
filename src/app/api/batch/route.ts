import { NextResponse } from "next/server";
import { z } from "zod";
import { looksLikeNdapsPostcode } from "@/lib/postcode";
import { parseNdapsPostcode } from "@/lib/nigeria-data";

const batchSchema = z.object({
  items: z.array(z.string().max(100)).min(1).max(100),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide between 1 and 100 postcode strings to validate." }, { status: 400 });
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
      stateCode: anatomy.stateCode,
      stateName: anatomy.stateName,
      lgaName: anatomy.lgaName,
      districtName: anatomy.districtName,
      coordinates: anatomy.coordinates,
      zoneCategory: anatomy.zoneCategory,
      roadAccessibility: anatomy.roadAccessibility,
    };
  });

  const validCount = results.filter((r) => r.valid).length;

  return NextResponse.json({
    total: results.length,
    validCount,
    invalidCount: results.length - validCount,
    processedAt: new Date().toISOString(),
    results,
  });
}

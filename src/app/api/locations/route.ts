import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const locationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  postcode: z.string().trim().regex(/^[A-Za-z0-9]{11}$/),
  address: z.string().trim().max(300).optional().default(""),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view saved locations." }, { status: 401 });

  const { data, error } = await supabase
    .from("locations")
    .select("id, label, postcode, address, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Could not load locations." }, { status: 500 });
  return NextResponse.json({ locations: data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save a location." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the location label and 11-character postcode." }, { status: 422 });

  // The database trigger derives the user's organization membership; never trust a
  // client-supplied organization_id.
  const { data, error } = await supabase.from("locations").insert({
    label: parsed.data.label,
    postcode: parsed.data.postcode.toUpperCase(),
    address: parsed.data.address,
    created_by: user.id,
  }).select("id, label, postcode, address, created_at").single();

  if (error) return NextResponse.json({ error: "Could not save location. Check that your profile belongs to an organization." }, { status: 400 });
  return NextResponse.json({ location: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete a location." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing location ID." }, { status: 400 });

  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete location." }, { status: 400 });
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionCode = String(body.sessionCode || "").trim().toUpperCase();
  const hostToken = request.headers.get("x-host-token") || "";
  if (!sessionCode) return NextResponse.json({ error: "Session code is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const sessionRes = await supabase.from("sessions").select("id, host_token").eq("session_code", sessionCode).eq("is_active", true).single();
  if (sessionRes.error || !sessionRes.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sessionRes.data.host_token !== hostToken) return NextResponse.json({ error: "Host authorization failed" }, { status: 403 });

  const roundRes = await supabase.from("rounds").select("id").eq("session_id", sessionRes.data.id).order("round_number", { ascending: false }).limit(1).single();
  if (roundRes.error || !roundRes.data) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const update = await supabase.from("rounds").update({ is_revealed: true }).eq("id", roundRes.data.id);
  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

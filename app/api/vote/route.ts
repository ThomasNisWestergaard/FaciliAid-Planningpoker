import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CARD_VALUES } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionCode = String(body.sessionCode || "").trim().toUpperCase();
  const participantToken = String(body.participantToken || "").trim();
  const value = String(body.value || "").trim();

  if (!sessionCode || !participantToken || !value) return NextResponse.json({ error: "Session code, participant token, and value are required" }, { status: 400 });
  if (!CARD_VALUES.includes(value as never)) return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });

  const supabase = supabaseAdmin();
  const sessionRes = await supabase.from("sessions").select("id").eq("session_code", sessionCode).eq("is_active", true).single();
  if (sessionRes.error || !sessionRes.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const participantRes = await supabase.from("participants").select("id, session_id").eq("participant_token", participantToken).single();
  if (participantRes.error || !participantRes.data || participantRes.data.session_id !== sessionRes.data.id) {
    return NextResponse.json({ error: "Participant does not belong to this session" }, { status: 403 });
  }

  const roundRes = await supabase.from("rounds").select("id, is_revealed").eq("session_id", sessionRes.data.id).order("round_number", { ascending: false }).limit(1).single();
  if (roundRes.error || !roundRes.data) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  if (roundRes.data.is_revealed) return NextResponse.json({ error: "Round has already been revealed" }, { status: 400 });

  const upsert = await supabase.from("votes").upsert({ round_id: roundRes.data.id, participant_id: participantRes.data.id, value }, { onConflict: "round_id,participant_id" });
  if (upsert.error) return NextResponse.json({ error: upsert.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

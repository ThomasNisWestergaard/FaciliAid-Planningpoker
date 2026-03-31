import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const sessionCode = request.nextUrl.searchParams.get("sessionCode")?.trim().toUpperCase() || "";
  const participantToken = request.nextUrl.searchParams.get("participantToken")?.trim() || "";
  if (!sessionCode) return NextResponse.json({ error: "Session code is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const sessionRes = await supabase.from("sessions").select("id, session_code, title").eq("session_code", sessionCode).eq("is_active", true).single();
  if (sessionRes.error || !sessionRes.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const session = sessionRes.data;
  const roundRes = await supabase.from("rounds").select("id, round_number, issue_title, is_revealed").eq("session_id", session.id).order("round_number", { ascending: false }).limit(1).single();
  if (roundRes.error || !roundRes.data) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  const round = roundRes.data;
  const participantsRes = await supabase.from("participants").select("id, name, avatar, is_host, participant_token").eq("session_id", session.id).order("is_host", { ascending: false }).order("joined_at", { ascending: true });
  if (participantsRes.error || !participantsRes.data) return NextResponse.json({ error: "Could not load participants" }, { status: 500 });

  const votesRes = await supabase.from("votes").select("participant_id, value").eq("round_id", round.id);
  if (votesRes.error) return NextResponse.json({ error: "Could not load votes" }, { status: 500 });

  const voteMap = new Map<number, string>();
  for (const vote of votesRes.data || []) voteMap.set(vote.participant_id, vote.value);

  let myVote: string | null = null;
  const participants = participantsRes.data.map((p) => {
    const value = voteMap.get(p.id) || null;
    if (p.participant_token === participantToken) myVote = value;
    return { ...p, has_voted: !!value, vote_value: round.is_revealed ? value : null };
  });

  return NextResponse.json({ session, round, participants, myVote });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AVATARS } from "@/lib/constants";
import { randomSessionCode, randomToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "Planning Session").trim();
  const hostName = String(body.hostName || "Host").trim();
  const avatar = String(body.avatar || "tshirt").trim();
  const issueTitle = String(body.issueTitle || "").trim();

  if (!title) return NextResponse.json({ error: "Session title is required" }, { status: 400 });
  if (!hostName) return NextResponse.json({ error: "Host name is required" }, { status: 400 });
  if (!AVATARS.includes(avatar as never)) return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });

  const supabase = supabaseAdmin();
  let sessionCode = randomSessionCode();
  for (let i = 0; i < 5; i += 1) {
    const check = await supabase.from("sessions").select("id").eq("session_code", sessionCode).maybeSingle();
    if (!check.data) break;
    sessionCode = randomSessionCode();
  }

  const hostToken = randomToken();
  const participantToken = randomToken();

  const sessionRes = await supabase
  .from("sessions")
  .insert({
    session_code: sessionCode,
    title,
    host_token: hostToken,
    current_round_number: 1,
    is_active: true,
  })
  .select("id, session_code")
  .single();

if (sessionRes.error || !sessionRes.data) {
  console.error("SESSION INSERT ERROR", sessionRes.error);
  return NextResponse.json(
    { error: sessionRes.error?.message || "Could not create session" },
    { status: 500 }
  );
}

  const session = sessionRes.data;
  const participantRes = await supabase.from("participants").insert({ session_id: session.id, participant_token: participantToken, name: hostName, avatar, is_host: true }).select("id").single();
  if (participantRes.error) return NextResponse.json({ error: participantRes.error.message }, { status: 500 });

  const roundRes = await supabase.from("rounds").insert({ session_id: session.id, round_number: 1, issue_title: issueTitle || null, is_revealed: false });
  if (roundRes.error) return NextResponse.json({ error: roundRes.error.message }, { status: 500 });

  return NextResponse.json({ sessionCode: session.session_code, hostToken, participantToken, hostName }, { status: 201 });
}

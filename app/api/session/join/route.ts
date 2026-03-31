import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AVATARS } from "@/lib/constants";
import { randomToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionCode = String(body.sessionCode || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const avatar = String(body.avatar || "tshirt").trim();

  if (!sessionCode) return NextResponse.json({ error: "Session code is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!AVATARS.includes(avatar as never)) return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });

  const supabase = supabaseAdmin();
  const sessionRes = await supabase.from("sessions").select("id").eq("session_code", sessionCode).eq("is_active", true).single();
  if (sessionRes.error || !sessionRes.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const participantToken = randomToken();
  const insert = await supabase.from("participants").insert({ session_id: sessionRes.data.id, participant_token: participantToken, name, avatar, is_host: false });
  if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 });

  return NextResponse.json({ participantToken, name });
}

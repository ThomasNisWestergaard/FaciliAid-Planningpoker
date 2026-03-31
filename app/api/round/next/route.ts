import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const sessionCode = String(body.sessionCode || "").trim().toUpperCase();
  const issueTitle = String(body.issueTitle || "").trim();
  const hostToken = request.headers.get("x-host-token") || "";
  if (!sessionCode) return NextResponse.json({ error: "Session code is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const sessionRes = await supabase.from("sessions").select("id, host_token, current_round_number").eq("session_code", sessionCode).eq("is_active", true).single();
  if (sessionRes.error || !sessionRes.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (sessionRes.data.host_token !== hostToken) return NextResponse.json({ error: "Host authorization failed" }, { status: 403 });

  const nextRoundNumber = (sessionRes.data.current_round_number || 1) + 1;
  const insert = await supabase.from("rounds").insert({ session_id: sessionRes.data.id, round_number: nextRoundNumber, issue_title: issueTitle || null, is_revealed: false });
  if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 });

  const update = await supabase.from("sessions").update({ current_round_number: nextRoundNumber }).eq("id", sessionRes.data.id);
  if (update.error) return NextResponse.json({ error: update.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

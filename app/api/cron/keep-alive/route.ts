import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Pings Supabase daily so the project's inactivity timer never approaches
 * the free-tier 7-day auto-pause threshold. A paused database fails Vercel's
 * integration provisioning step, which blocks every production deploy.
 */
export async function GET() {
  const { error } = await supabase.from("acc_journal_entries").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pinged: new Date().toISOString() });
}

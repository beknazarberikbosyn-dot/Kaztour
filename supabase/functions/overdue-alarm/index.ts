// Samruk Travel · safety alarm. Runs every minute (see supabase/schema.sql).
// Finds visitors who did not check in by their time and texts their contact the last known point.
// Needs secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SID = Deno.env.get("TWILIO_ACCOUNT_SID"), TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN"), FROM = Deno.env.get("TWILIO_FROM");

Deno.serve(async () => {
  const now = Date.now();
  const { data: due, error } = await db.from("checkins").select("*")
    .eq("status", "out").lt("due_at", now).is("sms_sent_at", null).limit(20);
  if (error) return new Response(error.message, { status: 500 });
  let sent = 0;
  for (const c of due ?? []) {
    const where = c.last_lat != null
      ? `Last point ${c.last_lat.toFixed(5)}, ${c.last_lng.toFixed(5)} at ${new Date(c.last_ts).toISOString().slice(11, 16)} UTC: https://maps.google.com/?q=${c.last_lat},${c.last_lng}`
      : "No point was received.";
    const body = `Samruk Travel safety alarm: ${c.name} did not check in by ${new Date(c.due_at).toISOString().slice(11, 16)} UTC (${c.park ?? "park"}). ${where} If you cannot reach them, call 112.`;
    if (!SID || !TOKEN || !FROM) continue; // SMS service not connected: the office panel still shows the alarm
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${SID}:${TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: c.contact, From: FROM, Body: body }),
    });
    if (r.ok) { await db.from("checkins").update({ sms_sent_at: new Date().toISOString() }).eq("id", c.id); sent++; }
  }
  return Response.json({ overdue: due?.length ?? 0, sent });
});

// Samruk Travel · actions only the park office may take. The caller signs in with Supabase Auth
// (email and password); this function accepts only users whose app_metadata.role is "office".
//   POST {action:"apps"}                                  -> host applications with a 10-minute link to each document
//   POST {action:"decide", id, decision, note}            -> approve (publishes the place as checked), ask for more, or reject
//   POST {action:"verifyHost", id}                        -> mark an existing place as checked by the park
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who } = await db.auth.getUser(token);
  if (!who?.user || who.user.app_metadata?.role !== "office") return json({ error: "park office login needed" }, 401);
  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  if (b.action === "apps") {
    const { data, error } = await db.from("host_applications")
      .select("id, status, owner_name, phone, iin, owner_kind, place, basis, cadastre, cert_no, cert_date, doc_path, doc_name, checks, note, host_id, created_at, decided_at")
      .order("created_at", { ascending: false }).limit(60);
    if (error) return json({ error: error.message }, 500);
    const out = [];
    for (const a of data ?? []) {
      const s = a.doc_path ? await db.storage.from("host-docs").createSignedUrl(a.doc_path, 600) : null;
      out.push({ ...a, doc_url: s?.data?.signedUrl ?? null, iin: a.iin.slice(0, 6) + "••••" + a.iin.slice(-2) });
    }
    return json(out);
  }

  if (b.action === "decide") {
    const id = String(b.id ?? ""), decision = String(b.decision ?? ""), note = String(b.note ?? "").slice(0, 300) || null;
    if (!["approved", "more", "rejected"].includes(decision)) return json({ error: "bad decision" }, 400);
    const { data: a, error } = await db.from("host_applications").select("*").eq("id", id).maybeSingle();
    if (error || !a) return json({ error: "not found" }, 404);
    let host_id = a.host_id;
    if (decision === "approved" && !host_id) {
      host_id = "h-" + a.id.slice(1, 13);
      const p = a.place;
      const { error: e2 } = await db.from("hosts").insert({
        id: host_id, park: p.park, name: p.name, village: p.village || null, lat: p.lat, lng: p.lng, hours: p.hours || null, svc: p.svc, verified: true,
        // the owner's phone becomes the contact travelers see; the form told the owner so
        direct: p.direct ? { ...p.direct, phone: a.phone } : { phone: a.phone, wa: 1, langs: ["ru"], offers: {} },
      });
      if (e2) return json({ error: e2.message }, 500);
    }
    const { error: e3 } = await db.from("host_applications").update({ status: decision, note, host_id, decided_at: new Date().toISOString(), decided_by: who.user.email }).eq("id", id);
    if (e3) return json({ error: e3.message }, 500);
    return json({ ok: true, host_id });
  }

  if (b.action === "verifyHost") {
    const { error } = await db.from("hosts").update({ verified: true }).eq("id", String(b.id ?? ""));
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  return json({ error: "unknown action" }, 400);
});

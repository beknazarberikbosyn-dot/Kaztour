// Samruk Travel · a guesthouse or café owner applies to offer facilities to park visitors.
// The owner sends who they are (IIN or BIN), the place, and their right to the property
// (cadastral number, the eGov certificate of registered rights, a scan of the document).
// This function checks what can be checked automatically, keeps the scan in a private bucket
// and files the application for the park office. Nothing here is readable by the browser:
// the applicant gets back an id and a private token to ask for the status.
//   POST {action:"submit", owner, place, right, doc, consent}  -> {id, token, checks}
//   POST {action:"status", id, token}                          -> {status, note, host_id}
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const PARKS: Record<string, [number, number]> = {
  kolsai: [42.9958, 78.3282], charyn: [43.3545, 79.0805], bigalmaty: [43.0532, 76.9848],
  burabay: [53.0815, 70.2645], altynemel: [43.87, 78.5605],
};
const SVC = ["toilet", "shower", "water", "charge", "wifi", "parking", "meal"];
const DOC_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/* Kazakhstan IIN / BIN: 12 digits, the last one is a check digit (two weight rounds, mod 11) */
export function idCheck(v: string): { ok: boolean; kind: "iin" | "bin" | null } {
  if (!/^\d{12}$/.test(v)) return { ok: false, kind: null };
  const d = [...v].map(Number);
  let s = d.slice(0, 11).reduce((a, x, i) => a + x * (i + 1), 0) % 11;
  if (s === 10) s = d.slice(0, 11).reduce((a, x, i) => a + x * ((i + 2) % 11 + 1), 0) % 11;
  if (s === 10 || s !== d[11]) return { ok: false, kind: null };
  if ([4, 5, 6].includes(d[4])) return { ok: true, kind: "bin" };          // legal entity: 5th digit is its type
  const mm = +v.slice(2, 4), dd = +v.slice(4, 6);                          // person: YYMMDD, then century and sex
  return { ok: mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && d[6] >= 1 && d[6] <= 6, kind: "iin" };
}
/* cadastral number of a land plot or building: region:district:quarter:plot, an optional part after it */
const CADASTRE = /^\d{2}:\d{3}:\d{3}:\d{1,5}(:\d{1,4}(\/\d{1,4})?)?$/;
const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180, x = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r), y = (b[0] - a[0]) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
const rnd = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  if (b.action === "status") {
    const { data, error } = await db.from("host_applications").select("status, note, host_id, token").eq("id", str(b.id, 40)).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data || data.token !== str(b.token, 64)) return json({ error: "not found" }, 404);
    return json({ status: data.status, note: data.note, host_id: data.host_id });
  }
  if (b.action !== "submit") return json({ error: "unknown action" }, 400);

  const o = b.owner ?? {}, p = b.place ?? {}, r = b.right ?? {}, doc = b.doc ?? {};
  const owner = { name: str(o.name, 80), phone: str(o.phone, 20), id: str(o.id, 12), kind: str(o.kind, 10) };
  const lat = Number(p.lat), lng = Number(p.lng), park = str(p.park, 20);
  const svc: Record<string, { p: number; open: boolean }> = {};
  for (const k of SVC) if (p.svc?.[k]) svc[k] = { p: Math.max(0, Math.min(100000, Math.round(Number(p.svc[k].p) || 0))), open: true };
  const place = { name: str(p.name, 60), type: str(p.type, 20), park, village: str(p.village, 60), hours: str(p.hours, 20), lat, lng, svc };
  const right = { basis: str(r.basis, 10), cadastre: str(r.cadastre, 30), cert_no: str(r.certNo, 40), cert_date: str(r.certDate, 10) };

  const idc = idCheck(owner.id);
  const dist = PARKS[park] && Number.isFinite(lat) && Number.isFinite(lng) ? km(PARKS[park], [lat, lng]) : Infinity;
  const ext = DOC_TYPES[str(doc.type, 40)];
  const bytes = typeof doc.data === "string" ? Math.floor(doc.data.length * 3 / 4) : 0;
  const errors: string[] = [];
  if (owner.name.length < 3) errors.push("name");
  if (!/^\+?[0-9 ()-]{6,20}$/.test(owner.phone)) errors.push("phone");
  if (!idc.ok) errors.push("iin");
  if (!["person", "ip", "too"].includes(owner.kind) || (owner.kind === "too") !== (idc.kind === "bin")) errors.push("kind");
  if (place.name.length < 2 || !PARKS[park] || !Object.keys(svc).length) errors.push("place");
  if (!(dist <= 50)) errors.push("distance");   // the place must serve visitors of this park
  if (!["own", "lease", "use"].includes(right.basis)) errors.push("basis");
  if (!CADASTRE.test(right.cadastre)) errors.push("cadastre");
  if (right.cert_date && !/^\d{4}-\d{2}-\d{2}$/.test(right.cert_date)) errors.push("cert_date");
  if (!ext || !bytes || bytes > 4_500_000) errors.push("document");
  if (b.consent !== true) errors.push("consent");
  if (errors.length) return json({ error: "check the form", fields: errors }, 422);

  const id = "a" + Date.now().toString(36) + rnd(4), token = rnd(24);
  const path = `${id}/right-document.${ext}`;
  const file = Uint8Array.from(atob(doc.data), (c) => c.charCodeAt(0));
  const up = await db.storage.from("host-docs").upload(path, file, { contentType: str(doc.type, 40), upsert: false });
  if (up.error) return json({ error: up.error.message }, 500);

  const checks = {
    id_valid: true, id_kind: idc.kind, cadastre_format: true, document: true, km_to_park: Math.round(dist * 10) / 10,
    registry: "manual", // a real version asks the land registry (EGKN) by cadastral number and eGov by IIN / BIN
  };
  const { error } = await db.from("host_applications").insert({
    id, token, status: "new", owner_name: owner.name, phone: owner.phone, iin: owner.id, owner_kind: owner.kind,
    place, basis: right.basis, cadastre: right.cadastre, cert_no: right.cert_no || null, cert_date: right.cert_date || null,
    doc_path: path, doc_name: str(doc.name, 120), checks,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ id, token, checks });
});

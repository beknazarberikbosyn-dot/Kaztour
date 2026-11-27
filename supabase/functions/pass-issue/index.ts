// Samruk Travel · issue a facility pass signed by the server.
// The visitor's phone asks for a pass; this function reads the host's current price from the database,
// signs the pass with the server's private key (ECDSA P-256) and stores it. The site holds only the
// public key, so a host can check a pass with no signal, and nobody can make a valid pass in the browser.
// Payment: a real version creates a Kaspi or card payment here and issues the pass from the payment webhook.
// Secrets: PASS_SIGN_KEY (the private key as a JWK, made by supabase/make-pass-key.mjs).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SVC = ["toilet", "shower", "water", "charge", "wifi", "parking", "meal"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const b64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let keyP: Promise<CryptoKey> | null = null;
function signKey() {
  if (!keyP) {
    const jwk = JSON.parse(Deno.env.get("PASS_SIGN_KEY") ?? "null");
    if (!jwk) throw new Error("PASS_SIGN_KEY is not set");
    keyP = crypto.subtle.importKey("jwk", { ...jwk, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  return keyP;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: { host?: string; svc?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const host = String(body.host ?? ""), svc = String(body.svc ?? "");
  if (!/^[a-z0-9-]{3,40}$/.test(host) || !SVC.includes(svc)) return json({ error: "bad host or facility" }, 400);

  const { data: h, error } = await db.from("hosts").select("id, svc, verified").eq("id", host).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const s = h?.svc?.[svc];
  if (!h || !s) return json({ error: "this place does not offer it" }, 404);
  if (s.open === false) return json({ error: "closed now" }, 409);
  const price = Math.max(0, Math.round(Number(s.p) || 0));

  const id = "p" + Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5);
  const ts = Date.now();
  const msg = new TextEncoder().encode(`SRPASS2|${id}|${host}|${svc}|${price}|${ts}`);
  let sig: string;
  try { sig = b64u(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signKey(), msg)); }
  catch (e) { return json({ error: String((e as Error).message) }, 500); }

  const { error: e2 } = await db.from("passes").insert({ id, host, svc, price, ts, sig, status: "paid" });
  if (e2) return json({ error: e2.message }, 500);
  return json({ id, host, svc, price, ts, sig, status: "paid" });
});

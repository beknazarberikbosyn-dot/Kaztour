// Makes the key pair that signs facility passes. Run once: node supabase/make-pass-key.mjs
// 1) the private key goes to the server only:  supabase secrets set PASS_SIGN_KEY='<private JSON>'
// 2) the public key goes into assets/parks/config.js as passPublicKey; it can only check passes, not make them.
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const priv = await subtle.exportKey("jwk", kp.privateKey), pub = await subtle.exportKey("jwk", kp.publicKey);
console.log("PASS_SIGN_KEY (secret, server only):\n" + JSON.stringify({ kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y, d: priv.d }));
console.log("\npassPublicKey (public, for config.js):\n" + JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));

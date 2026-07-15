// IMFine — send a NATIVE iOS push DIRECTLY to Apple (APNs) using a .p8 key.
// No Firebase needed for iOS: the Capacitor push plugin gives us an APNs token,
// and this talks straight to Apple with your APNs auth key.
import { createSign } from "node:crypto";
import http2 from "node:http2";

const BUNDLE_ID = "com.imfine.app";

// Apple JWT: valid up to 1 hour; cache it between invocations.
let cachedToken = null;
let cachedAt = 0;
function appleAuthToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedAt < 3000) return cachedToken;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  let p8 = process.env.APNS_P8 || "";
  // Allow the key to be pasted with literal \n sequences.
  p8 = p8.replace(/\\n/g, "\n").trim();

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: teamId, iat: now })}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  const sig = signer.sign({ key: p8, dsaEncoding: "ieee-p1363" }).toString("base64url");

  cachedToken = `${unsigned}.${sig}`;
  cachedAt = now;
  return cachedToken;
}

function sendToApns(host, deviceToken, payload, jwt) {
  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", (e) => resolve({ ok: false, error: e.message }));

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0, body = "";
    req.on("response", (h) => { status = h[":status"]; });
    req.setEncoding("utf8");
    req.on("data", (d) => { body += d; });
    req.on("end", () => { client.close(); resolve({ ok: status === 200, status, body }); });
    req.on("error", (e) => { try { client.close(); } catch (_) {} resolve({ ok: false, error: e.message }); });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      hint: "IMFine native iOS push (direct APNs) is live.",
      configured: !!(process.env.APNS_P8 && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID),
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-imfine-secret"] || "") !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { token, title, body } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });

    const jwt = appleAuthToken();
    const payload = {
      aps: {
        alert: { title: title || "IMFine", body: body || "" },
        sound: "default",
        badge: 1,
      },
    };

    // Xcode builds use the sandbox; TestFlight/App Store use production.
    // Try production first, fall back to sandbox (covers both automatically).
    let r = await sendToApns("api.push.apple.com", token, payload, jwt);
    if (!r.ok) {
      const r2 = await sendToApns("api.sandbox.push.apple.com", token, payload, jwt);
      if (r2.ok) return res.status(200).json({ ok: true, env: "sandbox" });
      return res.status(200).json({ ok: false, production: r, sandbox: r2 });
    }
    return res.status(200).json({ ok: true, env: "production" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "APNs send failed" });
  }
}

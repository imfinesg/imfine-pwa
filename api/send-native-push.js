// IMFine — send a NATIVE push to iOS or Android.
//   iOS     -> straight to Apple (APNs) using your .p8 key
//   Android -> via Firebase Cloud Messaging (FCM) using your service account
// The caller passes { token, platform, title, body }.
import { createSign } from "node:crypto";
import http2 from "node:http2";

const BUNDLE_ID = "com.imfine.app";

/* ---------------- iOS: direct APNs ---------------- */
let appleTok = null, appleAt = 0;
function appleAuthToken() {
  const now = Math.floor(Date.now() / 1000);
  if (appleTok && now - appleAt < 3000) return appleTok;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const p8 = (process.env.APNS_P8 || "").replace(/\\n/g, "\n").trim();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: teamId, iat: now })}`;
  const s = createSign("SHA256");
  s.update(unsigned);
  const sig = s.sign({ key: p8, dsaEncoding: "ieee-p1363" }).toString("base64url");
  appleTok = `${unsigned}.${sig}`;
  appleAt = now;
  return appleTok;
}
function sendApns(host, deviceToken, payload, jwt) {
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

/* ---------------- Android: FCM ---------------- */
async function fcmAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const s = createSign("RSA-SHA256");
  s.update(unsigned);
  const jwt = `${unsigned}.${s.sign(sa.private_key).toString("base64url")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("FCM token error: " + JSON.stringify(j));
  return j.access_token;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      hint: "IMFine native push (iOS via APNs, Android via FCM).",
      ios_configured: !!(process.env.APNS_P8 && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID),
      android_configured: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-imfine-secret"] || "") !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { token, title, body, platform } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });

    /* ----- Android ----- */
    if (platform === "android") {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const at = await fcmAccessToken(sa);
      const r = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: title || "IMFine", body: body || "" },
              android: {
                priority: "high",
                notification: { sound: "default", channel_id: "imfine_alerts" },
              },
            },
          }),
        }
      );
      const out = await r.json();
      if (!r.ok) return res.status(200).json({ ok: false, platform: "android", error: out });
      return res.status(200).json({ ok: true, platform: "android", id: out.name });
    }

    /* ----- iOS (default) ----- */
    const jwt = appleAuthToken();
    const payload = {
      aps: { alert: { title: title || "IMFine", body: body || "" }, sound: "default", badge: 1 },
    };
    let r = await sendApns("api.push.apple.com", token, payload, jwt);
    if (!r.ok) {
      const r2 = await sendApns("api.sandbox.push.apple.com", token, payload, jwt);
      if (r2.ok) return res.status(200).json({ ok: true, platform: "ios", env: "sandbox" });
      return res.status(200).json({ ok: false, platform: "ios", production: r, sandbox: r2 });
    }
    return res.status(200).json({ ok: true, platform: "ios", env: "production" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Push failed" });
  }
}

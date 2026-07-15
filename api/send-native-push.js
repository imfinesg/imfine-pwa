// IMFine — send a NATIVE push (iOS/Android) via Firebase Cloud Messaging.
// Called by the rescue clock via pg_net. Uses a Firebase service account.
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

// Build a Google OAuth token from the service-account JSON (no SDK needed).
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(claim)}`;

  const { createSign } = await import("node:crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key).toString("base64url");
  const jwt = `${unsigned}.${signature}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Token error: " + JSON.stringify(j));
  return j.access_token;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      hint: "IMFine native push is live.",
      configured: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-imfine-secret"] || "") !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { token, title, body } = req.body || {};
    if (!token) return res.status(400).json({ error: "Missing token" });

    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getAccessToken(sa);

    const r = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: title || "IMFine", body: body || "" },
            apns: {
              payload: { aps: { sound: "default", badge: 1 } },
            },
          },
        }),
      }
    );
    const out = await r.json();
    if (!r.ok) return res.status(200).json({ ok: false, error: out });
    return res.status(200).json({ ok: true, id: out.name });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Native push failed" });
  }
}

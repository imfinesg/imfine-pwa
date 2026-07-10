// IMFine — send a browser push notification to one subscription.
// Called by the rescue clock (Supabase) via pg_net, using web-push + VAPID.
import webpush from "web-push";

const APP_URL = "https://imfine-pwa.vercel.app/";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:imfine-admin@ymailzone.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", hint: "IMFine push function is live." });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-imfine-secret"] || "") !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const b = req.body || {};
    const subscription = b.subscription;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Missing subscription" });
    }
    const payload = JSON.stringify({
      title: b.title || "IMFine",
      body: b.body || "",
      url: b.url || APP_URL,
    });

    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ ok: true });
  } catch (e) {
    // 404/410 = the subscription is gone (user cleared it). Report, don't crash.
    const gone = e.statusCode === 404 || e.statusCode === 410;
    return res.status(200).json({ ok: false, expired: gone, error: e.message });
  }
}

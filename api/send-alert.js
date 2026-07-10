// IMFine — email a Guardian an ALERT when a senior misses their check-in.
// Called by the rescue clock (Supabase pg_cron) via pg_net.
import nodemailer from "nodemailer";

const APP_URL = "https://imfine-pwa.vercel.app/";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", hint: "IMFine alert function is live." });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.headers["x-imfine-secret"] || "") !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const b = req.body || {};
    const guardianName = b.guardianName || "there";
    const email = b.email;
    const seniorName = b.seniorName || "Your family member";
    const place = b.place || null;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    const locLine = place ? `\nLast known location: ${place}` : "";
    const text =
`Hi ${guardianName},

${seniorName} has NOT completed their daily IMFine check-in today, and did not respond to reminders.

This may be nothing — but please try to reach them now to make sure they're okay.${locLine}

Open IMFine: ${APP_URL}

— IMFine`;

    const html =
`<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
  <div style="background:#ef4444;border-radius:20px;padding:22px;text-align:center;color:#fff">
    <div style="font-size:22px;font-weight:800">⚠️ Missed check-in</div>
  </div>
  <p style="font-size:16px">Hi ${guardianName},</p>
  <p style="font-size:16px"><b>${seniorName}</b> has not completed their daily IMFine check-in today, and did not respond to reminders.</p>
  <p style="font-size:16px">This may be nothing — but please try to reach them now to make sure they're okay.</p>
  ${place ? `<div style="background:#fee2e2;border:1px solid #fecaca;border-radius:12px;padding:12px;font-size:14px"><b>Last known location:</b> ${place}</div>` : ""}
  <div style="text-align:center;margin:22px 0">
    <a href="${APP_URL}" style="background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px;display:inline-block">Open IMFine</a>
  </div>
</div>`;

    await transporter.sendMail({
      from: `"IMFine Alerts" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `⚠️ ${seniorName} hasn't checked in on IMFine`,
      text, html,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Send failed" });
  }
}

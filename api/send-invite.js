// IMFine — send a Guardian their linking code by email (via Gmail SMTP).
// Triggered by a Supabase Database Webhook on INSERT into "guardians".
// Runs on Vercel (Node). Secrets come from Vercel Environment Variables.
import nodemailer from "nodemailer";

const APP_URL = "https://imfine-pwa.vercel.app/";

export default async function handler(req, res) {
  // Simple health check so you can confirm the function deployed:
  if (req.method === "GET") {
    return res.status(200).json({ status: "ok", hint: "IMFine email function is live." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Only accept calls that carry our shared secret (set on the Supabase webhook).
  if ((req.headers["x-imfine-secret"] || "") !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const rec = (req.body && req.body.record) || {};
    const name = rec.name || "there";
    const email = rec.email;
    const code = rec.link_code;
    if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    const text =
`Hi ${name},

A family member has added you as their Guardian on IMFine — a simple daily check-in app.

Your linking code is: ${code}

To connect:
1. Open IMFine: ${APP_URL}
2. Choose "I'm a Guardian" and create your account.
3. Enter the code above.

Once linked, you'll be alerted if they ever miss their daily check-in.

— The IMFine team`;

    const html =
`<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
  <div style="background:linear-gradient(135deg,#34d399,#059669);border-radius:20px;padding:22px;text-align:center;color:#fff">
    <div style="font-size:22px;font-weight:800">IMFine</div>
    <div style="opacity:.9;font-size:14px">One tap a day. Someone always knows you're okay.</div>
  </div>
  <p style="font-size:16px">Hi ${name},</p>
  <p style="font-size:16px">A family member has added you as their <b>Guardian</b> on IMFine. You'll be alerted if they ever miss their daily check-in.</p>
  <p style="font-size:14px;color:#475569;margin-bottom:6px">Your linking code:</p>
  <div style="font-family:monospace;font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;background:#ecfdf5;border:2px dashed #a7f3d0;border-radius:14px;padding:16px;color:#059669">${code}</div>
  <div style="text-align:center;margin:22px 0">
    <a href="${APP_URL}" style="background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:14px;display:inline-block">Open IMFine &amp; link</a>
  </div>
  <ol style="font-size:14px;color:#475569">
    <li>Open IMFine and choose <b>"I'm a Guardian."</b></li>
    <li>Create your account.</li>
    <li>Enter the code above.</li>
  </ol>
  <p style="font-size:12px;color:#94a3b8;margin-top:24px">If you weren't expecting this, you can ignore this email.</p>
</div>`;

    await transporter.sendMail({
      from: `"IMFine" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "You've been added as an IMFine Guardian",
      text,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Send failed" });
  }
}

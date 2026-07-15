// IMFine — create a Stripe Checkout session for Premium.
// Prices are defined here (no dashboard product needed). Test mode uses your
// test secret key; switch to the live key later with no code change.
import Stripe from "stripe";

const SUPABASE_URL  = "https://zsxhkszxnzabieivhsrb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzeGhrc3p4bnphYmllaXZoc3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDU0OTYsImV4cCI6MjA5OTIyMTQ5Nn0.osF22Nq9ApUPsSYYXSi_HUe8xX1xNLDKfFldlfVCar0";
const APP_URL = "https://imfine-pwa.vercel.app/";

const PLANS = {
  monthly: { amount: 299,  interval: "month", label: "IMFine Premium (Monthly)" },
  yearly:  { amount: 2499, interval: "year",  label: "IMFine Premium (Yearly)" },
};

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "ok", hint: "IMFine checkout is live." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Confirm the caller is a signed-in IMFine user.
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Not signed in" });
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
    });
    if (!ur.ok) return res.status(401).json({ error: "Invalid session" });
    const user = await ur.json();

    const { plan = "monthly", seniorId } = req.body || {};
    const p = PLANS[plan];
    if (!p) return res.status(400).json({ error: "Unknown plan" });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const target = seniorId || user.id; // who gets Premium (self, or a senior the payer supports)

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: "sgd",
          product_data: { name: p.label },
          unit_amount: p.amount,
          recurring: { interval: p.interval },
        },
        quantity: 1,
      }],
      customer_email: user.email,
      metadata: { senior_id: target, payer_user_id: user.id, plan },
      subscription_data: { metadata: { senior_id: target, payer_user_id: user.id, plan } },
      success_url: APP_URL + "return.html",
      cancel_url: APP_URL + "return.html?cancelled=1",
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Checkout failed" });
  }
}

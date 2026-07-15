// IMFine — open Stripe's Customer Portal so a payer can manage or cancel
// their subscription. Stripe hosts the page; cancellation flows back through
// the existing webhook, which sets the senior's plan to 'free'.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://zsxhkszxnzabieivhsrb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzeGhrc3p4bnphYmllaXZoc3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NDU0OTYsImV4cCI6MjA5OTIyMTQ5Nn0.osF22Nq9ApUPsSYYXSi_HUe8xX1xNLDKfFldlfVCar0";
const APP_URL = "https://imfine-pwa.vercel.app/";

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "ok", hint: "IMFine billing portal is live." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ error: "Not signed in" });
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON },
    });
    if (!ur.ok) return res.status(401).json({ error: "Invalid session" });
    const user = await ur.json();

    const supa = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    // Find a subscription this person either owns or pays for.
    const { data: sub } = await supa
      .from("subscriptions")
      .select("stripe_customer_id")
      .or(`senior_id.eq.${user.id},payer_user_id.eq.${user.id}`)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub || !sub.stripe_customer_id) {
      return res.status(200).json({ error: "No subscription found for this account." });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: APP_URL,
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Portal failed" });
  }
}

// IMFine — Stripe webhook: unlock Premium on payment, revert on cancel.
// Verified two ways: (1) a secret token in the URL, and (2) we re-fetch the
// object straight from Stripe by ID, so a forged event can't grant Premium.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zsxhkszxnzabieivhsrb.supabase.co";

export default async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ status: "ok", hint: "IMFine Stripe webhook is live." });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if ((req.query.token || "") !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supa = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  async function setPlan(seniorId, plan) {
    if (!seniorId) return;
    await supa.from("senior_settings").update({ plan }).eq("senior_id", seniorId);
  }
  async function saveSub(row) {
    const { data: existing } = await supa.from("subscriptions")
      .select("id").eq("stripe_subscription_id", row.stripe_subscription_id).maybeSingle();
    if (existing) await supa.from("subscriptions").update(row).eq("id", existing.id);
    else await supa.from("subscriptions").insert(row);
  }

  try {
    const event = req.body || {};
    const type = event.type;

    if (type === "checkout.session.completed") {
      // Re-fetch from Stripe to confirm it's genuine.
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      if (session.payment_status === "paid" || session.status === "complete") {
        const seniorId = session.metadata?.senior_id;
        const payerId  = session.metadata?.payer_user_id;
        await setPlan(seniorId, "premium");
        await saveSub({
          senior_id: seniorId,
          payer_user_id: payerId || null,
          stripe_customer_id: session.customer || null,
          stripe_subscription_id: session.subscription || null,
          status: "active",
        });
      }
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = await stripe.subscriptions.retrieve(event.data.object.id);
      const seniorId = sub.metadata?.senior_id;
      const active = sub.status === "active" || sub.status === "trialing";
      await setPlan(seniorId, active ? "premium" : "free");
      await saveSub({
        senior_id: seniorId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString() : null,
      });
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Webhook error" });
  }
}

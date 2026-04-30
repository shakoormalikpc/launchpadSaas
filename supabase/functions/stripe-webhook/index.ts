import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const JSON_HEADERS = { "Content-Type": "application/json" };

Deno.serve(async (req: Request): Promise<Response> => {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return new Response(
      JSON.stringify({ error: `Webhook signature verification failed: ${message}` }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const HANDLED = new Set([
    "checkout.session.completed",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.payment_succeeded",
  ]);

  if (!HANDLED.has(event.type)) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ── checkout.session.completed ───────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { org_id, bundle_id, quantity: quantityStr, subscription_type } =
      session.metadata ?? {};

    if (!org_id || !bundle_id || !quantityStr) {
      return new Response(JSON.stringify({ error: "Missing required metadata fields" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 1) {
      return new Response(JSON.stringify({ error: "Invalid quantity in metadata" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    // 1. Record purchase (non-blocking)
    try {
      const { error: purchaseError } = await supabase.from("purchases").insert({
        org_id,
        bundle_id,
        seats_purchased: quantity,
        amount_paid: (session.amount_total ?? 0) / 100,
        stripe_payment_id: session.id,
      });
      if (purchaseError) {
        console.error("stripe-webhook: purchases insert failed (non-fatal):", purchaseError.message);
      }
    } catch (err) {
      console.error("stripe-webhook: unexpected error on purchases insert (non-fatal):", err);
    }

    // 2. Increment total_seats on the org (with fallback)
    const { error: orgError } = await supabase.rpc("increment_total_seats", {
      org_id_param: org_id,
      seats_to_add: quantity,
    });

    if (orgError) {
      const { data: org, error: fetchError } = await supabase
        .from("organizations")
        .select("total_seats")
        .eq("id", org_id)
        .maybeSingle();

      if (fetchError || !org) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch organization: ${fetchError?.message ?? "not found"}` }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      const { error: updateError } = await supabase
        .from("organizations")
        .update({ total_seats: org.total_seats + quantity })
        .eq("id", org_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: `Failed to update seats: ${updateError.message}` }),
          { status: 500, headers: JSON_HEADERS }
        );
      }
    }

    // 3. Compute expires_at for license rows
    const now = new Date();
    let expiresAt: Date;
    if (subscription_type === "summer_camp") {
      expiresAt = new Date(now.getTime() + 6 * 7 * 24 * 60 * 60 * 1000); // 6 weeks
    } else {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 10); // 10 months
    }

    // 4. Insert license rows (non-blocking)
    try {
      const licenseRows = Array.from({ length: quantity }, () => ({
        org_id,
        bundle_id,
        is_active: false,
        subscription_type: subscription_type ?? "academic_year",
        expires_at: expiresAt.toISOString(),
      }));

      const { error: licenseError } = await supabase.from("licenses").insert(licenseRows);
      if (licenseError) {
        console.error(
          "stripe-webhook: licenses bulk insert failed (non-fatal):",
          licenseError.message
        );
      }
    } catch (err) {
      console.error("stripe-webhook: unexpected error on licenses insert (non-fatal):", err);
    }

    // 5. For subscription mode: store Stripe IDs and set status on org
    if (session.mode === "subscription" && session.subscription && session.customer) {
      const { error: subErr } = await supabase
        .from("organizations")
        .update({
          stripe_customer_id: String(session.customer),
          stripe_subscription_id: String(session.subscription),
          subscription_status: "active",
        })
        .eq("id", org_id);

      if (subErr) {
        console.error(
          "stripe-webhook: failed to store subscription info on org (non-fatal):",
          subErr.message
        );
      }
    }
  }

  // ── customer.subscription.deleted ────────────────────────────────────────
  // Fires when a subscription ends — either by natural cancel_at or admin cancellation.
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const orgId = subscription.metadata?.org_id;

    if (!orgId) {
      console.error("stripe-webhook: subscription.deleted missing org_id in metadata");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }

    // Graceful expiry: access runs to end of last paid period
    const gracefulExpiry = new Date(subscription.current_period_end * 1000).toISOString();

    await supabase
      .from("organizations")
      .update({ subscription_status: "cancelled" })
      .eq("id", orgId);

    // Bring forward expires_at only where it was originally further in the future
    const { error: licErr } = await supabase
      .from("licenses")
      .update({ expires_at: gracefulExpiry })
      .eq("org_id", orgId)
      .gt("expires_at", gracefulExpiry);

    if (licErr) {
      console.error(
        "stripe-webhook: failed to update license expiry on subscription deletion:",
        licErr.message
      );
    }
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | null)?.id;

    if (subscriptionId) {
      const { error } = await supabase
        .from("organizations")
        .update({ subscription_status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error(
          "stripe-webhook: failed to set org status to past_due:",
          error.message
        );
      }
    }
  }

  // ── invoice.payment_succeeded ─────────────────────────────────────────────
  // Fires for every successful monthly charge — reset status in case it was past_due.
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | null)?.id;

    if (subscriptionId) {
      const { error } = await supabase
        .from("organizations")
        .update({ subscription_status: "active" })
        .eq("stripe_subscription_id", subscriptionId);

      if (error) {
        console.error(
          "stripe-webhook: failed to reset org status to active:",
          error.message
        );
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
});

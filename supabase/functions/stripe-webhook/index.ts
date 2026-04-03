import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

Deno.serve(async (req: Request): Promise<Response> => {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${message}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { org_id, bundle_id, quantity: quantityStr } = session.metadata ?? {};

  if (!org_id || !bundle_id || !quantityStr) {
    return new Response(JSON.stringify({ error: "Missing required metadata fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const quantity = parseInt(quantityStr, 10);
  if (isNaN(quantity) || quantity < 1) {
    return new Response(JSON.stringify({ error: "Invalid quantity in metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // 1. Insert into purchases (non-blocking — failure here does not abort the webhook)
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

  // 2. Increment total_seats on the organization
  const { error: orgError } = await supabase.rpc("increment_total_seats", {
    org_id_param: org_id,
    seats_to_add: quantity,
  });

  if (orgError) {
    // Fallback: manual update if RPC doesn't exist yet
    const { data: org, error: fetchError } = await supabase
      .from("organizations")
      .select("total_seats")
      .eq("id", org_id)
      .maybeSingle();

    if (fetchError || !org) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch organization: ${fetchError?.message ?? "not found"}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ total_seats: org.total_seats + quantity })
      .eq("id", org_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: `Failed to update seats: ${updateError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 3. Insert (quantity) license rows (non-blocking — seats were already incremented above)
  try {
    const licenseRows = Array.from({ length: quantity }, () => ({
      org_id,
      bundle_id,
      is_active: false,
    }));

    const { error: licenseError } = await supabase.from("licenses").insert(licenseRows);
    if (licenseError) {
      console.error("stripe-webhook: licenses bulk insert failed (non-fatal):", licenseError.message);
    }
  } catch (err) {
    console.error("stripe-webhook: unexpected error on licenses insert (non-fatal):", err);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

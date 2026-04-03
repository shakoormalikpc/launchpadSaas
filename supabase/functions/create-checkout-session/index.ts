import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  org_id: string;
  bundle_id: string;
  quantity: number;
}

interface CourseBundle {
  id: string;
  name: string;
  price_per_seat: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { org_id, bundle_id, quantity }: RequestBody = await req.json();

    if (!org_id || !bundle_id || !quantity || quantity < 1) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid required fields: org_id, bundle_id, quantity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: bundle, error: bundleError } = await supabase
      .from("course_bundles")
      .select("id, name, price_per_seat")
      .eq("id", bundle_id)
      .maybeSingle();

    if (bundleError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch bundle: ${bundleError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bundle) {
      return new Response(
        JSON.stringify({ error: `Bundle not found: ${bundle_id}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedBundle = bundle as CourseBundle;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: typedBundle.name,
            },
            unit_amount: Math.round(typedBundle.price_per_seat * 100),
          },
          quantity,
        },
      ],
      metadata: {
        org_id,
        bundle_id,
        quantity: String(quantity),
      },
      success_url: `${appUrl}/admin-dashboard?payment=success`,
      cancel_url: `${appUrl}/admin-dashboard?payment=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

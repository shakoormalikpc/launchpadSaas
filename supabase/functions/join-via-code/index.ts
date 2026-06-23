import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  invite_code: string;
}

/**
 * Joins the authenticated (freshly signed-up) student to an organization bundle
 * via a per-bundle magic invite code.
 *
 * Runs with the service role so it can perform the privileged, atomic seat claim
 * that a student JWT cannot do under RLS. Stripe is never involved — access is
 * granted purely by the license row, so the payment gate is bypassed by design.
 *
 * Responses:
 *   200 { status: "joined" | "already_member", bundle_id }
 *   404 { error }  — invalid/unknown invite code
 *   409 { error }  — bundle is full (all seats consumed)
 *   401 { error }  — missing/invalid auth
 */
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
    const { invite_code }: RequestBody = await req.json();

    if (!invite_code || typeof invite_code !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing required field: invite_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ── Identify the caller from their JWT (the just-created student) ─────────
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.split(" ")[1] ?? "";
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated. Please sign in and retry." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Authenticated user has no email address." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve the code → (org_id, bundle_id) ───────────────────────────────
    const normalizedCode = invite_code.trim().toUpperCase();
    const { data: invite, error: inviteError } = await supabase
      .from("org_bundle_invites")
      .select("org_id, bundle_id")
      .eq("invite_code", normalizedCode)
      .maybeSingle();

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: `Failed to look up invite code: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "This invite link is invalid. Please check the link with your organization." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Atomic seat claim (locks the org row, checks seats, inserts license) ──
    const { data: result, error: claimError } = await supabase.rpc("claim_bundle_seat", {
      org_id_param: invite.org_id,
      bundle_id_param: invite.bundle_id,
      user_id_param: userId,
      student_email_param: userEmail,
    });

    if (claimError) {
      return new Response(
        JSON.stringify({ error: `Failed to claim seat: ${claimError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result === "full") {
      return new Response(
        JSON.stringify({
          error:
            "Registration failed. All available seats for this organization's bundle are completely filled.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up display names for the welcome popup (best-effort; non-fatal).
    const [{ data: org }, { data: bundle }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", invite.org_id).maybeSingle(),
      supabase.from("course_bundles").select("name").eq("id", invite.bundle_id).maybeSingle(),
    ]);

    // "joined" / "reactivated" / "already_member" — all grant access; only
    // "joined" consumed a seat.
    return new Response(
      JSON.stringify({
        status: result,
        bundle_id: invite.bundle_id,
        org_name: org?.name ?? null,
        bundle_name: bundle?.name ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

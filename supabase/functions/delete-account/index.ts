import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Must match the sentinel written in DemoSignUp.tsx / useStudentBundle.ts.
const DEMO_GROUP_NAME = "__demo__";

/**
 * Self-service account deletion for demo accounts.
 *
 * The caller is identified from their JWT (Authorization header). As a safety
 * guard this endpoint ONLY deletes accounts flagged as demo (group_name ===
 * "__demo__"), so it can never be used to remove licensed students or org
 * admins. It removes the user's app data, then the auth user itself.
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
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Identify the caller from their JWT.
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Safety guard: only demo accounts may self-delete through this endpoint.
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("group_name")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      return new Response(JSON.stringify({ error: "Could not verify account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile || profile.group_name !== DEMO_GROUP_NAME) {
      return new Response(
        JSON.stringify({ error: "Only demo accounts can be deleted here." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove the user's app data (best-effort — missing rows are fine).
    await admin.from("user_progress").delete().eq("user_id", userId);
    await admin.from("lesson_states").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // Finally, delete the auth user.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true }), {
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

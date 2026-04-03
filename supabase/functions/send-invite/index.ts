const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  student_email: string;
  org_name: string;
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
    const { student_email, org_name }: RequestBody = await req.json();

    if (!student_email || !org_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: student_email, org_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8080";
    const signupLink = `${appUrl}/signup?email=${encodeURIComponent(student_email)}`;

    // TODO: Replace with real email delivery (e.g. Resend) when ready.
    // const resendApiKey = Deno.env.get("RESEND_API_KEY");
    // await fetch("https://api.resend.com/emails", { ... });
    console.log("INVITE:", { student_email, org_name, signupLink });

    return new Response(JSON.stringify({ success: true, signupLink }), {
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

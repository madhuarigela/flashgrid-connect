import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type") || "all";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    if (!query) {
      return new Response(JSON.stringify({ users: [], hashtags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any = {};

    if (type === "all" || type === "users") {
      const { data: users } = await serviceClient
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, is_verified")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);
      results.users = users || [];
    }

    if (type === "all" || type === "hashtags") {
      const { data: hashtags } = await serviceClient
        .from("hashtags")
        .select("id, name, post_count")
        .ilike("name", `%${query}%`)
        .order("post_count", { ascending: false })
        .limit(limit);
      results.hashtags = hashtags || [];
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Search error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

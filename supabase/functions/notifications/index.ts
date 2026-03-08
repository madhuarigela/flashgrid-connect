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

    if (req.method === "GET") {
      const url = new URL(req.url);
      const cursor = url.searchParams.get("cursor");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 50);

      let query = serviceClient
        .from("notifications")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit + 1);

      if (cursor) {
        query = query.lt("created_at", cursor);
      }

      const { data: notifications, error } = await query;
      if (error) throw error;

      const hasMore = (notifications?.length || 0) > limit;
      const items = notifications?.slice(0, limit) || [];

      // Enrich with actor profiles
      const actorIds = [...new Set(items.map((n) => n.actor_id))];
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", actorIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const enriched = items.map((n) => ({
        ...n,
        actor: profileMap.get(n.actor_id) || null,
      }));

      // Unread count
      const { count } = await serviceClient
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("read", false);

      return new Response(
        JSON.stringify({
          notifications: enriched,
          hasMore,
          nextCursor: items.length > 0 ? items[items.length - 1].created_at : null,
          unread_count: count || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const { action, notification_ids } = await req.json();

      if (action === "mark_read") {
        if (notification_ids && notification_ids.length > 0) {
          await serviceClient
            .from("notifications")
            .update({ read: true })
            .eq("recipient_id", user.id)
            .in("id", notification_ids);
        } else {
          // Mark all as read
          await serviceClient
            .from("notifications")
            .update({ read: true })
            .eq("recipient_id", user.id)
            .eq("read", false);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notifications error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
    const type = url.searchParams.get("type") || "users";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    if (type === "users") {
      // Get users current user follows
      const { data: following } = await serviceClient
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followingIds = new Set(following?.map((f) => f.following_id) || []);
      followingIds.add(user.id);

      // Find mutual followers (users followed by people you follow)
      const { data: mutualCandidates } = await serviceClient
        .from("follows")
        .select("following_id, follower_id")
        .in("follower_id", [...followingIds].filter((id) => id !== user.id))
        .limit(200);

      const candidateScores = new Map<string, { score: number; reason: string }>();
      for (const mc of mutualCandidates || []) {
        if (followingIds.has(mc.following_id)) continue;
        const existing = candidateScores.get(mc.following_id) || { score: 0, reason: "mutual_followers" };
        existing.score += 5;
        candidateScores.set(mc.following_id, existing);
      }

      // Add interaction-based recommendations
      const { data: interactions } = await serviceClient
        .from("user_interactions")
        .select("target_user_id, interaction_count")
        .eq("user_id", user.id)
        .order("interaction_count", { ascending: false })
        .limit(50);

      for (const i of interactions || []) {
        // Find who these people interact with
        const { data: theirInteractions } = await serviceClient
          .from("user_interactions")
          .select("target_user_id, interaction_count")
          .eq("user_id", i.target_user_id)
          .limit(10);

        for (const ti of theirInteractions || []) {
          if (followingIds.has(ti.target_user_id)) continue;
          const existing = candidateScores.get(ti.target_user_id) || { score: 0, reason: "similar_interests" };
          existing.score += ti.interaction_count;
          candidateScores.set(ti.target_user_id, existing);
        }
      }

      // Sort and fetch profiles
      const sorted = [...candidateScores.entries()]
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, limit);

      if (sorted.length === 0) {
        // Fallback: popular users
        const { data: popular } = await serviceClient
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, is_verified")
          .not("user_id", "in", `(${[...followingIds].join(",")})`)
          .limit(limit);

        return new Response(
          JSON.stringify({ recommendations: popular || [], type: "popular" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const recUserIds = sorted.map(([id]) => id);
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, is_verified")
        .in("user_id", recUserIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
      const recommendations = sorted
        .map(([id, { score, reason }]) => ({
          ...profileMap.get(id),
          score,
          reason,
        }))
        .filter((r) => r.username);

      return new Response(
        JSON.stringify({ recommendations, type: "personalized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Recommendations error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

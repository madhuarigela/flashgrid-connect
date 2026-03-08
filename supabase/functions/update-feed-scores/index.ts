import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Feed Ranking Algorithm
// score = (recency_weight * time_decay) + (likes * 3) + (comments * 5) + (saves * 6) + relationship_score
function calculateScore(params: {
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  relationshipScore: number;
}): number {
  const ageHours = (Date.now() - new Date(params.createdAt).getTime()) / (1000 * 60 * 60);
  const recencyWeight = 10;
  const timeDecay = Math.max(0, 1 - ageHours / 168); // decay over 7 days

  return (
    recencyWeight * timeDecay +
    params.likesCount * 3 +
    params.commentsCount * 5 +
    params.savesCount * 6 +
    params.relationshipScore
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get recent feed items (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: feedItems } = await supabase
      .from("feed_items")
      .select("id, user_id, post_id, author_id, created_at")
      .gte("created_at", sevenDaysAgo)
      .limit(1000);

    if (!feedItems || feedItems.length === 0) {
      return new Response(JSON.stringify({ updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postIds = [...new Set(feedItems.map((fi) => fi.post_id))];

    // Get engagement counts
    const { data: posts } = await supabase
      .from("posts")
      .select("id, created_at, likes(id), comments(id)")
      .in("id", postIds);

    const { data: saves } = await supabase
      .from("saved_posts")
      .select("post_id")
      .in("post_id", postIds);

    const postEngagement = new Map<string, { likes: number; comments: number; saves: number; createdAt: string }>();
    for (const post of posts || []) {
      const saveCount = saves?.filter((s) => s.post_id === post.id).length || 0;
      postEngagement.set(post.id, {
        likes: post.likes?.length || 0,
        comments: post.comments?.length || 0,
        saves: saveCount,
        createdAt: post.created_at,
      });
    }

    // Get relationship scores
    const userAuthorPairs = feedItems.map((fi) => ({ user: fi.user_id, author: fi.author_id }));
    const uniqueUsers = [...new Set(userAuthorPairs.map((p) => p.user))];
    const { data: interactions } = await supabase
      .from("user_interactions")
      .select("user_id, target_user_id, interaction_count")
      .in("user_id", uniqueUsers);

    const interactionMap = new Map<string, number>();
    for (const i of interactions || []) {
      const key = `${i.user_id}:${i.target_user_id}`;
      interactionMap.set(key, (interactionMap.get(key) || 0) + i.interaction_count);
    }

    // Update scores
    let updated = 0;
    for (const fi of feedItems) {
      const engagement = postEngagement.get(fi.post_id);
      if (!engagement) continue;

      const relationshipKey = `${fi.user_id}:${fi.author_id}`;
      const relationshipScore = Math.min(interactionMap.get(relationshipKey) || 0, 50);

      const score = calculateScore({
        createdAt: engagement.createdAt,
        likesCount: engagement.likes,
        commentsCount: engagement.comments,
        savesCount: engagement.saves,
        relationshipScore,
      });

      await supabase.from("feed_items").update({ score }).eq("id", fi.id);
      updated++;
    }

    return new Response(JSON.stringify({ updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Score update error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

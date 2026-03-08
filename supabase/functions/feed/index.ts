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

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cursor-based pagination using score + created_at
    let query = serviceClient
      .from("feed_items")
      .select("post_id, author_id, score, created_at")
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit + 1); // fetch one extra to determine hasMore

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: feedItems, error: feedError } = await query;

    if (feedError) {
      console.error("Feed query error:", feedError);
      return new Response(JSON.stringify({ error: "Failed to fetch feed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasMore = (feedItems?.length || 0) > limit;
    const items = feedItems?.slice(0, limit) || [];
    const nextCursor = items.length > 0 ? items[items.length - 1].created_at : null;

    if (items.length === 0) {
      return new Response(JSON.stringify({ posts: [], hasMore: false, nextCursor: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postIds = items.map((i) => i.post_id);

    // Fetch posts with media, likes, comments
    const { data: posts } = await serviceClient
      .from("posts")
      .select(`
        id, caption, location, created_at, user_id,
        post_media(media_url, media_type, sort_order),
        likes(user_id),
        comments(id)
      `)
      .in("id", postIds);

    // Fetch author profiles
    const authorIds = [...new Set(items.map((i) => i.author_id))];
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, is_verified")
      .in("user_id", authorIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

    // Check saved posts
    const { data: savedData } = await serviceClient
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", postIds);
    const savedSet = new Set(savedData?.map((s) => s.post_id));

    // Map feed scores to posts
    const scoreMap = new Map(items.map((i) => [i.post_id, i.score]));

    const enrichedPosts = (posts || [])
      .map((post) => {
        const author = profileMap.get(post.user_id);
        return {
          id: post.id,
          caption: post.caption,
          location: post.location,
          created_at: post.created_at,
          score: scoreMap.get(post.id) || 0,
          user: {
            username: author?.username || "unknown",
            display_name: author?.display_name || null,
            avatar_url: author?.avatar_url || null,
            is_verified: author?.is_verified || false,
          },
          media: (post.post_media || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
          likes_count: post.likes?.length || 0,
          comments_count: post.comments?.length || 0,
          is_liked: post.likes?.some((l: any) => l.user_id === user.id) || false,
          is_saved: savedSet.has(post.id),
        };
      })
      .sort((a, b) => (b.score as number) - (a.score as number));

    return new Response(
      JSON.stringify({ posts: enrichedPosts, hasMore, nextCursor }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Feed error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

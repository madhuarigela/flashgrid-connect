import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeedPost {
  id: string;
  caption: string | null;
  location: string | null;
  created_at: string;
  user: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
  media: { media_url: string; media_type: string; sort_order: number }[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_saved: boolean;
}

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

export function useFeed() {
  const [state, setState] = useState<FeedState>({
    posts: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    error: null,
  });
  const cursorRef = useRef<string | null>(null);

  const fetchFeed = useCallback(async (isLoadMore = false) => {
    setState((prev) => ({
      ...prev,
      ...(isLoadMore ? { loadingMore: true } : { loading: true }),
    }));

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (isLoadMore && cursorRef.current) {
        params.set("cursor", cursorRef.current);
      }

      const { data, error } = await supabase.functions.invoke("feed", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });

      // Fallback: if edge function isn't deployed yet, use direct query
      if (error) {
        console.warn("Feed function not available, using fallback:", error);
        return fetchFeedFallback(isLoadMore);
      }

      const feedData = data as { posts: FeedPost[]; hasMore: boolean; nextCursor: string | null };
      cursorRef.current = feedData.nextCursor;

      setState((prev) => ({
        posts: isLoadMore ? [...prev.posts, ...feedData.posts] : feedData.posts,
        loading: false,
        loadingMore: false,
        hasMore: feedData.hasMore,
        error: null,
      }));
    } catch (err) {
      console.warn("Feed fetch error, using fallback:", err);
      return fetchFeedFallback(isLoadMore);
    }
  }, []);

  const fetchFeedFallback = async (isLoadMore = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ posts: [], loading: false, loadingMore: false, hasMore: false, error: null });
        return;
      }

      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = followingData?.map((f) => f.following_id) || [];
      const feedUserIds = [...followingIds, user.id];

      let query = supabase
        .from("posts")
        .select(`
          id, caption, location, created_at, user_id,
          post_media(media_url, media_type, sort_order),
          likes(user_id),
          comments(id)
        `)
        .in("user_id", feedUserIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (isLoadMore && cursorRef.current) {
        query = query.lt("created_at", cursorRef.current);
      }

      const { data: postsData } = await query;

      if (!postsData || postsData.length === 0) {
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          hasMore: false,
        }));
        return;
      }

      const userIds = [...new Set(postsData.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, is_verified")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const { data: savedData } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id);
      const savedSet = new Set(savedData?.map((s) => s.post_id));

      const feedPosts: FeedPost[] = postsData.map((post) => {
        const authorProfile = profileMap.get(post.user_id);
        return {
          id: post.id,
          caption: post.caption,
          location: post.location,
          created_at: post.created_at,
          user: {
            username: authorProfile?.username || "unknown",
            display_name: authorProfile?.display_name || null,
            avatar_url: authorProfile?.avatar_url || null,
            is_verified: authorProfile?.is_verified || false,
          },
          media: (post.post_media || []).sort((a, b) => a.sort_order - b.sort_order),
          likes_count: post.likes?.length || 0,
          comments_count: post.comments?.length || 0,
          is_liked: post.likes?.some((l) => l.user_id === user.id) || false,
          is_saved: savedSet.has(post.id),
        };
      });

      cursorRef.current = postsData[postsData.length - 1].created_at;

      setState((prev) => ({
        posts: isLoadMore ? [...prev.posts, ...feedPosts] : feedPosts,
        loading: false,
        loadingMore: false,
        hasMore: postsData.length === 20,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingMore: false,
        error: "Failed to load feed",
      }));
    }
  };

  const loadMore = useCallback(() => {
    if (!state.loadingMore && state.hasMore) {
      fetchFeed(true);
    }
  }, [state.loadingMore, state.hasMore, fetchFeed]);

  return { ...state, fetchFeed, loadMore };
}

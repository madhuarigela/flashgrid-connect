import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/posts/PostCard";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { Heart, Send, PlusSquare } from "lucide-react";
import flashgridLogo from "@/assets/flashgrid-logo.png";

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

export default function HomeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeed();
  }, [user]);

  const fetchFeed = async () => {
    if (!user) return;

    try {
      // Get posts from followed users + own posts
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = followingData?.map((f) => f.following_id) || [];
      const feedUserIds = [...followingIds, user.id];

      const { data: postsData } = await supabase
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

      if (!postsData) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Get profiles for post authors
      const userIds = [...new Set(postsData.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, is_verified")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      // Get saved posts
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

      setPosts(feedPosts);
    } catch (error) {
      console.error("Error fetching feed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) return;
    if (isLiked) {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    }
  };

  const handleSave = async (postId: string, isSaved: boolean) => {
    if (!user) return;
    if (isSaved) {
      await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
    } else {
      await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
    }
  };

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <img src={flashgridLogo} alt="FlashGrid" className="h-8 w-8" />
          <h1 className="font-display text-xl font-bold gradient-ig-text">FlashGrid</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/create")} className="tap-highlight-none">
            <PlusSquare className="h-6 w-6 text-foreground" />
          </button>
          <button className="tap-highlight-none relative">
            <Heart className="h-6 w-6 text-foreground" />
          </button>
          <button onClick={() => navigate("/messages")} className="tap-highlight-none">
            <Send className="h-6 w-6 text-foreground" />
          </button>
        </div>
      </header>

      {/* Stories Bar */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide border-b border-border px-4 py-3">
        <StoryAvatar
          imageUrl={profile?.avatar_url ?? undefined}
          username={profile?.username || "You"}
          isOwn
          size="md"
        />
        {/* Placeholder stories - will be populated from DB */}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <PlusSquare className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Welcome to FlashGrid!</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Follow people or create your first post to get started.
          </p>
          <button
            onClick={() => navigate("/explore")}
            className="text-sm font-semibold text-ig-blue"
          >
            Discover People
          </button>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={() => handleLike(post.id, post.is_liked)}
            onSave={() => handleSave(post.id, post.is_saved)}
            onProfileClick={() => navigate(`/user/${post.user.username}`)}
          />
        ))
      )}
    </div>
  );
}

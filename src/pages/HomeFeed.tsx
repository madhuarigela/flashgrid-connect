import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFeed } from "@/hooks/useFeed";
import { useNotifications } from "@/hooks/useNotifications";
import PostCard from "@/components/posts/PostCard";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { Heart, Send, PlusSquare } from "lucide-react";
import flashgridLogo from "@/assets/flashgrid-logo.png";

export default function HomeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { posts, loading, loadingMore, hasMore, fetchFeed, loadMore } = useFeed();
  const { unreadCount } = useNotifications();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (user) fetchFeed();
  }, [user, fetchFeed]);

  // Infinite scroll observer
  const lastPostRef = useCallback(
    (node: HTMLElement | null) => {
      if (loading || loadingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [loading, loadingMore, hasMore, loadMore]
  );

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
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
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
        <>
          {posts.map((post, index) => (
            <div
              key={post.id}
              ref={index === posts.length - 1 ? lastPostRef : undefined}
            >
              <PostCard
                post={post}
                onLike={() => handleLike(post.id, post.is_liked)}
                onSave={() => handleSave(post.id, post.is_saved)}
                onProfileClick={() => navigate(`/user/${post.user.username}`)}
              />
            </div>
          ))}
          {loadingMore && (
            <div className="flex items-center justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">You're all caught up! ✓</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

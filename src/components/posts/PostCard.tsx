import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: {
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
  };
  onLike?: () => void;
  onSave?: () => void;
  onComment?: () => void;
  onProfileClick?: () => void;
}

export default function PostCard({ post, onLike, onSave, onComment, onProfileClick }: PostCardProps) {
  const [liked, setLiked] = useState(post.is_liked);
  const [saved, setSaved] = useState(post.is_saved);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showHeart, setShowHeart] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleLike = () => {
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    onLike?.();
  };

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikesCount(likesCount + 1);
      onLike?.();
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 600);
  };

  const handleSave = () => {
    setSaved(!saved);
    onSave?.();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false });

  return (
    <article className="border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={onProfileClick} className="flex items-center gap-2 tap-highlight-none">
          <StoryAvatar
            imageUrl={post.user.avatar_url ?? undefined}
            username={post.user.username}
            size="sm"
            hasStory={false}
          />
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-foreground">{post.user.username}</span>
            {post.user.is_verified && (
              <svg className="h-3.5 w-3.5 text-ig-blue" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            )}
          </div>
          {post.location && (
            <span className="text-xs text-muted-foreground">• {post.location}</span>
          )}
        </button>
        <button className="post-action-btn text-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Media */}
      <div className="relative" onDoubleClick={handleDoubleTap}>
        {post.media.length > 0 ? (
          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-300"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {post.media.map((m, i) => (
                <div key={i} className="w-full flex-shrink-0">
                  {m.media_type === "video" ? (
                    <video src={m.media_url} className="w-full aspect-square object-cover" controls />
                  ) : (
                    <img src={m.media_url} alt="" className="w-full aspect-square object-cover" />
                  )}
                </div>
              ))}
            </div>
            {post.media.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                {post.media.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      i === currentSlide ? "bg-ig-blue" : "bg-foreground/30"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-square bg-secondary" />
        )}

        {/* Double tap heart */}
        {showHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart className="h-20 w-20 fill-primary-foreground text-primary-foreground animate-heart-burst drop-shadow-lg" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <button onClick={handleLike} className="post-action-btn">
            <Heart
              className={cn(
                "h-6 w-6 transition-all",
                liked ? "fill-destructive text-destructive animate-like-pop" : "text-foreground"
              )}
            />
          </button>
          <button onClick={onComment} className="post-action-btn">
            <MessageCircle className="h-6 w-6 text-foreground" />
          </button>
          <button className="post-action-btn">
            <Send className="h-6 w-6 text-foreground" />
          </button>
        </div>
        <button onClick={handleSave} className="post-action-btn">
          <Bookmark
            className={cn(
              "h-6 w-6 transition-all",
              saved ? "fill-foreground text-foreground" : "text-foreground"
            )}
          />
        </button>
      </div>

      {/* Likes count */}
      <div className="px-3">
        <p className="text-sm font-semibold text-foreground">
          {likesCount.toLocaleString()} {likesCount === 1 ? "like" : "likes"}
        </p>
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="px-3 pt-1">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{post.user.username}</span>{" "}
            {post.caption}
          </p>
        </div>
      )}

      {/* Comments preview */}
      {post.comments_count > 0 && (
        <button onClick={onComment} className="px-3 pt-1 tap-highlight-none">
          <p className="text-sm text-muted-foreground">
            View all {post.comments_count} comments
          </p>
        </button>
      )}

      {/* Timestamp */}
      <div className="px-3 py-2">
        <p className="text-[10px] uppercase text-muted-foreground">{timeAgo} ago</p>
      </div>
    </article>
  );
}

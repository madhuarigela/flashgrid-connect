import { useAuth } from "@/contexts/AuthContext";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface StoryAvatarProps {
  imageUrl?: string;
  username: string;
  hasStory?: boolean;
  seen?: boolean;
  size?: "sm" | "md" | "lg";
  isOwn?: boolean;
  onClick?: () => void;
}

export function StoryAvatar({
  imageUrl,
  username,
  hasStory = false,
  seen = false,
  size = "md",
  isOwn = false,
  onClick,
}: StoryAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-14 w-14",
    lg: "h-20 w-20",
  };

  const ringClasses = {
    sm: "p-[1.5px]",
    md: "p-[2px]",
    lg: "p-[3px]",
  };

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 tap-highlight-none">
      <div
        className={cn(
          "rounded-full",
          ringClasses[size],
          hasStory && !seen && "gradient-story-border",
          hasStory && seen && "bg-border",
          !hasStory && "bg-transparent p-0"
        )}
      >
        <div className={cn("rounded-full bg-background p-[2px]", !hasStory && "p-0")}>
          <div className={cn(sizeClasses[size], "rounded-full bg-secondary overflow-hidden relative")}>
            {imageUrl ? (
              <img src={imageUrl} alt={username} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground font-semibold text-xs">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwn && !hasStory && (
              <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-ig-blue flex items-center justify-center border-2 border-background">
                <span className="text-primary-foreground text-[10px] font-bold">+</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {size !== "sm" && (
        <span className="text-[11px] text-foreground max-w-[64px] truncate">
          {isOwn ? "Your story" : username}
        </span>
      )}
    </button>
  );
}

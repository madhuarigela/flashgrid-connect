import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { Grid3X3, Bookmark, UserSquare2, Settings, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: ownProfile } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<{ id: string; media_url: string }[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "tagged">("posts");
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !username || username === ownProfile?.username;
  const displayProfile = isOwnProfile ? ownProfile : profile;

  useEffect(() => {
    if (isOwnProfile && ownProfile) {
      loadProfileData(ownProfile.user_id);
    } else if (username) {
      loadExternalProfile(username);
    }
  }, [username, ownProfile, user]);

  const loadExternalProfile = async (uname: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", uname)
      .single();
    if (data) {
      setProfile(data);
      loadProfileData(data.user_id);
    } else {
      setLoading(false);
    }
  };

  const loadProfileData = async (userId: string) => {
    setLoading(true);

    const [postsRes, followersRes, followingRes, isFollowingRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, post_media(media_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("follows").select("id", { count: "exact" }).eq("following_id", userId),
      supabase.from("follows").select("id", { count: "exact" }).eq("follower_id", userId),
      user
        ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const postItems = (postsRes.data || []).map((p: any) => ({
      id: p.id,
      media_url: p.post_media?.[0]?.media_url || "",
    }));

    setPosts(postItems);
    setFollowersCount(followersRes.count || 0);
    setFollowingCount(followingRes.count || 0);
    setIsFollowing(!!isFollowingRes.data);
    setLoading(false);
  };

  const handleFollow = async () => {
    if (!user || !displayProfile) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", displayProfile.user_id);
      setIsFollowing(false);
      setFollowersCount((c) => c - 1);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: displayProfile.user_id });
      setIsFollowing(true);
      setFollowersCount((c) => c + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pb-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!displayProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pb-20">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[470px] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-2">
        {!isOwnProfile && (
          <button onClick={() => navigate(-1)} className="tap-highlight-none">
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        <h2 className="flex-1 text-center font-semibold text-foreground">{displayProfile.username}</h2>
        {isOwnProfile && (
          <button onClick={() => navigate("/settings")} className="tap-highlight-none">
            <Settings className="h-6 w-6 text-foreground" />
          </button>
        )}
      </header>

      {/* Profile info */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-6">
          <StoryAvatar
            imageUrl={displayProfile.avatar_url ?? undefined}
            username={displayProfile.username}
            size="lg"
          />
          <div className="flex flex-1 justify-around text-center">
            <div>
              <p className="text-lg font-semibold text-foreground">{posts.length}</p>
              <p className="text-xs text-muted-foreground">posts</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{followersCount}</p>
              <p className="text-xs text-muted-foreground">followers</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{followingCount}</p>
              <p className="text-xs text-muted-foreground">following</p>
            </div>
          </div>
        </div>

        {/* Name & Bio */}
        <div className="mt-3">
          {displayProfile.display_name && (
            <p className="text-sm font-semibold text-foreground">{displayProfile.display_name}</p>
          )}
          {displayProfile.bio && <p className="text-sm text-foreground mt-1">{displayProfile.bio}</p>}
          {displayProfile.website && (
            <a
              href={displayProfile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-ig-blue mt-1 block"
            >
              {displayProfile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          {isOwnProfile ? (
            <>
              <Button variant="ig-outline" size="sm" className="flex-1" onClick={() => navigate("/edit-profile")}>
                Edit profile
              </Button>
              <Button variant="ig-outline" size="sm" className="flex-1">
                Share profile
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={isFollowing ? "ig-outline" : "follow"}
                size="sm"
                className="flex-1"
                onClick={handleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button variant="ig-outline" size="sm" className="flex-1" onClick={() => navigate("/messages")}>
                Message
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-border">
        <button
          onClick={() => setActiveTab("posts")}
          className={cn(
            "flex-1 py-3 flex justify-center border-b-2 transition-colors tap-highlight-none",
            activeTab === "posts" ? "border-foreground" : "border-transparent text-muted-foreground"
          )}
        >
          <Grid3X3 className="h-5 w-5" />
        </button>
        {isOwnProfile && (
          <button
            onClick={() => setActiveTab("saved")}
            className={cn(
              "flex-1 py-3 flex justify-center border-b-2 transition-colors tap-highlight-none",
              activeTab === "saved" ? "border-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            <Bookmark className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => setActiveTab("tagged")}
          className={cn(
            "flex-1 py-3 flex justify-center border-b-2 transition-colors tap-highlight-none",
            activeTab === "tagged" ? "border-foreground" : "border-transparent text-muted-foreground"
          )}
        >
          <UserSquare2 className="h-5 w-5" />
        </button>
      </div>

      {/* Post Grid */}
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => navigate(`/post/${post.id}`)}
            className="aspect-square bg-secondary overflow-hidden tap-highlight-none"
          >
            {post.media_url ? (
              <img src={post.media_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-secondary" />
            )}
          </button>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Grid3X3 className="h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">No posts yet</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<{ id: string; media_url: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchTrending();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const timeout = setTimeout(() => searchUsers(searchQuery), 300);
      return () => clearTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchTrending = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, post_media(media_url)")
      .order("created_at", { ascending: false })
      .limit(30);

    const items = (data || []).map((p: any) => ({
      id: p.id,
      media_url: p.post_media?.[0]?.media_url || "",
    }));
    setTrendingPosts(items);
  };

  const searchUsers = async (query: string) => {
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(20);
    setSearchResults(data || []);
    setSearching(false);
  };

  return (
    <div className="mx-auto max-w-[470px] pb-20">
      {/* Search bar */}
      <div className="sticky top-0 z-40 bg-background px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchQuery.length > 1 ? (
        <div className="px-4">
          {searching ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            searchResults.map((profile) => (
              <button
                key={profile.id}
                onClick={() => navigate(`/user/${profile.username}`)}
                className="flex w-full items-center gap-3 py-2 tap-highlight-none"
              >
                <div className="h-11 w-11 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground font-semibold">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{profile.username}</p>
                  {profile.display_name && (
                    <p className="text-xs text-muted-foreground">{profile.display_name}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        /* Trending Grid */
        <div className="grid grid-cols-3 gap-[2px]">
          {trendingPosts.map((post, i) => {
            // Create Instagram-like explore grid with varying sizes
            const isLarge = i % 10 === 2 || i % 10 === 7;
            return (
              <button
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className={cn(
                  "bg-secondary overflow-hidden tap-highlight-none",
                  isLarge ? "row-span-2 col-span-1 aspect-[1/2]" : "aspect-square"
                )}
              >
                {post.media_url ? (
                  <img src={post.media_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-secondary" />
                )}
              </button>
            );
          })}
          {trendingPosts.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-16">
              <Search className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nothing to explore yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Camera } from "lucide-react";
import { toast } from "sonner";

export default function EditProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [website, setWebsite] = useState(profile?.website || "");
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        website: website || null,
        is_private: isPrivate,
      })
      .eq("user_id", profile.user_id);

    if (error) {
      toast.error(error.message);
    } else {
      await refreshProfile();
      toast.success("Profile updated!");
      navigate("/profile");
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const ext = file.name.split(".").pop();
    const path = `${profile.user_id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", profile.user_id);
    await refreshProfile();
    toast.success("Avatar updated!");
  };

  return (
    <div className="mx-auto max-w-[470px] min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="tap-highlight-none">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h2 className="font-semibold text-foreground">Edit Profile</h2>
        <Button variant="ghost" onClick={handleSave} disabled={saving}>
          <span className="text-ig-blue font-semibold">{saving ? "Saving..." : "Done"}</span>
        </Button>
      </header>

      <div className="p-4 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-secondary overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {profile?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-ig-blue p-1.5">
              <Camera className="h-3.5 w-3.5 text-primary-foreground" />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
          <p className="text-sm font-semibold text-ig-blue">Change profile photo</p>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Username</Label>
            <Input value={profile?.username || ""} disabled className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Bio</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label className="text-sm">Private account</Label>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button variant="ghost" className="w-full text-destructive" onClick={signOut}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}

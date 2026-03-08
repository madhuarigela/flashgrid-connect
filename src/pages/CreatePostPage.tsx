import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ImagePlus, MapPin, X } from "lucide-react";
import { toast } from "sonner";

export default function CreatePostPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length + files.length > 10) {
      toast.error("Maximum 10 files per post");
      return;
    }
    setFiles([...files, ...selected]);

    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles((f) => f.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!user || files.length === 0) {
      toast.error("Please add at least one photo");
      return;
    }

    setUploading(true);
    try {
      // Create post
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({ user_id: user.id, caption, location: location || null })
        .select()
        .single();

      if (postError) throw postError;

      // Upload media files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${post.id}/${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);

        await supabase.from("post_media").insert({
          post_id: post.id,
          media_url: urlData.publicUrl,
          media_type: file.type.startsWith("video") ? "video" : "image",
          sort_order: i,
        });
      }

      toast.success("Post shared!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[470px] min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="tap-highlight-none">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h2 className="font-semibold text-foreground">New Post</h2>
        <Button variant="ghost" onClick={handlePost} disabled={uploading || files.length === 0}>
          <span className="text-ig-blue font-semibold">{uploading ? "Sharing..." : "Share"}</span>
        </Button>
      </header>

      <div className="p-4 space-y-4">
        {/* File picker */}
        {files.length === 0 ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20 tap-highlight-none hover:border-muted-foreground transition-colors"
          >
            <ImagePlus className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">Add Photos or Videos</p>
            <p className="text-xs text-muted-foreground mt-1">Up to 10 items</p>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {previews.map((preview, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={preview} alt="" className="h-32 w-32 rounded-lg object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -right-1 -top-1 rounded-full bg-foreground p-0.5"
                  >
                    <X className="h-3.5 w-3.5 text-background" />
                  </button>
                </div>
              ))}
              {files.length < 10 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-32 w-32 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border"
                >
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Caption */}
        <div className="space-y-2">
          <textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[80px]"
            maxLength={2200}
          />
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Add location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border-0 bg-transparent px-0 focus-visible:ring-0"
          />
        </div>
      </div>
    </div>
  );
}

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { post_id } = await req.json();

    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch post and media
    const { data: post } = await supabase
      .from("posts")
      .select("id, caption, user_id, post_media(media_url, media_type)")
      .eq("id", post_id)
      .single();

    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI-based text moderation using Lovable AI
    let moderationScore = 0;
    let flagged = false;
    let reason: string | null = null;

    if (post.caption) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a content moderation AI. Analyze the following social media post caption and respond with a JSON object containing:
- "score": a number from 0 to 1 where 0 is completely safe and 1 is extremely harmful
- "flagged": boolean, true if score > 0.6
- "reason": string or null, brief reason if flagged
Only respond with the JSON object, nothing else.`,
                },
                { role: "user", content: post.caption },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "moderation_result",
                    description: "Return content moderation result",
                    parameters: {
                      type: "object",
                      properties: {
                        score: { type: "number", description: "Moderation score 0-1" },
                        flagged: { type: "boolean" },
                        reason: { type: "string", description: "Reason if flagged" },
                      },
                      required: ["score", "flagged"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "moderation_result" } },
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const result = JSON.parse(toolCall.function.arguments);
              moderationScore = result.score || 0;
              flagged = result.flagged || false;
              reason = result.reason || null;
            }
          }
        } catch (aiErr) {
          console.error("AI moderation error:", aiErr);
          // Continue with score 0 (safe) if AI fails
        }
      }
    }

    // Store moderation result
    const { error: insertError } = await supabase.from("content_moderation").insert({
      post_id,
      moderation_score: moderationScore,
      flagged,
      reason,
      status: flagged ? "flagged" : "approved",
    });

    if (insertError) {
      console.error("Insert moderation error:", insertError);
    }

    return new Response(
      JSON.stringify({
        post_id,
        moderation_score: moderationScore,
        flagged,
        reason,
        status: flagged ? "flagged" : "approved",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Moderation error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

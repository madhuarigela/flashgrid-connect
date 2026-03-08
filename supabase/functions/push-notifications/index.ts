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

    const { recipient_id, title, body, data } = await req.json();

    if (!recipient_id || !title) {
      return new Response(JSON.stringify({ error: "recipient_id and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user devices
    const { data: devices } = await supabase
      .from("user_devices")
      .select("device_token, platform")
      .eq("user_id", recipient_id);

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No devices registered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Push notification sending logic
    // This is a placeholder - integrate with FCM/APNs/Web Push
    const results = [];
    for (const device of devices) {
      // TODO: Integrate with push notification service
      // For web push, use Web Push API
      // For mobile, use FCM (Firebase Cloud Messaging)
      console.log(`Would send push to ${device.platform} device: ${device.device_token}`);
      results.push({
        device_token: device.device_token.substring(0, 10) + "...",
        platform: device.platform,
        status: "queued",
      });
    }

    return new Response(
      JSON.stringify({ sent: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

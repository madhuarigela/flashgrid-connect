import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: string;
  entity_id: string | null;
  entity_type: string | null;
  read: boolean;
  created_at: string;
  actor: {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("notifications", {
        method: "GET",
      });

      if (error) {
        // Fallback to direct query
        const { data: notifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (notifs) {
          const actorIds = [...new Set(notifs.map((n) => n.actor_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, display_name, avatar_url")
            .in("user_id", actorIds);

          const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

          setNotifications(
            notifs.map((n) => ({ ...n, actor: profileMap.get(n.actor_id) || null }))
          );
          setUnreadCount(notifs.filter((n) => !n.read).length);
        }
      } else {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      console.error("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async (ids?: string[]) => {
    if (!user) return;
    try {
      await supabase.functions.invoke("notifications", {
        method: "POST",
        body: { action: "mark_read", notification_ids: ids },
      });

      setNotifications((prev) =>
        prev.map((n) => (ids ? (ids.includes(n.id) ? { ...n, read: true } : n) : { ...n, read: true }))
      );
      setUnreadCount(ids ? Math.max(0, unreadCount - ids.length) : 0);
    } catch {
      // Fallback
      if (ids) {
        for (const id of ids) {
          await supabase.from("notifications").update({ read: true }).eq("id", id);
        }
      } else {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("recipient_id", user.id)
          .eq("read", false);
      }
    }
  }, [user, unreadCount]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotif = payload.new as any;
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, username, display_name, avatar_url")
            .eq("user_id", newNotif.actor_id)
            .single();

          setNotifications((prev) => [
            { ...newNotif, actor: profile || null },
            ...prev,
          ]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  return { notifications, unreadCount, loading, fetchNotifications, markAsRead };
}

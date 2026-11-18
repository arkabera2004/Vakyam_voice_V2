import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Notification = { id: string; kind: string; title: string; body: string; readAt: string | null; createdAt: string };

/** The signed-in user's real notifications, newest first, with unread count and mark-as-read. RLS already scopes every read and write to the caller's own rows. */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("notifications").select("id, kind, title, body, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setNotifications((data ?? []).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, readAt: n.read_at, createdAt: n.created_at })));
    setLoading(false);
  }, [user]);

  useEffect(() => void load(), [load]);

  const markRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      setNotifications((list) => list.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
      const { error } = await supabase.from("notifications").update({ read_at: now }).eq("id", id);
      if (error) void load(); // reconcile the optimistic update if the write failed
    },
    [load],
  );

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  return { notifications, loading, unreadCount, markRead, reload: load };
}

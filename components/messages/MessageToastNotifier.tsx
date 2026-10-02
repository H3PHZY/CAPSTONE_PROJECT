"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";

type ToastItem = {
  id: string;
  listingId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  preview: string;
  createdAt: number;
};

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 6500;

function previewFromMessage(body: string | null, hasFile: boolean): string {
  const text = (body ?? "").trim();
  if (text && text !== "Photo" && text !== "Attachment") return text;
  if (hasFile) return "Sent an attachment";
  return "Sent a message";
}

export function MessageToastNotifier() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pathnameRef = useRef(pathname);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback(
    (item: ToastItem) => {
      // Already in Messages — no toast clutter
      if (pathnameRef.current.startsWith("/messages")) return;

      setToasts((prev) => {
        const next = [item, ...prev.filter((t) => t.id !== item.id)].slice(0, MAX_TOASTS);
        return next;
      });

      const existing = timers.current.get(item.id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        item.id,
        setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    if (!user) {
      setToasts([]);
      return;
    }

    const channel = supabase
      .channel(`inbox-toasts:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            listing_id?: string;
            sender_id?: string;
            body?: string | null;
            image_url?: string | null;
            attachment_name?: string | null;
          };

          const id = row.id;
          const listingId = row.listing_id;
          const senderId = row.sender_id;
          if (!id || !listingId || !senderId) return;

          void (async () => {
            let senderName = "EcoLoop user";
            let senderAvatarUrl: string | null = null;
            const { data: profile } = await supabase
              .from("profiles")
              .select("business_name, avatar_url")
              .eq("id", senderId)
              .maybeSingle();
            if (profile?.business_name) senderName = profile.business_name;
            if (profile?.avatar_url) senderAvatarUrl = profile.avatar_url;

            pushToast({
              id,
              listingId,
              senderName,
              senderAvatarUrl,
              preview: previewFromMessage(
                row.body ?? null,
                Boolean(row.image_url || row.attachment_name)
              ),
              createdAt: Date.now(),
            });
          })();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, [user, pushToast]);

  if (!user || toasts.length === 0) return null;

  return (
    <div className="msg-toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="msg-toast">
          <Link
            href={`/messages?listing=${t.listingId}`}
            className="msg-toast-link"
            onClick={() => dismiss(t.id)}
          >
            <div className="msg-toast-avatar">
              <ProfileAvatar
                name={t.senderName}
                url={t.senderAvatarUrl}
                size="sm"
              />
            </div>
            <div className="msg-toast-copy">
              <div className="msg-toast-title">New message · {t.senderName}</div>
              <div className="msg-toast-preview">{t.preview}</div>
            </div>
          </Link>
          <button
            type="button"
            className="msg-toast-close"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

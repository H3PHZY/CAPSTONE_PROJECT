"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { fetchInbox } from "@/lib/messages";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";

type ToastItem = {
  id: string;
  listingId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  preview: string;
};

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 6500;
const POLL_INTERVAL_MS = 7000;

function previewFromMessage(body: string, hasFile: boolean): string {
  const text = body.trim();
  if (text && text !== "Photo" && text !== "Attachment") return text;
  return hasFile ? "Sent an attachment" : "Sent a message";
}

export function MessageToastNotifier() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [toastState, setToastState] = useState<{
    userId: string;
    items: ToastItem[];
  } | null>(null);
  const toasts = user?.id && toastState?.userId === user.id ? toastState.items : [];
  const pathnameRef = useRef(pathname);
  const seenMessageIds = useRef<Set<string> | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToastState((previous) =>
      user && previous?.userId === user.id
        ? {
            userId: user.id,
            items: previous.items.filter((toast) => toast.id !== id),
          }
        : previous
    );
  }, [user]);

  const pushToast = useCallback(
    (item: ToastItem) => {
      if (pathnameRef.current.startsWith("/messages")) return;
      if (!user) return;
      setToastState((previous) => ({
        userId: user.id,
        items: [
          item,
          ...(previous?.userId === user.id
            ? previous.items.filter((toast) => toast.id !== item.id)
            : []),
        ].slice(0, MAX_TOASTS),
      })
      );
      const currentTimer = timers.current.get(item.id);
      if (currentTimer) clearTimeout(currentTimer);
      timers.current.set(
        item.id,
        setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS)
      );
    },
    [dismiss, user]
  );

  useEffect(() => {
    if (!user) {
      seenMessageIds.current = null;
      return;
    }
    const userId = user.id;

    let active = true;
    let polling = false;
    const activeTimers = timers.current;

    async function pollInbox() {
      if (document.visibilityState !== "visible") return;
      if (polling) return;
      polling = true;
      try {
        const inbox = await fetchInbox();
        if (!active) return;
        const known = seenMessageIds.current;
        const next = new Set(inbox.map((thread) => thread.lastMessageId));
        if (known) {
          for (const thread of inbox) {
            if (
              !known.has(thread.lastMessageId) &&
              thread.lastSenderId !== userId
            ) {
              pushToast({
                id: thread.lastMessageId,
                listingId: thread.listingId,
                senderName: thread.otherName,
                senderAvatarUrl: thread.otherAvatarUrl,
                preview: previewFromMessage(
                  thread.preview,
                  /attachment|photo/i.test(thread.preview)
                ),
              });
            }
          }
        }
        seenMessageIds.current = next;
      } catch (error) {
        if (active) console.error("Could not poll message notifications", error);
      } finally {
        polling = false;
      }
    }

    void pollInbox();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void pollInbox();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = setInterval(() => void pollInbox(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, [user, pushToast]);

  if (!user || toasts.length === 0) return null;

  return (
    <div className="msg-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="msg-toast">
          <Link
            href={`/messages?listing=${toast.listingId}`}
            className="msg-toast-link"
            onClick={() => dismiss(toast.id)}
          >
            <div className="msg-toast-avatar">
              <ProfileAvatar
                name={toast.senderName}
                url={toast.senderAvatarUrl}
                size="sm"
              />
            </div>
            <div className="msg-toast-copy">
              <div className="msg-toast-title">New message · {toast.senderName}</div>
              <div className="msg-toast-preview">{toast.preview}</div>
            </div>
          </Link>
          <button
            type="button"
            className="msg-toast-close"
            aria-label="Dismiss"
            onClick={() => dismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QUICK_REPLIES } from "@/lib/data";
import {
  fileKindLabel,
  isImageMime,
  uploadMessageAttachment,
  validateMessageAttachment,
} from "@/lib/message-attachments";
import {
  fetchInbox,
  fetchThreadMessages,
  resolveListingContact,
  sendMessage,
  type MessageThread,
} from "@/lib/messages";
import {
  getPairTransactionView,
  markAsAgreed,
  markExchangeCompleted,
  type TransactionView,
} from "@/lib/transactions";
import type { ChatMessage } from "@/lib/types";
import {
  AttachmentLightbox,
  type AttachmentPreview,
} from "@/components/messages/AttachmentLightbox";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { supabase } from "@/lib/supabase";

export function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listingParam = searchParams.get("listing");
  const { user, ready, openAuth } = useAuth();

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txn, setTxn] = useState<TransactionView | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string } | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [viewer, setViewer] = useState<AttachmentPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const msgsBodyRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<MessageThread | null>(null);
  const [pendingContact, setPendingContact] = useState<{
    listingId: string;
    listingTitle: string;
    listingMaterial: string;
    sellerId: string;
    otherUserId: string;
    otherName: string;
    otherAvatarUrl?: string | null;
  } | null>(null);

  const active = useMemo(() => {
    if (pendingContact && activeKey === `new:${pendingContact.listingId}`) {
      return {
        key: activeKey,
        listingId: pendingContact.listingId,
        listingTitle: pendingContact.listingTitle,
        listingMaterial: pendingContact.listingMaterial,
        sellerId: pendingContact.sellerId,
        otherUserId: pendingContact.otherUserId,
        otherName: pendingContact.otherName,
        otherAvatarUrl: pendingContact.otherAvatarUrl ?? null,
        preview: "Start the conversation",
        timeLabel: "Now",
        updatedAt: new Date().toISOString(),
      } satisfies MessageThread;
    }
    return threads.find((t) => t.key === activeKey) ?? threads[0] ?? null;
  }, [threads, activeKey, pendingContact]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const parties = useMemo(() => {
    if (!user || !active?.sellerId) return null;
    const sellerId = active.sellerId;
    const buyerId = user.id === sellerId ? active.otherUserId : user.id;
    if (!buyerId || buyerId === sellerId) return null;
    return { buyerId, sellerId };
  }, [user, active]);

  const reloadInbox = useCallback(async () => {
    if (!user) return [];
    const inbox = await fetchInbox(user.id);
    setThreads(inbox);
    return inbox;
  }, [user]);

  const refreshActiveThread = useCallback(async () => {
    if (!user) return;
    const current = activeRef.current;
    if (!current || current.key.startsWith("new:")) return;
    const rows = await fetchThreadMessages(
      user.id,
      current.listingId,
      current.otherUserId
    );
    setMsgs(rows);
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      openAuth("login", "/messages");
      return;
    }

    let activeEffect = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const inbox = await reloadInbox();
        if (!activeEffect) return;

        if (listingParam) {
          const contact = await resolveListingContact(listingParam, user.id);
          if (!activeEffect) return;
          if (!contact) {
            setError("Listing not found");
          } else {
            const existing = inbox.find(
              (t) =>
                t.listingId === contact.listingId &&
                t.otherUserId === contact.otherUserId
            );
            if (existing) {
              setPendingContact(null);
              setActiveKey(existing.key);
            } else {
              setPendingContact(contact);
              setActiveKey(`new:${contact.listingId}`);
              setMsgs([]);
            }
          }
        } else if (inbox[0]) {
          setActiveKey((prev) => prev ?? inbox[0].key);
        }
      } catch (err) {
        if (!activeEffect) return;
        setError(err instanceof Error ? err.message : "Could not load messages");
      } finally {
        if (activeEffect) setLoading(false);
      }
    })();

    return () => {
      activeEffect = false;
    };
  }, [ready, user, listingParam, openAuth, reloadInbox]);

  useEffect(() => {
    if (!user || !active || active.key.startsWith("new:")) {
      if (active?.key.startsWith("new:")) setMsgs([]);
      return;
    }

    let alive = true;
    void fetchThreadMessages(user.id, active.listingId, active.otherUserId)
      .then((rows) => {
        if (alive) setMsgs(rows);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Could not load thread");
        }
      });

    return () => {
      alive = false;
    };
  }, [user, active?.key, active?.listingId, active?.otherUserId]);

  // Live inbox + open thread while on Messages
  useEffect(() => {
    if (!user) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;

    const onMessageEvent = (payload: {
      new: Record<string, unknown>;
    }) => {
      const row = payload.new as {
        sender_id?: string;
        recipient_id?: string;
        listing_id?: string;
      };
      if (row.sender_id !== user.id && row.recipient_id !== user.id) return;

      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void (async () => {
          try {
            const inbox = await reloadInbox();
            const current = activeRef.current;

            // First message on a "new" pending contact → promote to real thread
            if (
              current?.key.startsWith("new:") &&
              row.listing_id === current.listingId
            ) {
              const match = inbox.find(
                (t) =>
                  t.listingId === current.listingId &&
                  t.otherUserId === current.otherUserId
              );
              if (match) {
                setPendingContact(null);
                setActiveKey(match.key);
              }
            }

            if (
              current &&
              !current.key.startsWith("new:") &&
              row.listing_id === current.listingId &&
              (row.sender_id === current.otherUserId ||
                row.recipient_id === current.otherUserId ||
                row.sender_id === user.id ||
                row.recipient_id === user.id)
            ) {
              await refreshActiveThread();
            }
          } catch {
            // Keep last good UI; next event can retry
          }
        })();
      }, 120);
    };

    const channel = supabase
      .channel(`messages-page:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        onMessageEvent
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${user.id}`,
        },
        onMessageEvent
      )
      .subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [user, reloadInbox, refreshActiveThread]);

  useEffect(() => {
    const el = msgsBodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs.length, active?.key]);

  useEffect(() => {
    if (!user || !parties || !active) {
      setTxn(null);
      return;
    }
    let alive = true;
    void getPairTransactionView(
      active.listingId,
      parties.buyerId,
      parties.sellerId,
      user.id
    )
      .then((view) => {
        if (alive) setTxn(view);
      })
      .catch(() => {
        if (alive) setTxn(null);
      });
    return () => {
      alive = false;
    };
  }, [user, parties, active?.listingId, active?.key]);

  async function pushMsg(
    text: string,
    extras?: {
      replyTo?: string | null;
      imageUrl?: string | null;
      attachmentName?: string | null;
      attachmentMime?: string | null;
    }
  ): Promise<boolean> {
    if (!user || !active) return false;
    const body = text.trim();
    const imageUrl = extras?.imageUrl ?? null;
    if (!body && !imageUrl) return false;

    setSending(true);
    setError(null);
    try {
      await sendMessage({
        listingId: active.listingId,
        senderId: user.id,
        recipientId: active.otherUserId,
        body,
        replyTo: extras?.replyTo ?? null,
        imageUrl,
        attachmentName: extras?.attachmentName ?? null,
        attachmentMime: extras?.attachmentMime ?? null,
      });
      await reloadInbox();
      const key = `${active.listingId}:${active.otherUserId}`;
      setPendingContact(null);
      setActiveKey(key);
      const rows = await fetchThreadMessages(user.id, active.listingId, active.otherUserId);
      setMsgs(rows);
      if (listingParam) router.replace("/messages");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
      return false;
    } finally {
      setSending(false);
    }
  }

  function clearAttachment() {
    setAttachment(null);
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachmentPreview(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateMessageAttachment(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachment(file);
    setAttachmentPreview(
      isImageMime(file.type) ? URL.createObjectURL(file) : null
    );
  }

  async function send() {
    if (!user) return;
    setError(null);
    try {
      let imageUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentMime: string | null = null;
      if (attachment) {
        setSending(true);
        const uploaded = await uploadMessageAttachment(user.id, attachment);
        imageUrl = uploaded.publicUrl;
        attachmentName = uploaded.name;
        attachmentMime = uploaded.mime;
        setSending(false);
      }
      const ok = await pushMsg(draft, {
        replyTo: replyTo?.id ?? null,
        imageUrl,
        attachmentName,
        attachmentMime,
      });
      if (ok) {
        setDraft("");
        setReplyTo(null);
        clearAttachment();
      }
    } catch (err) {
      setSending(false);
      const message = err instanceof Error ? err.message : "Send failed";
      if (/bucket|message-attachments|not found/i.test(message)) {
        setError(
          "Run supabase/migrations/011_message_attachments.sql in the Supabase SQL Editor, then try again."
        );
      } else {
        setError(message);
      }
    }
  }

  function quickSend(label: string) {
    void pushMsg(label === "Still available" ? "Is this still available?" : label);
  }

  async function onMarkAgreed() {
    if (!user || !parties || !active) return;
    setActing(true);
    setError(null);
    try {
      const view = await markAsAgreed({
        listingId: active.listingId,
        buyerId: parties.buyerId,
        sellerId: parties.sellerId,
        actorId: user.id,
      });
      setTxn(view);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Could not mark as agreed";
      setError(message);
    } finally {
      setActing(false);
    }
  }

  async function onMarkCompleted() {
    if (!user || !parties || !active) return;
    setActing(true);
    setError(null);
    try {
      const view = await markExchangeCompleted({
        listingId: active.listingId,
        buyerId: parties.buyerId,
        sellerId: parties.sellerId,
        actorId: user.id,
      });
      setTxn(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete exchange");
    } finally {
      setActing(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="page-shell page-shell--msgs">
        <h1 className="page-title page-title--mb">Messages</h1>
        <div className="page-sub">Loading conversations…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell page-shell--msgs">
        <h1 className="page-title page-title--mb">Messages</h1>
        <div className="empty-state">
          <div className="empty-title">Sign in to message buyers and sellers</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAuth("login", "/messages")}
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  const status = txn?.status;
  const isSeller = Boolean(user && active && user.id === active.sellerId);
  const canAgree =
    isSeller && Boolean(parties) && status !== "Reserved" && status !== "Completed";
  const canComplete = Boolean(parties) && status === "Reserved";

  return (
    <div className="page-shell page-shell--msgs">
      <h1 className="page-title page-title--mb">Messages</h1>
      {error ? <div className="upload-error">{error}</div> : null}
      <div className="msgs-grid">
        <div className="panel panel--flush">
          <div className="msgs-list-head">
            CONVERSATIONS · {threads.length}
            {pendingContact ? " + 1 new" : ""}
          </div>
          {pendingContact ? (
            <button
              type="button"
              className={
                activeKey === `new:${pendingContact.listingId}`
                  ? "thread-row is-active"
                  : "thread-row"
              }
              onClick={() => setActiveKey(`new:${pendingContact.listingId}`)}
            >
              <div className="thread-row-top">
                <div className="thread-name">{pendingContact.otherName}</div>
                <div className="thread-time">New</div>
              </div>
              <div className="thread-subject">
                {pendingContact.listingMaterial} · {pendingContact.listingTitle}
              </div>
              <div className="thread-preview">Start the conversation</div>
            </button>
          ) : null}
          {threads.map((t) => (
            <button
              key={t.key}
              type="button"
              className={active?.key === t.key ? "thread-row is-active" : "thread-row"}
              onClick={() => {
                setPendingContact(null);
                setActiveKey(t.key);
              }}
            >
              <div className="thread-row-top">
                <div className="thread-name">{t.otherName}</div>
                <div className="thread-time">{t.timeLabel}</div>
              </div>
              <div className="thread-subject">
                {t.listingMaterial ? `${t.listingMaterial} · ` : ""}
                {t.listingTitle}
              </div>
              <div className="thread-preview">{t.preview}</div>
            </button>
          ))}
          {!pendingContact && threads.length === 0 ? (
            <div className="thread-row">
              <div className="thread-preview">
                No conversations yet. Open a listing and tap Initiate contact.
              </div>
            </div>
          ) : null}
        </div>

        <div className="panel panel--flush msgs-pane">
          {active ? (
            <>
              <div className="msgs-pane-head">
                <div className="msgs-pane-who">
                  <ProfileAvatar
                    name={active.otherName}
                    url={active.otherAvatarUrl}
                    size="sm"
                    className="msgs-avatar"
                  />
                  <div>
                    <div className="thread-name">{active.otherName}</div>
                    <div className="thread-subject">
                      {active.listingTitle}
                      {status ? ` · ${status}` : ""}
                      {txn?.co2eKg != null ? ` · ${txn.co2eKg} kg CO₂e` : ""}
                    </div>
                  </div>
                </div>
                <div className="msgs-pane-actions">
                  <Link
                    href={`/marketplace/${active.listingId}`}
                    className="btn btn-outline btn-sm"
                  >
                    View listing
                  </Link>
                  {canAgree ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void onMarkAgreed()}
                      disabled={acting}
                    >
                      Reserve for this buyer
                    </button>
                  ) : null}
                  {canComplete ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void onMarkCompleted()}
                      disabled={acting}
                    >
                      Mark completed
                    </button>
                  ) : status === "Completed" ? (
                    <button type="button" className="btn btn-primary btn-sm" disabled>
                      Completed
                    </button>
                  ) : null}
                </div>
              </div>

              {status === "Reserved" ? (
                <div className="msgs-pay-hint">
                  Reserved — share bank details and payment proof in this chat, then mark completed.
                </div>
              ) : null}

              <div className="msgs-body" ref={msgsBodyRef}>
                <div className="msgs-day">CONVERSATION</div>
                {msgs.length === 0 ? (
                  <div className="thread-preview" style={{ padding: "12px 16px" }}>
                    Say hello — ask if the material is still available or propose a pickup.
                  </div>
                ) : null}
                {msgs.map((m, i) => (
                  <div
                    key={m.id || `${m.time}-${i}-${m.text.slice(0, 12)}`}
                    className={m.me ? "msg-row msg-row--me" : "msg-row"}
                  >
                    <div className={m.me ? "msg-bubble msg-bubble--me" : "msg-bubble"}>
                      {m.replyText ? (
                        <div className="msg-quote">{m.replyText}</div>
                      ) : null}
                      {m.imageUrl ? (
                        <button
                          type="button"
                          className="msg-attach"
                          onClick={() =>
                            setViewer({
                              url: m.imageUrl as string,
                              name: m.attachmentName || m.text || "Attachment",
                              mime: m.attachmentMime,
                            })
                          }
                        >
                          {isImageMime(m.attachmentMime) ||
                          (!m.attachmentMime &&
                            /\.(jpe?g|png|webp|gif)(\?|$)/i.test(m.imageUrl)) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.imageUrl}
                              alt={m.attachmentName || "Attachment"}
                              className="msg-image"
                            />
                          ) : (
                            <span className="msg-file-chip">
                              <span className="msg-file-kind">
                                {fileKindLabel(m.attachmentMime, m.attachmentName)}
                              </span>
                              <span className="msg-file-name">
                                {m.attachmentName || m.text || "Attachment"}
                              </span>
                            </span>
                          )}
                        </button>
                      ) : null}
                      {m.text &&
                      m.text !== "Photo" &&
                      m.text !== (m.attachmentName || "") &&
                      m.text !== "Attachment" ? (
                        <div className="msg-text">{m.text}</div>
                      ) : null}
                      <div className="msg-foot">
                        <span className={m.me ? "msg-meta msg-meta--me" : "msg-meta"}>
                          {m.time}
                        </span>
                        {m.id ? (
                          <button
                            type="button"
                            className="msg-reply"
                            onClick={() =>
                              setReplyTo({
                                id: m.id as string,
                                text:
                                  m.text ||
                                  m.attachmentName ||
                                  (m.imageUrl ? "Attachment" : "Message"),
                              })
                            }
                          >
                            Reply
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="msgs-composer">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="sr-only"
                  onChange={onPickFile}
                />
                {replyTo ? (
                  <div className="composer-reply">
                    <span>Replying to: {replyTo.text}</span>
                    <button type="button" onClick={() => setReplyTo(null)}>
                      Cancel
                    </button>
                  </div>
                ) : null}
                {attachment ? (
                  <div className="composer-attach">
                    {attachmentPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={attachmentPreview} alt="Attachment preview" />
                    ) : (
                      <span className="composer-attach-file">
                        {fileKindLabel(attachment.type, attachment.name)} · {attachment.name}
                      </span>
                    )}
                    <button type="button" onClick={clearAttachment}>
                      Remove
                    </button>
                  </div>
                ) : null}
                <div className="quick-replies">
                  {QUICK_REPLIES.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="chip chip--reply"
                      onClick={() => quickSend(label)}
                      disabled={sending}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="composer-row">
                  <button
                    type="button"
                    className="composer-photo"
                    onClick={() => fileRef.current?.click()}
                    disabled={sending}
                    aria-label="Attach file"
                    title="Attach image, PDF, or document"
                  >
                    +
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={replyTo ? "Write a reply…" : "Write a message…"}
                    className="input"
                    disabled={sending}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void send()}
                    disabled={sending || (!draft.trim() && !attachment)}
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="msgs-body">
              <div className="thread-preview" style={{ padding: 24 }}>
                Select a conversation or contact a seller from the marketplace.
              </div>
            </div>
          )}
        </div>
      </div>
      <AttachmentLightbox attachment={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

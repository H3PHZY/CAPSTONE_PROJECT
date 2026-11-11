import { djangoListings, djangoMessages } from "@/lib/django-api";
import { DjangoApiError } from "@/lib/django-auth";
import type { ChatMessage } from "@/lib/types";

export type MessageThread = {
  key: string;
  listingId: string;
  listingTitle: string;
  listingMaterial: string;
  sellerId: string;
  otherUserId: string;
  otherName: string;
  otherAvatarUrl?: string | null;
  preview: string;
  timeLabel: string;
  updatedAt: string;
  lastMessageId: string;
  lastSenderId: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function isPaymentNotice(text: string) {
  return /payment received|paystack confirmed|asking price for this exchange/i.test(text);
}

function threadKey(listingId: string, otherUserId: string) {
  return `${listingId}:${otherUserId}`;
}

export async function fetchInbox(_userId: string): Promise<MessageThread[]> {
  const rows = await djangoMessages.fetchInbox();
  return rows.map((row) => ({
    ...row,
    timeLabel: formatTime(row.updatedAt),
  }));
}

export async function fetchThreadMessages(
  _userId: string,
  listingId: string,
  otherUserId: string
): Promise<ChatMessage[]> {
  const rows = await djangoMessages.fetchThread(listingId, otherUserId);
  return rows.map((row) => ({
    id: row.id,
    me: row.me,
    text: row.body,
    time: row.time || formatTime(row.created_at),
    createdAt: row.created_at,
    replyToId: row.reply_to,
    replyText: row.reply_text,
    imageUrl: row.image_url ?? row.attachment ?? null,
    attachmentName: row.attachment_name,
    attachmentMime: row.attachment_mime,
  }));
}

export async function sendMessage(input: {
  listingId: string;
  senderId: string;
  recipientId: string;
  body: string;
  replyTo?: string | null;
  imageUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}) {
  const hasFile = Boolean(input.imageUrl);
  const fallbackLabel =
    input.attachmentName?.trim() ||
    (input.attachmentMime?.startsWith("image/") ? "Photo" : "Attachment");
  const body = input.body.trim() || (hasFile ? fallbackLabel : "");
  if (!body) throw new Error("Message cannot be empty");
  if (input.senderId === input.recipientId) {
    throw new Error("You cannot message yourself");
  }

  return djangoMessages.send({
    listing: input.listingId,
    recipient: input.recipientId,
    body,
    replyTo: input.replyTo,
    imageUrl: input.imageUrl,
    attachmentName: input.attachmentName,
    attachmentMime: input.attachmentMime,
  });
}

export async function resolveListingContact(listingId: string, viewerId: string) {
  let listing;
  try {
    listing = await djangoListings.fetchById(listingId);
  } catch (error) {
    if (error instanceof DjangoApiError && error.status === 404) return null;
    throw error;
  }
  if (listing.seller_id === viewerId) {
    throw new Error("This is your listing — wait for a buyer to contact you.");
  }

  return {
    listingId: listing.id,
    listingTitle: listing.title,
    listingMaterial: listing.material,
    sellerId: listing.seller_id,
    otherUserId: listing.seller_id,
    otherName: listing.seller_name || "Seller",
    otherAvatarUrl: null,
  };
}
import { supabase } from "@/lib/supabase";
import type { MessageRow } from "@/lib/database.types";
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
};

type MessageJoin = MessageRow & {
  listing?: {
    id: string;
    title: string;
    material: string;
    seller_id: string;
  } | null;
  sender?: { id: string; business_name: string; avatar_url?: string | null } | null;
  recipient?: { id: string; business_name: string; avatar_url?: string | null } | null;
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

function threadKey(listingId: string, otherUserId: string) {
  return `${listingId}:${otherUserId}`;
}

const MESSAGE_SELECT = `
  *,
  listing:listings!listing_id (
    id,
    title,
    material,
    seller_id
  ),
  sender:profiles!sender_id (
    id,
    business_name,
    avatar_url
  ),
  recipient:profiles!recipient_id (
    id,
    business_name,
    avatar_url
  )
`;

export async function fetchInbox(userId: string): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const threads = new Map<string, MessageThread>();
  for (const row of (data ?? []) as MessageJoin[]) {
    const otherUserId = row.sender_id === userId ? row.recipient_id : row.sender_id;
    const other = row.sender_id === userId ? row.recipient : row.sender;
    const key = threadKey(row.listing_id, otherUserId);
    if (threads.has(key)) continue;

    threads.set(key, {
      key,
      listingId: row.listing_id,
      listingTitle: row.listing?.title || "Listing",
      listingMaterial: row.listing?.material || "",
      sellerId: row.listing?.seller_id || "",
      otherUserId,
      otherName: other?.business_name || "EcoLoop user",
      otherAvatarUrl: other?.avatar_url ?? null,
      preview: row.body,
      timeLabel: formatTime(row.created_at),
      updatedAt: row.created_at,
    });
  }

  return [...threads.values()];
}

export async function fetchThreadMessages(
  userId: string,
  listingId: string,
  otherUserId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const filtered = ((data ?? []) as MessageRow[])
    .filter(
      (row) =>
        (row.sender_id === userId && row.recipient_id === otherUserId) ||
        (row.sender_id === otherUserId && row.recipient_id === userId)
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const byId = new Map(filtered.map((row) => [row.id, row]));

  return filtered.map((row) => ({
    id: row.id,
    me: row.sender_id === userId,
    text: row.body,
    time: formatTime(row.created_at),
    createdAt: row.created_at,
    replyToId: row.reply_to,
    replyText: row.reply_to ? byId.get(row.reply_to)?.body ?? null : null,
    imageUrl: row.image_url,
    attachmentName: row.attachment_name ?? null,
    attachmentMime: row.attachment_mime ?? null,
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

  const { data, error } = await supabase
    .from("messages")
    .insert({
      listing_id: input.listingId,
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      body,
      reply_to: input.replyTo ?? null,
      image_url: input.imageUrl ?? null,
      attachment_name: input.attachmentName ?? null,
      attachment_mime: input.attachmentMime ?? null,
    })
    .select("*")
    .single();

  if (error) {
    // Older DBs without attachment_* columns — still send URL on image_url
    if (/attachment_name|attachment_mime|column/i.test(error.message) && hasFile) {
      const retry = await supabase
        .from("messages")
        .insert({
          listing_id: input.listingId,
          sender_id: input.senderId,
          recipient_id: input.recipientId,
          body,
          reply_to: input.replyTo ?? null,
          image_url: input.imageUrl ?? null,
        })
        .select("*")
        .single();
      if (retry.error) throw retry.error;
      // continue with interest logic using retry.data
      return afterSend(retry.data as MessageRow, input);
    }
    throw error;
  }

  return afterSend(data as MessageRow, input);
}

async function afterSend(
  data: MessageRow,
  input: { listingId: string; senderId: string; recipientId: string }
) {
  // Buyer opening the chat creates an Interest row the seller can later reserve.
  if (input.senderId !== input.recipientId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, seller_id")
      .eq("id", input.listingId)
      .maybeSingle();

    if (listing && listing.seller_id !== input.senderId) {
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("listing_id", input.listingId)
        .eq("buyer_id", input.senderId)
        .eq("seller_id", listing.seller_id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("transactions").insert({
          listing_id: input.listingId,
          buyer_id: input.senderId,
          seller_id: listing.seller_id,
          status: "Interest",
        });
      }
    }
  }

  return data;
}

export async function resolveListingContact(listingId: string, viewerId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      material,
      seller_id,
      seller:profiles!seller_id (
        id,
        business_name,
        avatar_url
      )
    `
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const seller = Array.isArray(data.seller) ? data.seller[0] : data.seller;
  if (data.seller_id === viewerId) {
    throw new Error("This is your listing — wait for a buyer to contact you.");
  }

  return {
    listingId: data.id as string,
    listingTitle: data.title as string,
    listingMaterial: data.material as string,
    sellerId: data.seller_id as string,
    otherUserId: data.seller_id as string,
    otherName: (seller as { business_name?: string } | null)?.business_name || "Seller",
    otherAvatarUrl:
      (seller as { avatar_url?: string | null } | null)?.avatar_url ?? null,
  };
}

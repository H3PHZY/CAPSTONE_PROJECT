import { supabase } from "@/lib/supabase";

export const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";
export const MAX_MESSAGE_ATTACHMENT_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
};

export type UploadedMessageAttachment = {
  path: string;
  publicUrl: string;
  name: string;
  mime: string;
};

export function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime && mime.startsWith("image/"));
}

export function isPdfMime(mime: string | null | undefined): boolean {
  return mime === "application/pdf";
}

export function mimeFromFileName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && EXT_MIME[fromName]) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

export function validateMessageAttachment(file: File): string | null {
  const mime = file.type || mimeFromFileName(file.name) || "";
  const okMime = ALLOWED_MIME.has(mime) || ALLOWED_MIME.has(file.type);
  const okExt = Boolean(mimeFromFileName(file.name));
  if (!okMime && !okExt) {
    return "Use an image, PDF, Word, Excel, TXT, or CSV file.";
  }
  if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    return "File must be 12 MB or smaller.";
  }
  return null;
}

export function fileKindLabel(mime: string | null | undefined, name?: string | null): string {
  if (isImageMime(mime)) return "Image";
  if (isPdfMime(mime)) return "PDF";
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "Word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "Excel";
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".txt")) return "Text";
  return "File";
}

/** Upload to `message-attachments/{userId}/{uuid}.ext` */
export async function uploadMessageAttachment(
  userId: string,
  file: File
): Promise<UploadedMessageAttachment> {
  const validationError = validateMessageAttachment(file);
  if (validationError) throw new Error(validationError);

  const mime = file.type || mimeFromFileName(file.name) || "application/octet-stream";
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
    name: file.name,
    mime,
  };
}

export async function downloadAttachment(url: string, fileName: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download file");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName || "attachment";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

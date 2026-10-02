import { supabase } from "@/lib/supabase";

export const PROFILE_AVATARS_BUCKET = "profile-avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type UploadedAvatar = {
  path: string;
  publicUrl: string;
};

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function validateProfileAvatar(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Photo must be 5 MB or smaller.";
  }
  return null;
}

/** Upload to `profile-avatars/{userId}/avatar.{ext}` (upsert replaces previous). */
export async function uploadProfileAvatar(
  userId: string,
  file: File
): Promise<UploadedAvatar> {
  const validationError = validateProfileAvatar(file);
  if (validationError) throw new Error(validationError);

  const path = `${userId}/avatar.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(PROFILE_AVATARS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(path);
  // Bust CDN/browser cache after replace
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  return { path, publicUrl };
}

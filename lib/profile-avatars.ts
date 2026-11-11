import { uploadDjangoMedia } from "@/lib/django-api";

export const PROFILE_AVATARS_BUCKET = "profile-avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type UploadedAvatar = {
  path: string;
  publicUrl: string;
};

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
  _userId: string,
  file: File
): Promise<UploadedAvatar> {
  const validationError = validateProfileAvatar(file);
  if (validationError) throw new Error(validationError);

  const uploaded = await uploadDjangoMedia(file, "profile-avatar");
  return { path: uploaded.path, publicUrl: uploaded.url };
}

import { supabase } from "@/lib/supabase";

export const LISTING_PHOTOS_BUCKET = "listing-photos";
export const MAX_LISTING_PHOTO_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export type UploadedListingPhoto = {
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

export function validateListingPhoto(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_LISTING_PHOTO_BYTES) {
    return "Photo must be 8 MB or smaller.";
  }
  return null;
}

/** Upload to `listing-photos/{userId}/{uuid}.ext` (matches RLS folder rule). */
export async function uploadListingPhoto(
  userId: string,
  file: File
): Promise<UploadedListingPhoto> {
  const validationError = validateListingPhoto(file);
  if (validationError) throw new Error(validationError);

  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(LISTING_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(LISTING_PHOTOS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

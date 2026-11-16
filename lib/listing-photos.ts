import { uploadDjangoMedia } from "@/lib/django-api";

export const LISTING_PHOTOS_BUCKET = "listing-photos";
export const MAX_LISTING_PHOTO_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export type UploadedListingPhoto = {
  path: string;
  publicUrl: string;
};

export function validateListingPhoto(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_LISTING_PHOTO_BYTES) {
    return "Photo must be 8 MB or smaller.";
  }
  return null;
}

export async function uploadListingPhoto(
  _userId: string,
  file: File
): Promise<UploadedListingPhoto> {
  const validationError = validateListingPhoto(file);
  if (validationError) throw new Error(validationError);

  const uploaded = await uploadDjangoMedia(file, "listing-photo");
  return { path: uploaded.path, publicUrl: uploaded.url };
}

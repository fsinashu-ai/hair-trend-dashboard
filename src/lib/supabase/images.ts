import { getSupabaseClient } from "@/lib/supabase/client";
import type { UploadedHairImage } from "@/types/hairImageAnalysis";

export const HAIR_IMAGE_BUCKET = "hair-images";

function getFileExtension(file: File) {
  const extensionFromName = file.name.split(".").pop();

  if (extensionFromName) {
    return extensionFromName.toLowerCase();
  }

  return file.type.split("/")[1] ?? "jpg";
}

function createStoragePath(file: File) {
  const date = new Date().toISOString().slice(0, 10);
  const extension = getFileExtension(file);
  const fileId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `uploads/${date}/${fileId}.${extension}`;
}

export async function uploadHairImageToSupabase(
  file: File,
): Promise<UploadedHairImage | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const storagePath = createStoragePath(file);
  const { data, error } = await supabase.storage
    .from(HAIR_IMAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(HAIR_IMAGE_BUCKET)
    .getPublicUrl(data.path);

  return {
    bucket: HAIR_IMAGE_BUCKET,
    path: data.path,
    publicUrl: publicUrlData.publicUrl,
  };
}

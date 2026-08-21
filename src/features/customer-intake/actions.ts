"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getVerifiedStaffSession } from "@/lib/auth/session";
import { hasSupabaseAdminConfig, isDemoMode } from "@/lib/config";
import type { ActionResult } from "@/lib/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_PHOTO_LIMIT,
  customerIntakeSchema,
  customerLinkCreationSchema,
  customerLinkRevocationSchema,
  customerPhotoMutationSchema,
  customerPhotoPreparationSchema,
} from "./schemas";
import { getActiveCustomerLinkByToken } from "./queries";
import { createCustomerIntakeToken, hashCustomerIntakeToken } from "./tokens";

const PHOTO_BUCKET = "job-photos";
const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
const demoError = "Ekki er hægt að búa til viðskiptavinatengil í sýnisham.";
const unavailableError = "Tengillinn er útrunninn, hefur verið afturkallaður eða þegar notaður.";

const photoExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function createCustomerIntakeLinkAction(
  input: unknown,
): Promise<ActionResult<{ linkId: string; path: string; expiresAt: string }>> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: "Innskráning rann út." };
  if (!hasSupabaseAdminConfig()) return { ok: false, error: "Serverlykill Supabase er ekki stilltur." };

  const parsed = customerLinkCreationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógilt verkefni." };

  const rawToken = createCustomerIntakeToken();
  const expiresAt = new Date(Date.now() + LINK_LIFETIME_MS).toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_customer_intake_link", {
    p_job_id: parsed.data.jobId,
    p_token_hash: hashCustomerIntakeToken(rawToken),
    p_expires_at: expiresAt,
  });

  if (error || !data) return { ok: false, error: "Ekki tókst að búa til öruggan tengil." };
  revalidatePath("/");
  revalidatePath(`/jobs/${parsed.data.jobId}/history`);
  return {
    ok: true,
    data: { linkId: data, path: `/customer/${rawToken}`, expiresAt },
  };
}

export async function revokeCustomerIntakeLinkAction(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, error: demoError };
  if (!(await getVerifiedStaffSession())) return { ok: false, error: "Innskráning rann út." };

  const parsed = customerLinkRevocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ógildur tengill." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_customer_intake_link", {
    p_link_id: parsed.data.linkId,
  });
  if (error) return { ok: false, error: "Ekki tókst að afturkalla tengilinn." };

  revalidatePath("/");
  revalidatePath("/jobs/[jobId]/history", "page");
  return { ok: true };
}

export async function submitCustomerIntakeAction(input: unknown): Promise<ActionResult> {
  const parsed = customerIntakeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please review the form and confirm your location.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!hasSupabaseAdminConfig()) return { ok: false, error: "The service is temporarily unavailable." };

  const value = parsed.data;
  const admin = createAdminClient();
  const { data: jobId, error } = await admin.rpc("submit_customer_intake", {
    p_token_hash: hashCustomerIntakeToken(value.token),
    p_customer_name: value.customerName,
    p_customer_phone: value.customerPhone,
    p_vehicle_registration: value.vehicleRegistration,
    p_vehicle_make: value.vehicleMake,
    p_vehicle_model: value.vehicleModel,
    p_vehicle_type: value.vehicleType,
    p_latitude: value.latitude,
    p_longitude: value.longitude,
    p_location_label: value.locationLabel,
    p_location_source: value.locationSource,
    p_customer_notes: value.customerNotes,
  });

  if (error) return { ok: false, error: unavailableError };
  revalidatePath("/");
  revalidatePath("/driver");
  revalidatePath(`/customer/${value.token}`);
  if (jobId) revalidatePath(`/jobs/${jobId}/history`);
  return { ok: true };
}

export async function prepareCustomerPhotoUploadAction(
  input: unknown,
): Promise<ActionResult<{ photoId: string; path: string; uploadToken: string }>> {
  const parsed = customerPhotoPreparationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unsupported photo or file larger than 10 MB." };

  const link = await getActiveCustomerLinkByToken(parsed.data.token);
  if (!link) return { ok: false, error: unavailableError };

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from("job_photos")
    .select("id", { count: "exact", head: true })
    .eq("customer_intake_link_id", link.id);

  if (countError) return { ok: false, error: "Photo upload could not be prepared." };
  if ((count ?? 0) >= CUSTOMER_PHOTO_LIMIT) {
    return { ok: false, error: `You can upload up to ${CUSTOMER_PHOTO_LIMIT} photos.` };
  }

  const photoId = randomUUID();
  const extension = photoExtensions[parsed.data.contentType];
  const path = `${link.job_id}/${photoId}.${extension}`;
  const { error: insertError } = await admin.from("job_photos").insert({
    id: photoId,
    job_id: link.job_id,
    customer_intake_link_id: link.id,
    storage_path: path,
    original_filename: parsed.data.fileName,
    content_type: parsed.data.contentType,
    size_bytes: parsed.data.sizeBytes,
  });
  if (insertError) return { ok: false, error: "Photo upload could not be prepared." };

  const { data: upload, error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);

  if (uploadError || !upload?.token) {
    await admin.from("job_photos").delete().eq("id", photoId);
    return { ok: false, error: "Photo upload could not be prepared." };
  }

  return { ok: true, data: { photoId, path, uploadToken: upload.token } };
}

export async function finalizeCustomerPhotoUploadAction(input: unknown): Promise<ActionResult> {
  const parsed = customerPhotoMutationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid photo." };

  const link = await getActiveCustomerLinkByToken(parsed.data.token);
  if (!link) return { ok: false, error: unavailableError };

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("job_photos")
    .select("id, storage_path")
    .eq("id", parsed.data.photoId)
    .eq("customer_intake_link_id", link.id)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo record was not found." };

  const fileName = photo.storage_path.split("/").at(-1);
  const { data: storedFiles, error: listError } = await admin.storage
    .from(PHOTO_BUCKET)
    .list(link.job_id, { limit: 10, search: fileName });
  if (listError || !storedFiles?.some((file) => file.name === fileName)) {
    return { ok: false, error: "The uploaded photo could not be verified." };
  }

  const { error } = await admin
    .from("job_photos")
    .update({ uploaded_at: new Date().toISOString() })
    .eq("id", photo.id)
    .eq("customer_intake_link_id", link.id);
  if (error) return { ok: false, error: "The uploaded photo could not be saved." };

  revalidatePath(`/customer/${parsed.data.token}`);
  revalidatePath(`/jobs/${link.job_id}/history`);
  return { ok: true };
}

export async function removeCustomerPhotoAction(input: unknown): Promise<ActionResult> {
  const parsed = customerPhotoMutationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid photo." };

  const link = await getActiveCustomerLinkByToken(parsed.data.token);
  if (!link) return { ok: false, error: unavailableError };

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("job_photos")
    .select("id, storage_path")
    .eq("id", parsed.data.photoId)
    .eq("customer_intake_link_id", link.id)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo record was not found." };

  await admin.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  const { error } = await admin
    .from("job_photos")
    .delete()
    .eq("id", photo.id)
    .eq("customer_intake_link_id", link.id);
  if (error) return { ok: false, error: "Photo could not be removed." };

  revalidatePath(`/customer/${parsed.data.token}`);
  revalidatePath(`/jobs/${link.job_id}/history`);
  return { ok: true };
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveCustomerLinkByToken } from "@/features/customer-intake/queries";
import { hasSupabaseAdminConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await params;
  if (!z.uuid().safeParse(photoId).success || !hasSupabaseAdminConfig()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const link = await getActiveCustomerLinkByToken(token);
  if (!link) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("job_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("customer_intake_link_id", link.id)
    .not("uploaded_at", "is", null)
    .maybeSingle();
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await admin.storage.from("job-photos")
    .createSignedUrl(photo.storage_path, 300);
  if (error || !data?.signedUrl) return new NextResponse("Not found", { status: 404 });

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

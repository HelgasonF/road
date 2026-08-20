import { NextResponse } from "next/server";
import { z } from "zod";

import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseAdminConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await params;
  if (!z.uuid().safeParse(photoId).success || !hasSupabaseAdminConfig()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const identity = await getVerifiedSession();
  if (!identity) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("job_photos")
    .select("storage_path")
    .eq("id", photoId)
    .not("uploaded_at", "is", null)
    .maybeSingle();
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("job-photos")
    .createSignedUrl(photo.storage_path, 300);
  if (error || !data?.signedUrl) return new NextResponse("Not found", { status: 404 });

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

"use client";

import { Camera, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { JobPhoto } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/client";

const signedUrlLifetimeSeconds = 300;
const signedUrlRefreshMilliseconds = 4 * 60 * 1000;

export function JobPhotoGallery({ photos }: { photos: JobPhoto[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (photos.length === 0) return;

    let active = true;

    async function refreshSignedUrls() {
      const results = await Promise.all(photos.map(async (photo) => {
        const { data, error } = await supabase.storage
          .from("job-photos")
          .createSignedUrl(photo.storagePath, signedUrlLifetimeSeconds);
        return { id: photo.id, url: error ? null : data?.signedUrl ?? null };
      }));

      if (!active) return;
      const nextUrls = Object.fromEntries(
        results.flatMap((result) => result.url ? [[result.id, result.url]] : []),
      );
      setSignedUrls(nextUrls);
      setFailed(results.some((result) => !result.url));
    }

    void refreshSignedUrls();
    const refreshTimer = window.setInterval(refreshSignedUrls, signedUrlRefreshMilliseconds);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [photos, supabase]);

  if (photos.length === 0) return null;

  return (
    <section className="job-photo-section">
      <div className="job-photo-heading"><Camera size={17} /><h3>Myndir frá viðskiptavini</h3><span>{photos.length}</span></div>
      <div className="job-photo-grid">
        {photos.map((photo, index) => {
          const signedUrl = signedUrls[photo.id];
          if (!signedUrl) {
            return (
              <div className="job-photo-placeholder" key={photo.id}>
                <span>{failed ? "Mynd ekki tiltæk" : "Hleð mynd…"}</span>
                <small>Mynd {index + 1}</small>
              </div>
            );
          }

          return (
            <a
              href={signedUrl}
              key={photo.id}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Opna mynd ${index + 1}: ${photo.originalFilename}`}
            >
              {/* The browser receives only a short-lived URL after Storage RLS authorizes the object. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`Mynd ${index + 1} frá viðskiptavini`} src={signedUrl} loading="lazy" />
              <span><small>Mynd {index + 1}</small><ExternalLink size={13} /></span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

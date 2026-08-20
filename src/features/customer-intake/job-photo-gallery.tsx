import { Camera, ExternalLink } from "lucide-react";

import type { JobPhoto } from "@/lib/domain/types";

export function JobPhotoGallery({ photos }: { photos: JobPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <section className="job-photo-section">
      <div className="job-photo-heading"><Camera size={17} /><h3>Myndir frá viðskiptavini</h3><span>{photos.length}</span></div>
      <div className="job-photo-grid">
        {photos.map((photo, index) => (
          <a
            href={`/api/job-photos/${photo.id}`}
            key={photo.id}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Opna mynd ${index + 1}: ${photo.originalFilename}`}
          >
            {/* Private images are authorized by the application route before a short signed redirect. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`Mynd ${index + 1} frá viðskiptavini`} src={`/api/job-photos/${photo.id}`} loading="lazy" />
            <span><small>Mynd {index + 1}</small><ExternalLink size={13} /></span>
          </a>
        ))}
      </div>
    </section>
  );
}

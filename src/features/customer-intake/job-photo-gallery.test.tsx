import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JobPhoto } from "@/lib/domain/types";
import { JobPhotoGallery } from "./job-photo-gallery";

const createSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://storage.example.test/signed-photo" },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ createSignedUrl }),
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("staff and driver job photo gallery", () => {
  it("requests a short-lived Storage URL with the authenticated browser client", async () => {
    const photo: JobPhoto = {
      id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
      storagePath: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.jpg",
      originalFilename: "car.jpg",
      contentType: "image/jpeg",
      sizeBytes: 12_345,
      createdAt: "2026-09-08T00:00:00.000Z",
    };

    render(<JobPhotoGallery photos={[photo]} />);

    await waitFor(() => {
      expect(createSignedUrl).toHaveBeenCalledWith(photo.storagePath, 300);
    });
    expect(screen.getByRole("img", { name: "Mynd 1 frá viðskiptavini" }))
      .toHaveAttribute("src", "https://storage.example.test/signed-photo");
    expect(screen.getByRole("link", { name: `Opna mynd 1: ${photo.originalFilename}` }))
      .toHaveAttribute("href", "https://storage.example.test/signed-photo");
  });
});

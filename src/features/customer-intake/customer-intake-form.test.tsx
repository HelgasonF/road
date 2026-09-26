import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  finalizeCustomerPhotoUploadAction,
  prepareCustomerPhotoUploadAction,
} from "./actions";
import { CustomerIntakeForm } from "./customer-intake-form";
import type { ActiveCustomerIntake } from "./queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  finalizeCustomerPhotoUploadAction: vi.fn(),
  prepareCustomerPhotoUploadAction: vi.fn(),
  removeCustomerPhotoAction: vi.fn(async () => ({ ok: true })),
  submitCustomerIntakeAction: vi.fn(),
}));
const uploadToSignedUrl = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl }) } }),
}));
vi.mock("./customer-location-map", () => ({
  CustomerLocationMap: ({ onPick }: { onPick: (latitude: number, longitude: number) => void }) => (
    <button type="button" onClick={() => onPick(64.14, -21.9)}>Pick on map</button>
  ),
}));

const job: ActiveCustomerIntake["job"] = {
  id: "30000000-0000-4000-8000-000000000001",
  customerName: "",
  customerPhone: "+354 6597003",
  vehicleRegistration: null,
  vehicleMake: null,
  rentalCompany: null,
  peopleCount: null,
  requiredCapability: null,
  latitude: 64.95,
  longitude: -18.7,
  locationLabel: "",
  locationSource: "map_pin",
  customerNotes: null,
};

function renderForm() {
  render(<CustomerIntakeForm expiresAt="2026-09-27T16:38:00.000Z" initialPhotos={[]} job={job} token="token" />);
}

function stubGeolocation(code: number) {
  const error = { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "" };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail(error as GeolocationPositionError) },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CustomerIntakeForm", () => {
  it("labels the link expiry time", () => {
    renderForm();

    expect(screen.getByText(/Link valid until 27 Sep 2026, 16:38/)).toBeInTheDocument();
  });

  it("explains a GPS timeout next to the GPS button in the chosen language", async () => {
    stubGeolocation(3);
    renderForm();

    const gpsButton = screen.getByRole("button", { name: /Use my current GPS location/ });
    fireEvent.click(gpsButton);

    const locationCard = gpsButton.closest("section")!;
    expect(await within(locationCard).findByRole("alert")).toHaveTextContent(/took too long/);
    expect(within(locationCard).getByRole("alert")).not.toHaveTextContent(/permission/i);

    fireEvent.click(screen.getByRole("button", { name: "Íslenska" }));
    expect(within(locationCard).getByRole("alert")).toHaveTextContent(/tók of langan tíma/);
  });

  it("fills an empty location description from the map pin", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));

    expect(screen.getByLabelText("Location description")).toHaveValue("Map pin · 64.14000, -21.90000");
  });

  it("keeps a location description the customer typed when the pin moves", () => {
    renderForm();
    const description = screen.getByLabelText("Location description");

    fireEvent.change(description, { target: { value: "Next to the Olís station" } });
    fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));

    expect(description).toHaveValue("Next to the Olís station");
  });

  it("uploads the remaining photos when one fails and names the failed one", async () => {
    vi.mocked(prepareCustomerPhotoUploadAction)
      .mockResolvedValueOnce({ ok: false, error: "Unsupported" })
      .mockResolvedValueOnce({ ok: true, data: { photoId: "p2", path: "job/p2.jpg", uploadToken: "t" } });
    vi.mocked(finalizeCustomerPhotoUploadAction).mockResolvedValue({ ok: true });
    renderForm();

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [
          new File(["a"], "broken.jpg", { type: "image/jpeg" }),
          new File(["b"], "good.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    await waitFor(() => expect(screen.getByText("good.jpg")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("broken.jpg");
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(1);
  });
});

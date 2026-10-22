import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  finalizeCustomerPhotoUploadAction,
  prepareCustomerPhotoUploadAction,
  submitCustomerIntakeAction,
} from "./actions";
import { CustomerIntakeForm } from "./customer-intake-form";
import { startCustomerCheckoutAction } from "@/features/payments/checkout-actions";
import type { ActiveCustomerIntake } from "./queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/payments/checkout-actions", () => ({ startCustomerCheckoutAction: vi.fn() }));
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

  it("uses one Pay and submit button and explains unattended completion", () => {
    render(<CustomerIntakeForm expiresAt="2026-09-27T16:38:00.000Z" initialPhotos={[]} job={job} token="token" payment={{ enabled: true, ready: true, amountIsk: 5000 }} />);
    expect(screen.getByRole("button", { name: "Pay and submit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send details securely" })).not.toBeInTheDocument();
    expect(screen.getByText(/You do not need to return/)).toBeInTheDocument();
    expect(screen.getByText("5,000 ISK")).toBeInTheDocument();
  });

  it("fails closed when payment setup is incomplete", () => {
    render(<CustomerIntakeForm expiresAt="2026-09-27T16:38:00.000Z" initialPhotos={[]} job={job} token="token" payment={{ enabled: true, ready: false, amountIsk: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));
    expect(screen.getByRole("button", { name: "Pay and submit" })).toBeDisabled();
    expect(startCustomerCheckoutAction).not.toHaveBeenCalled();
  });

  it("sends the entered details to checkout without first submitting the intake", async () => {
    vi.mocked(startCustomerCheckoutAction).mockResolvedValueOnce({ ok: false, errorCode: "preview", error: "Payment unavailable in this test." });
    render(<CustomerIntakeForm expiresAt="2026-09-27T16:38:00.000Z" initialPhotos={[]} job={{ ...job, customerName: "Customer", requiredCapability: "jump_start", customerNotes: "Battery is flat." }} token="token" payment={{ enabled: true, ready: true, amountIsk: 5000 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));
    fireEvent.submit(screen.getByRole("button", { name: "Pay and submit" }).closest("form")!);
    await waitFor(() => expect(startCustomerCheckoutAction).toHaveBeenCalledWith(expect.objectContaining({ token: "token", customerName: "Customer", language: "en", locationSource: "map_pin" })));
    expect(submitCustomerIntakeAction).not.toHaveBeenCalled();
    expect(await screen.findByText("Payment unavailable in this test.")).toBeInTheDocument();
  });

  it("explains the missing required description before any checkout action", () => {
    render(<CustomerIntakeForm expiresAt="2026-09-27T16:38:00.000Z" initialPhotos={[]} job={{ ...job, customerName: "Customer", requiredCapability: "jump_start" }} token="token" payment={{ enabled: true, ready: true, amountIsk: 35 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));
    const description = screen.getByLabelText("Description");
    fireEvent.invalid(description);
    expect(screen.getByRole("alert")).toHaveTextContent("Description is required.");
    expect(description).toHaveFocus();
    expect(startCustomerCheckoutAction).not.toHaveBeenCalled();
  });

  it("identifies the first missing field in the customer's chosen language", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Íslenska" }));
    const name = screen.getByLabelText("Fullt nafn");
    fireEvent.invalid(name);
    fireEvent.invalid(screen.getByLabelText("Lýsing"));
    expect(screen.getByRole("alert")).toHaveTextContent("Fullt nafn vantar.");
    expect(name).toHaveFocus();
    expect(submitCustomerIntakeAction).not.toHaveBeenCalled();
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

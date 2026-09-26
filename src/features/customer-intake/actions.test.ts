import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit";
import { prepareCustomerPhotoUploadAction, submitCustomerIntakeAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config", () => ({ hasSupabaseAdminConfig: () => true, isDemoMode: () => false }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestAddress: vi.fn(async () => "203.0.113.7"),
}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
const getActiveCustomerLinkByToken = vi.fn();
vi.mock("./queries", () => ({
  getActiveCustomerLinkByToken: (token: string) => getActiveCustomerLinkByToken(token),
}));

const token = "A".repeat(43);
const submission = {
  token,
  customerName: "Test Customer",
  customerPhone: "+354 6597003",
  vehicleRegistration: "AB123",
  vehicleMake: "Ford",
  rentalCompany: "",
  peopleCount: 1,
  requiredCapability: "jump_start",
  latitude: 64.14,
  longitude: -21.9,
  locationLabel: "Reykjavík",
  locationSource: "map_pin",
  customerNotes: "Battery is flat.",
};
const rateLimitError = "Too many requests. Please wait a few minutes and try again.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customer link rate limiting", () => {
  it("refuses a submission from an address over the limit", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(false);

    await expect(submitCustomerIntakeAction(submission)).resolves.toEqual({ ok: false, error: rateLimitError });
    expect(rpc).not.toHaveBeenCalled();
    expect(consumeRateLimit).toHaveBeenCalledWith("customer:ip:203.0.113.7", 300, 600);
  });

  it("refuses photo preparation from an address over the limit before looking up the link", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(false);

    await expect(
      prepareCustomerPhotoUploadAction({ token, fileName: "car.jpg", contentType: "image/jpeg", sizeBytes: 1000 }),
    ).resolves.toEqual({ ok: false, error: rateLimitError });
    expect(getActiveCustomerLinkByToken).not.toHaveBeenCalled();
  });

  it("submits normally within the limit", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(true);
    rpc.mockResolvedValue({ data: "30000000-0000-4000-8000-000000000001", error: null });

    await expect(submitCustomerIntakeAction(submission)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_customer_intake_v3", expect.objectContaining({ p_vehicle_registration: "AB123" }));
  });
});

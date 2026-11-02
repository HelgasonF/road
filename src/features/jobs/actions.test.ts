import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { saveJobAction } from "./actions";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config", () => ({ isDemoMode: () => false }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));

const input = { id: null, customerName: "Test Customer", customerPhone: "+3546597003", vehicleRegistration: "AB123", vehicleMake: "Ford", rentalCompany: "", peopleCount: 1, latitude: 64.14, longitude: -21.9, locationLabel: "Reykjavík", locationSource: "map_pin" as const, priority: "normal" as const, notes: "", requiredCapabilities: ["towing" as const] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVerifiedStaffSession).mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", role: "dispatcher", displayName: "Staff", email: "staff@example.test", operatorId: null });
  rpc.mockResolvedValue({ data: "30000000-0000-4000-8000-000000000001", error: null });
});

describe("optional dispatcher destinations", () => {
  it.each([["  Workshop  ", "Workshop"], ["", null], [null, null]])("saves an explicitly supplied optional destination %s", async (destinationLabel, expected) => {
    expect((await saveJobAction({ ...input, destinationLabel })).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("save_job_v2", expect.objectContaining({ p_destination_label: expected, p_latitude: 64.14, p_longitude: -21.9 }));
  });
  it("preserves the legacy save path when the field was omitted", async () => {
    expect((await saveJobAction(input)).ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("save_job", expect.not.objectContaining({ p_destination_label: expect.anything() }));
  });
  it("requires a verified staff session before any save", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);
    expect((await saveJobAction({ ...input, destinationLabel: "Workshop" })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a destination field error for an overlong value before any save", async () => {
    expect(await saveJobAction({ ...input, destinationLabel: "x".repeat(301) })).toMatchObject({ ok: false, fieldErrors: { destinationLabel: expect.any(Array) } });
    expect(rpc).not.toHaveBeenCalled();
  });
});

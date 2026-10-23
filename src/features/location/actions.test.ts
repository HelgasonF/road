import { afterEach, describe, expect, it, vi } from "vitest";
import { getVerifiedStaffSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { searchIcelandLocationsAction } from "./actions";

vi.mock("@/lib/auth/session", () => ({ getVerifiedStaffSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe("staff location lookup", () => {
  it("returns an empty successful search so the field can explain no place was found", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue({ id: "staff" } as Awaited<ReturnType<typeof getVerifiedStaffSession>>);
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
    expect(await searchIcelandLocationsAction("í Unknown")).toEqual({ ok: true, data: [] });
    expect(rpc).toHaveBeenCalledWith("search_iceland_addresses", { p_query: "Unknown", p_limit: 8 });
  });

  it("requires staff authentication before searching the catalog", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);
    expect(await searchIcelandLocationsAction("Keflavík")).toMatchObject({ ok: false });
    expect(createClient).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchCustomerLocationsAction } from "./location-actions";
import { customerLinkRequestAllowed } from "./rate-limit";
import { getActiveCustomerLinkByToken } from "./queries";

vi.mock("server-only", () => ({}));
vi.mock("./rate-limit", () => ({ customerLinkRequestAllowed: vi.fn(async () => true), customerRateLimitError: "rate limited" }));
vi.mock("./queries", () => ({ getActiveCustomerLinkByToken: vi.fn(async () => ({ id: "active" })) }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const token = "a".repeat(43);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(customerLinkRequestAllowed).mockResolvedValue(true);
  vi.mocked(getActiveCustomerLinkByToken).mockResolvedValue({ id: "active" } as never);
  rpc.mockResolvedValue({ data: [{ id: "osm:node:1", label: "Keflavík · Bær", latitude: 64, longitude: -22.56 }], error: null });
});

describe("customer location lookup", () => {
  it("requires an active customer token and returns only location suggestions", async () => {
    expect(await searchCustomerLocationsAction({ token, query: "í Keflavik" })).toEqual({ ok: true, data: [{ id: "osm:node:1", label: "Keflavík · Bær", latitude: 64, longitude: -22.56 }] });
    expect(getActiveCustomerLinkByToken).toHaveBeenCalledWith(token);
    expect(rpc).toHaveBeenCalledWith("search_iceland_addresses", { p_query: "Keflavik", p_limit: 8 });
  });

  it("rejects malformed and expired/revoked/submitted links before catalog access", async () => {
    expect(await searchCustomerLocationsAction({ token: "bad", query: "Keflavik" })).toMatchObject({ ok: false });
    expect(getActiveCustomerLinkByToken).not.toHaveBeenCalled();
    vi.mocked(getActiveCustomerLinkByToken).mockResolvedValue(null);
    expect(await searchCustomerLocationsAction({ token, query: "Keflavik" })).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stops a rate-limited request before token or database lookup", async () => {
    vi.mocked(customerLinkRequestAllowed).mockResolvedValue(false);
    expect(await searchCustomerLocationsAction({ token, query: "Keflavik" })).toEqual({ ok: false, error: "rate limited" });
    expect(getActiveCustomerLinkByToken).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a safe error for a catalog outage without exposing provider details", async () => {
    rpc.mockResolvedValue({ error: { message: "private database information" }, data: null });
    const result = await searchCustomerLocationsAction({ token, query: "Keflavik" });
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("private database information");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeRateLimit, requestAddress } from "./rate-limit";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

beforeEach(() => {
  rpc.mockReset();
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
});

describe("requestAddress", () => {
  it("uses the client address Vercel puts first in x-forwarded-for", async () => {
    requestHeaders.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");
    await expect(requestAddress()).resolves.toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then to a shared unknown bucket", async () => {
    requestHeaders.set("x-real-ip", "198.51.100.2");
    await expect(requestAddress()).resolves.toBe("198.51.100.2");
    requestHeaders.delete("x-real-ip");
    await expect(requestAddress()).resolves.toBe("unknown");
  });
});

describe("consumeRateLimit", () => {
  it("passes the bucket and limits to the database", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(consumeRateLimit("login:ip:1", 10, 900)).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_bucket: "login:ip:1",
      p_limit: 10,
      p_window_seconds: 900,
    });
  });

  it("allows the request when the limiter itself is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });

    await expect(consumeRateLimit("login:ip:1", 10, 900)).resolves.toBe(true);
  });
});

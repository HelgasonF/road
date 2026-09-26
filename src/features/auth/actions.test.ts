import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit";
import { loginAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("@/lib/config", () => ({ hasSupabaseConfig: () => true, isDemoMode: () => false }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: vi.fn(),
  requestAddress: vi.fn(async () => "203.0.113.7"),
}));
const signInWithPassword = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));

function credentials(email = "Staff@Example.is") {
  const form = new FormData();
  form.set("email", email);
  form.set("password", "long-enough-password");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginAction rate limiting", () => {
  it("refuses to check the password once the address or account is over the limit", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(loginAction({}, credentials())).resolves.toEqual({
      error: "Of margar innskráningartilraunir. Reyndu aftur eftir nokkrar mínútur.",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("counts attempts per client address and per normalised email", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(true);
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login" } });

    await loginAction({}, credentials());

    expect(vi.mocked(consumeRateLimit).mock.calls.map(([bucket]) => bucket)).toEqual([
      "login:ip:203.0.113.7",
      "login:email:staff@example.is",
    ]);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });
});

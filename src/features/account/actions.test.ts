import { beforeEach, describe, expect, it, vi } from "vitest";

import { getVerifiedAdminSession, getVerifiedStaffSession } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { changeOwnPasswordAction, createStaffUserAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config", () => ({
  isDemoMode: () => false,
  getSupabaseConfig: () => ({ url: "https://example.supabase.co", publishableKey: "sb_publishable_test" }),
}));
vi.mock("@/lib/auth/session", () => ({
  getVerifiedAdminSession: vi.fn(),
  getVerifiedStaffSession: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn(async () => true) }));

const createUser = vi.fn();
const deleteUser = vi.fn();
const updateUserById = vi.fn();
const profileUpdateEq = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser, deleteUser, updateUserById } },
    from: () => ({ update: () => ({ eq: profileUpdateEq }) }),
  }),
}));
const signInWithPassword = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

const admin = { id: "admin-1", email: "freyr@example.is", displayName: "Freyr", role: "admin" as const, operatorId: null };
const dispatcher = { ...admin, id: "dispatcher-1", role: "dispatcher" as const };
const newUser = { displayName: "Daldís", email: "daldis@example.is", password: "daldis2026ira", role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeRateLimit).mockResolvedValue(true);
});

describe("createStaffUserAction", () => {
  it("refuses anyone who is not an admin", async () => {
    vi.mocked(getVerifiedAdminSession).mockResolvedValue(null);

    const result = await createStaffUserAction(newUser);

    expect(result.ok).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates a confirmed login and gives it the chosen role", async () => {
    vi.mocked(getVerifiedAdminSession).mockResolvedValue(admin);
    createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    profileUpdateEq.mockResolvedValue({ error: null });

    await expect(createStaffUserAction(newUser)).resolves.toEqual({ ok: true, data: { id: "new-user" } });
    expect(createUser).toHaveBeenCalledWith({
      email: "daldis@example.is",
      password: "daldis2026ira",
      email_confirm: true,
      user_metadata: { display_name: "Daldís" },
    });
    expect(profileUpdateEq).toHaveBeenCalledWith("id", "new-user");
  });

  it("caps how many users one admin can create in an hour", async () => {
    vi.mocked(getVerifiedAdminSession).mockResolvedValue(admin);
    vi.mocked(consumeRateLimit).mockResolvedValue(false);

    expect((await createStaffUserAction(newUser)).ok).toBe(false);
    expect(consumeRateLimit).toHaveBeenCalledWith("create-staff:admin-1", 20, 3600);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("explains a duplicate email", async () => {
    vi.mocked(getVerifiedAdminSession).mockResolvedValue(admin);
    createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: "exists" } });

    await expect(createStaffUserAction(newUser)).resolves.toEqual({
      ok: false,
      error: "Notandi með þetta netfang er þegar til.",
    });
  });

  it("removes the login again if the role cannot be set, so no half-made user remains", async () => {
    vi.mocked(getVerifiedAdminSession).mockResolvedValue(admin);
    createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    profileUpdateEq.mockResolvedValue({ error: { message: "failed" } });

    const result = await createStaffUserAction(newUser);

    expect(result.ok).toBe(false);
    expect(deleteUser).toHaveBeenCalledWith("new-user");
  });
});

describe("changeOwnPasswordAction", () => {
  const input = { currentPassword: "old2026pass", newPassword: "new2026pass", confirmPassword: "new2026pass" };

  it("refuses without a staff session", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(null);

    expect((await changeOwnPasswordAction(input)).ok).toBe(false);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses when the current password is wrong", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(dispatcher);
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });

    await expect(changeOwnPasswordAction(input)).resolves.toEqual({ ok: false, error: "Núverandi lykilorð er rangt." });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("changes only the signed-in user's own password", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(dispatcher);
    signInWithPassword.mockResolvedValue({ data: { user: { id: "dispatcher-1" } }, error: null });
    updateUserById.mockResolvedValue({ error: null });

    await expect(changeOwnPasswordAction(input)).resolves.toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "freyr@example.is", password: "old2026pass" });
    expect(updateUserById).toHaveBeenCalledWith("dispatcher-1", { password: "new2026pass" });
  });

  it("limits repeated attempts to guess the current password", async () => {
    vi.mocked(getVerifiedStaffSession).mockResolvedValue(dispatcher);
    vi.mocked(consumeRateLimit).mockResolvedValue(false);

    expect((await changeOwnPasswordAction(input)).ok).toBe(false);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

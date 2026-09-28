import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { changeOwnPasswordAction, createStaffUserAction } from "./actions";
import { AccountWorkspace } from "./account-workspace";

vi.mock("server-only", () => ({}));
vi.mock("./actions", () => ({ changeOwnPasswordAction: vi.fn(), createStaffUserAction: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ logoutAction: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const admin = { id: "a", email: "freyr@example.is", displayName: "Freyr", role: "admin" as const, operatorId: null };
const dispatcher = { ...admin, id: "d", email: "vakt@example.is", displayName: "Vakt", role: "dispatcher" as const };
const staff = [
  { id: "a", email: "freyr@example.is", displayName: "Freyr", role: "admin" as const, createdAt: "2026-09-06T12:00:00Z" },
  { id: "d", email: "vakt@example.is", displayName: "Vakt", role: "dispatcher" as const, createdAt: "2026-09-28T12:00:00Z" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fill(label: string, value: string, scope: HTMLElement = document.body) {
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
}

describe("AccountWorkspace", () => {
  it("lets a dispatcher change their password but hides user management", () => {
    render(<AccountWorkspace identity={dispatcher} staff={[]} />);

    expect(screen.getByRole("heading", { name: "Breyta lykilorði" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Notendur" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Búa til notanda" })).not.toBeInTheDocument();
  });

  it("lists staff with their roles for an admin", () => {
    render(<AccountWorkspace identity={admin} staff={staff} />);

    const list = screen.getByRole("list", { name: "Starfsfólk" });
    expect(within(list).getByText("Vakt")).toBeInTheDocument();
    expect(within(list).getByText("Aðgerðastjóri")).toBeInTheDocument();
    expect(within(list).getByText("Stjórnandi")).toBeInTheDocument();
  });

  it("changes the password and clears the form", async () => {
    vi.mocked(changeOwnPasswordAction).mockResolvedValue({ ok: true });
    render(<AccountWorkspace identity={dispatcher} staff={[]} />);

    fill("Núverandi lykilorð", "old2026pass");
    fill("Nýtt lykilorð", "new2026pass");
    fill("Endurtaka nýtt lykilorð", "new2026pass");
    fireEvent.click(screen.getByRole("button", { name: "Vista nýtt lykilorð" }));

    expect(await screen.findByText("Lykilorðinu hefur verið breytt.")).toBeInTheDocument();
    expect(changeOwnPasswordAction).toHaveBeenCalledWith({
      currentPassword: "old2026pass",
      newPassword: "new2026pass",
      confirmPassword: "new2026pass",
    });
    expect(screen.getByLabelText("Núverandi lykilorð")).toHaveValue("");
  });

  it("shows why a password change failed", async () => {
    vi.mocked(changeOwnPasswordAction).mockResolvedValue({ ok: false, error: "Núverandi lykilorð er rangt." });
    render(<AccountWorkspace identity={dispatcher} staff={[]} />);

    fill("Núverandi lykilorð", "wrong2026x");
    fill("Nýtt lykilorð", "new2026pass");
    fill("Endurtaka nýtt lykilorð", "new2026pass");
    fireEvent.click(screen.getByRole("button", { name: "Vista nýtt lykilorð" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Núverandi lykilorð er rangt.");
  });

  it("creates a user with the chosen role and refreshes the list", async () => {
    vi.mocked(createStaffUserAction).mockResolvedValue({ ok: true, data: { id: "new" } });
    render(<AccountWorkspace identity={admin} staff={staff} />);
    const form = screen.getByRole("form", { name: "Nýr notandi" });

    fill("Nafn", "Daldís", form);
    fill("Netfang", "daldis@example.is", form);
    fill("Lykilorð", "daldis2026ira", form);
    fireEvent.change(within(form).getByLabelText("Hlutverk"), { target: { value: "admin" } });
    fireEvent.click(within(form).getByRole("button", { name: "Búa til notanda" }));

    await waitFor(() => expect(createStaffUserAction).toHaveBeenCalledWith({
      displayName: "Daldís",
      email: "daldis@example.is",
      password: "daldis2026ira",
      role: "admin",
    }));
    expect(await screen.findByText(/Notandinn Daldís var búinn til/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuickCustomerIntakeJobAction } from "@/features/customer-intake/actions";
import { JobEditor } from "./editor";

vi.mock("server-only", () => ({}));
vi.mock("@/features/customer-intake/actions", () => ({
  createQuickCustomerIntakeJobAction: vi.fn(),
}));
vi.mock("./actions", () => ({ saveJobAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("quick customer intake handoff", () => {
  it("prepares a copyable customer message without claiming WhatsApp sent it", async () => {
    vi.mocked(createQuickCustomerIntakeJobAction).mockResolvedValue({
      ok: true,
      data: {
        jobId: "30000000-0000-4000-8000-000000000001",
        path: "/customer/one-time-token",
        expiresAt: "2026-09-27T12:00:00.000Z",
      },
    });
    const onQuickCreated = vi.fn();
    render(<JobEditor capabilities={[]} job={null} onClose={vi.fn()} onQuickCreated={onQuickCreated} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("6597003 eða erlent númer með landskóða"), {
      target: { value: "6597003" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Búa til WhatsApp-tengil" }));

    const copyButton = await screen.findByRole("button", { name: "Afrita skilaboð til 6597003" });
    const openLink = screen.getByRole("link", { name: "Opna WhatsApp fyrir 6597003" });
    const message = new URL(openLink.getAttribute("href")!).searchParams.get("text");

    expect(copyButton).toBeInTheDocument();
    expect(message).toContain("http://localhost:3000/customer/one-time-token");
    expect(openLink).toHaveAttribute("href", expect.stringContaining("https://wa.me/3546597003"));
    expect(screen.getByText("Verkefnið og tengillinn eru tilbúin")).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp tók við sjálfvirku sendingunni/)).not.toBeInTheDocument();
    expect(onQuickCreated).toHaveBeenCalledWith("30000000-0000-4000-8000-000000000001");
  });
});

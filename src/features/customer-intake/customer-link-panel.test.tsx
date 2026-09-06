import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCustomerIntakeLinkAction,
  revokeCustomerIntakeLinkAction,
} from "./actions";
import { CustomerLinkPanel } from "./customer-link-panel";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("./actions", () => ({
  createCustomerIntakeLinkAction: vi.fn(),
  revokeCustomerIntakeLinkAction: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(createCustomerIntakeLinkAction).mockResolvedValue({
    ok: true,
    data: {
      linkId: "50000000-0000-4000-8000-000000000001",
      path: "/customer/test-secure-token",
      expiresAt: "2026-08-26T12:00:00.000Z",
    },
  });
  vi.mocked(revokeCustomerIntakeLinkAction).mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("customer intake link handoff", () => {
  it("opens a direct prewritten WhatsApp message for the registered customer", async () => {
    render(
      <CustomerLinkPanel
        customerName="Sophie Martin"
        customerPhone="+33 6 12 34 56 78"
        jobId="30000000-0000-4000-8000-000000000001"
        link={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Búa til tengil" }));

    const whatsapp = await screen.findByRole("link", {
      name: "Senda öruggan tengil til Sophie Martin í WhatsApp",
    });
    const url = new URL(whatsapp.getAttribute("href")!);

    expect(url.origin + url.pathname).toBe("https://wa.me/33612345678");
    expect(url.searchParams.get("text")).toContain("Sophie Martin");
    expect(url.searchParams.get("text")).toContain("http://localhost:3000/customer/test-secure-token");
    expect(screen.queryByRole("button", { name: "Afrita" })).not.toBeInTheDocument();
  });
});

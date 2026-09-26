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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
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
      name: "Opna WhatsApp fyrir Sophie Martin",
    });
    const url = new URL(whatsapp.getAttribute("href")!);

    expect(url.origin + url.pathname).toBe("https://wa.me/33612345678");
    expect(url.searchParams.get("text")).toContain("Sophie Martin");
    expect(url.searchParams.get("text")).toContain("http://localhost:3000/customer/test-secure-token");
    fireEvent.click(screen.getByRole("button", { name: "Afrita skilaboð til Sophie Martin" }));
    expect(await screen.findByText(/Skilaboðin voru afrituð/)).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url.searchParams.get("text"));
    expect(screen.queryByText(/WhatsApp tók við sjálfvirku sendingunni/)).not.toBeInTheDocument();
  });

  it("keeps the prepared message available when the phone cannot open a WhatsApp link", async () => {
    render(
      <CustomerLinkPanel
        customerName="Sophie Martin"
        customerPhone="invalid"
        jobId="30000000-0000-4000-8000-000000000001"
        link={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Búa til tengil" }));
    expect(await screen.findByRole("button", { name: "Afrita skilaboð til Sophie Martin" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Opna WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Athugaðu númerið áður en þú sendir/)).toBeInTheDocument();
  });
});

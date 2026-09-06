import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDriverAccessLinkAction,
  setDriverAccessDisabledAction,
} from "./actions";
import { demoOperators } from "./demo-data";
import { DriverAccessPanel } from "./driver-access-panel";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("./actions", () => ({
  createDriverAccessLinkAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { path: "/driver/access?token_hash=secure-token&type=magiclink" },
  }),
  setDriverAccessDisabledAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { message: "Aðgangur var uppfærður." },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("driver access panel", () => {
  it("creates a driver account link for the registered WhatsApp number without asking for email", async () => {
    const operator = demoOperators[0];
    render(<DriverAccessPanel demoMode={false} operator={operator} />);

    expect(screen.queryByRole("textbox", { name: /Netfang/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Búa til aðgangstengil" }));

    expect(createDriverAccessLinkAction).toHaveBeenCalledWith({ operatorId: operator.id });
    const link = await screen.findByRole("link", { name: `Senda ökumannsaðgang til ${operator.name} í WhatsApp` });
    const message = new URL(link.getAttribute("href")!).searchParams.get("text");
    expect(message).toContain("http://localhost:3000/driver/access?token_hash=secure-token&type=magiclink");
    expect(message).toContain("öruggur aðgangstengill");
    expect(message).not.toContain("netfang");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps immediate disabling available for an active driver", async () => {
    render(<DriverAccessPanel demoMode={false} operator={demoOperators[1]} />);

    fireEvent.click(screen.getByRole("button", { name: "Loka aðgangi" }));
    fireEvent.click(screen.getByRole("button", { name: "Staðfesta lokun" }));

    expect(setDriverAccessDisabledAction).toHaveBeenCalledWith({
      operatorId: demoOperators[1].id,
      disabled: true,
    });
  });
});

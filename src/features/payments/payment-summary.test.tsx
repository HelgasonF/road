import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentSummary } from "./payment-summary";
import { safeCheckoutUrl, type PublicPaymentSummary } from "./public-summary";
import type { PaymentRequest } from "./types";
import { openServiceCheckoutAction, resumeCustomerCheckoutAction } from "./checkout-actions";

vi.mock("./checkout-actions", () => ({ resumeCustomerCheckoutAction: vi.fn(), openServiceCheckoutAction: vi.fn() }));

afterEach(cleanup);
const summary: PublicPaymentSummary = {
  purpose: "service", description: "Jump start service", vehicleRegistration: "AB123", amountIsk: 27000,
  status: "pending", checkoutUrl: "https://mypos.eu/pr/B123", intakeState: null,
};

describe("private payment summary", () => {
  it("shows the service and second amount with a server-checked Pay button", () => {
    render(<PaymentSummary summary={{ ...summary, checkoutUrl: null, serviceCheckoutAvailable: true }} serviceToken={"A".repeat(43)} />);
    expect(screen.getByText("Jump start service")).toBeInTheDocument();
    expect(screen.getByText("AB123")).toBeInTheDocument();
    expect(screen.getByText("27,000 ISK")).toBeInTheDocument();
    expect(screen.getByText(/separate from the initial/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay securely/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pay securely/ })).not.toBeInTheDocument();
  });
  it("checks its token again at Pay and explains a replaced link without opening checkout", async () => {
    const token = "A".repeat(43);
    vi.mocked(openServiceCheckoutAction).mockResolvedValueOnce({ ok: false, errorCode: "payment_link_unavailable", error: "Unavailable" });
    render(<PaymentSummary summary={{ ...summary, checkoutUrl: null, serviceCheckoutAvailable: true }} serviceToken={token} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay securely/ }));
    await waitFor(() => expect(openServiceCheckoutAction).toHaveBeenCalledWith({ token }));
    expect(await screen.findByRole("alert")).toHaveTextContent("contact Iceland Road Assistance dispatch");
  });
  it("does not offer payment again after Paid", () => {
    render(<PaymentSummary summary={{ ...summary, status: "paid", checkoutUrl: null }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Payment received");
    expect(screen.queryByRole("link", { name: /Pay/ })).not.toBeInTheDocument();
  });
  it("retries a saved rejected draft with only its token and selected display language", async () => {
    vi.mocked(resumeCustomerCheckoutAction).mockResolvedValueOnce({ ok: false, errorCode: "payment_unavailable", error: "Greiðslan þarfnast yfirferðar." });
    const token = "A".repeat(43);
    render(<PaymentSummary summary={{ ...summary, purpose: "initial_fee", status: "creation_failed", checkoutUrl: null, retryAllowed: true }} initialToken={token} />);
    fireEvent.click(screen.getByRole("button", { name: "Íslenska" }));
    fireEvent.click(screen.getByRole("button", { name: "Reyna greiðslu aftur" }));
    await waitFor(() => expect(resumeCustomerCheckoutAction).toHaveBeenCalledWith({ token, language: "is" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Greiðslan þarfnast yfirferðar.");
  });
  it.each(["creation_unknown", "creating", "paid"] as const)("does not offer retries for %s", (status) => {
    render(<PaymentSummary summary={{ ...summary, status, checkoutUrl: null }} initialToken={"A".repeat(43)} />);
    expect(screen.queryByRole("button", { name: "Try payment again" })).not.toBeInTheDocument();
  });
  it("explains first-payment completion without a return visit in both languages", () => {
    render(<PaymentSummary summary={{ ...summary, purpose: "initial_fee", intakeState: "pending" }} />);
    expect(screen.getByText(/do not need to return/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Íslenska" }));
    expect(screen.getByText(/þarft ekki að fara aftur/)).toBeInTheDocument();
  });
  it.each(["expired", "cancelled", "creation_unknown", "creation_failed", "creating", "paid"] as const)("never exposes checkout for %s", (status) => {
    expect(safeCheckoutUrl({ status, paymentUrl: summary.checkoutUrl, environment: "production" } as PaymentRequest)).toBeNull();
  });
  it.each(["https://evil.example/pr/B123", "https://demo.mypos.eu/pr/B123", "https://user:password@mypos.eu/pr/B123", "https://mypos.eu:444/pr/B123", "http://mypos.eu/pr/B123"])("refuses unsafe or cross-environment destinations: %s", (paymentUrl) => {
    expect(safeCheckoutUrl({ status: "pending", paymentUrl, environment: "production" } as PaymentRequest)).toBeNull();
  });
});

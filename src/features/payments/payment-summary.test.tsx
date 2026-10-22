import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaymentSummary } from "./payment-summary";
import { safeCheckoutUrl, type PublicPaymentSummary } from "./public-summary";
import type { PaymentRequest } from "./types";

afterEach(cleanup);
const summary: PublicPaymentSummary = {
  purpose: "service", description: "Jump start service", vehicleRegistration: "AB123", amountIsk: 27000,
  status: "pending", checkoutUrl: "https://mypos.eu/pr/B123", intakeState: null,
};

describe("private payment summary", () => {
  it("shows the service, vehicle, separate second amount and hosted checkout", () => {
    render(<PaymentSummary summary={summary} />);
    expect(screen.getByText("Jump start service")).toBeInTheDocument();
    expect(screen.getByText("AB123")).toBeInTheDocument();
    expect(screen.getByText("27,000 ISK")).toBeInTheDocument();
    expect(screen.getByText(/separate from the initial/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pay securely/ })).toHaveAttribute("href", summary.checkoutUrl);
  });
  it("does not offer payment again after Paid", () => {
    render(<PaymentSummary summary={{ ...summary, status: "paid", checkoutUrl: null }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Payment received");
    expect(screen.queryByRole("link", { name: /Pay/ })).not.toBeInTheDocument();
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

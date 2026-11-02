import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentPanel } from "./payment-panel";
import { createServicePaymentLinkAction, getPaymentPanelAction, replaceServicePaymentLinkAction } from "./checkout-actions";
import { verifyJobPaymentRequestAction } from "./actions";
import type { PaymentRequest } from "./types";

vi.mock("./checkout-actions", () => ({ createServicePaymentLinkAction: vi.fn(), replaceServicePaymentLinkAction: vi.fn(), getPaymentPanelAction: vi.fn() }));
vi.mock("./actions", () => ({ verifyJobPaymentRequestAction: vi.fn() }));
const props = { jobId: "30000000-0000-4000-8000-000000000001", customerName: "Customer", customerPhone: "+3545550101", intakePending: false };
const state = { enabled: true, ready: true, environment: "production" as const, requests: [] as PaymentRequest[], serviceDescription: null as string | null, intakeReviewRequired: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: state });
  vi.mocked(createServicePaymentLinkAction).mockResolvedValue({ ok: true, data: { path: `/pay/${"A".repeat(43)}`, paymentId: "payment" } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("dispatcher service payment", () => {
  it("edits the unpaid second amount and prepares a replacement using its expected ID", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, serviceDescription: "Old towing", requests: [{ purpose: "service", environment: "production", status: "pending", amountIsk: 28000, id: "payment", providerCode: "B123" } as PaymentRequest] } });
    vi.mocked(replaceServicePaymentLinkAction).mockResolvedValue({ ok: true, data: { path: `/pay/${"B".repeat(43)}`, paymentId: "replacement" } });
    render(<PaymentPanel {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Breyta upphæð eða lýsingu" }));
    fireEvent.change(screen.getByLabelText("Upphæð fyrir þjónustu (ISK)"), { target: { value: "32000" } });
    fireEvent.change(screen.getByLabelText("Lýsing fyrir viðskiptavin"), { target: { value: "Revised towing" } });
    fireEvent.click(screen.getByRole("button", { name: "Skipta út og búa til nýjan tengil" }));
    await waitFor(() => expect(replaceServicePaymentLinkAction).toHaveBeenCalledWith({ jobId: props.jobId, paymentId: "payment", amountIsk: 32000, description: "Revised towing" }));
    expect(createServicePaymentLinkAction).not.toHaveBeenCalled();
  });
  it("shows a late payment on an older request and blocks another collection", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, requests: [
      { purpose: "service", environment: "production", status: "paid", amountIsk: 28000, id: "old", supersededAt: "2026-11-02T19:00:00Z" },
      { purpose: "service", environment: "production", status: "pending", amountIsk: 32000, id: "current", providerCode: "B124" },
    ] as PaymentRequest[] } });
    render(<PaymentPanel {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("eldri greiðslubeiðni");
    expect(screen.queryByLabelText("Upphæð fyrir þjónustu (ISK)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Breyta upphæð eða lýsingu" })).not.toBeInTheDocument();
  });
  it("cancels an edit without changing or replacing the existing request", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, serviceDescription: "Original towing", requests: [{ purpose: "service", environment: "production", status: "pending", amountIsk: 28000, id: "payment" } as PaymentRequest] } });
    render(<PaymentPanel {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Breyta upphæð eða lýsingu" }));
    fireEvent.change(screen.getByLabelText("Upphæð fyrir þjónustu (ISK)"), { target: { value: "32000" } });
    fireEvent.click(screen.getByRole("button", { name: "Hætta við breytingu" }));
    expect(screen.getByLabelText("Upphæð fyrir þjónustu (ISK)")).toHaveValue(28000);
    expect(screen.getByLabelText("Lýsing fyrir viðskiptavin")).toHaveValue("Original towing");
    expect(replaceServicePaymentLinkAction).not.toHaveBeenCalled();
  });
  it.each(["creation_unknown", "creating", "paid"] as const)("does not offer replacement for %s", async (status) => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, requests: [{ purpose: "service", environment: "production", status, amountIsk: 28000, id: "payment" } as PaymentRequest] } });
    render(<PaymentPanel {...props} />);
    await screen.findByText(/ISK ·/);
    expect(screen.queryByRole("button", { name: "Breyta upphæð eða lýsingu" })).not.toBeInTheDocument();
  });
  it("uses the manually entered amount and description and prepares a manual WhatsApp draft", async () => {
    render(<PaymentPanel {...props} />);
    const amount = await screen.findByLabelText("Upphæð fyrir þjónustu (ISK)");
    fireEvent.change(amount, { target: { value: "27000" } });
    fireEvent.change(screen.getByLabelText("Lýsing fyrir viðskiptavin"), { target: { value: "Jump start service" } });
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, serviceDescription: "Jump start service", requests: [{ purpose: "service", environment: "production", status: "pending", amountIsk: 27000, id: "payment", providerCode: "B123" } as PaymentRequest] } });
    fireEvent.click(screen.getByRole("button", { name: "Undirbúa seinni greiðslu" }));
    await waitFor(() => expect(createServicePaymentLinkAction).toHaveBeenCalledWith({ jobId: props.jobId, amountIsk: 27000, description: "Jump start service" }));
    const message = await screen.findByLabelText("Tilbúin skilaboð");
    expect((message as HTMLTextAreaElement).value).toContain("Jump start service");
    expect((message as HTMLTextAreaElement).value).toContain("/pay/");
    expect((message as HTMLTextAreaElement).value).toContain("Amount: 27,000 ISK");
    expect(screen.getByRole("link", { name: /Opna WhatsApp fyrir Customer/ })).toHaveAttribute("href", expect.stringContaining("wa.me/3545550101"));
    const sms = screen.getByRole("link", { name: "Opna SMS fyrir Customer" });
    expect(new URL(sms.getAttribute("href")!).searchParams.get("body")).toBe((message as HTMLTextAreaElement).value);
    sms.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(sms);
    expect(createServicePaymentLinkAction).toHaveBeenCalledTimes(1);
  });
  it("reissues the same payment with its frozen amount and description", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, serviceDescription: "Existing service", requests: [{ purpose: "service", environment: "production", status: "pending", amountIsk: 28000, id: "payment", providerCode: "B123" } as PaymentRequest] } });
    render(<PaymentPanel {...props} />);
    expect(await screen.findByLabelText("Upphæð fyrir þjónustu (ISK)")).toBeDisabled();
    expect(screen.getByLabelText("Lýsing fyrir viðskiptavin")).toHaveValue("Existing service");
    fireEvent.click(screen.getByRole("button", { name: "Nýr tengill fyrir sömu greiðslu" }));
    await waitFor(() => expect(createServicePaymentLinkAction).toHaveBeenCalledWith({ jobId: props.jobId, amountIsk: 28000, description: "Existing service" }));
  });
  it("does not offer a second charge while initial customer intake is pending", async () => {
    render(<PaymentPanel {...props} intakePending />);
    expect(await screen.findByText(/greiðir upphafsgjaldið/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Upphæð fyrir þjónustu (ISK)")).not.toBeInTheDocument();
  });
  it("lets staff retry a rejected service payment using its locked details", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: { ...state, serviceDescription: "Existing service", requests: [{ purpose: "service", environment: "production", status: "creation_failed", errorCode: "payment_provider_rejected", amountIsk: 28000, id: "payment", providerCode: null, paymentUrl: null } as PaymentRequest] } });
    render(<PaymentPanel {...props} />);
    const retry = await screen.findByRole("button", { name: "Reyna undirbúning greiðslu aftur" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(createServicePaymentLinkAction).toHaveBeenCalledWith({ jobId: props.jobId, amountIsk: 28000, description: "Existing service" }));
  });
});

describe("automatic dispatcher payment status", () => {
  beforeEach(() => vi.useFakeTimers());

  function snapshot(purpose: "initial_fee" | "service", status: "pending" | "paid") {
    return { ...state, requests: [{ purpose, environment: "production", status,
      amountIsk: purpose === "initial_fee" ? 10490 : 27000, id: "payment", providerCode: "B123" } as PaymentRequest] };
  }

  it("discovers the first checkout created on the customer's phone after dispatch opened the job", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValueOnce({ ok: true, data: state })
      .mockResolvedValue({ ok: true, data: snapshot("initial_fee", "pending") });
    await act(async () => { render(<PaymentPanel {...props} intakePending />); });
    expect(screen.queryByText(/Bíður greiðslu/)).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText(/Bíður greiðslu/)).toBeInTheDocument();
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(2);
    expect(verifyJobPaymentRequestAction).not.toHaveBeenCalled();
    expect(createServicePaymentLinkAction).not.toHaveBeenCalled();
  });

  it("reads the verified payment when the submitted intake reaches the open dispatcher screen", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValueOnce({ ok: true, data: state })
      .mockResolvedValue({ ok: true, data: snapshot("initial_fee", "paid") });
    const view = await act(async () => render(<PaymentPanel {...props} intakePending />));
    await act(async () => { view.rerender(<PaymentPanel {...props} intakePending={false} />); });
    expect(screen.getByText(/ISK · Greitt/)).toBeInTheDocument();
    expect(screen.getByLabelText("Upphæð fyrir þjónustu (ISK)")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(2);
  });

  it.each(["initial_fee", "service"] as const)("automatically shows the verified %s payment and stops polling when paid", async (purpose) => {
    vi.mocked(getPaymentPanelAction).mockResolvedValueOnce({ ok: true, data: snapshot(purpose, "pending") })
      .mockResolvedValue({ ok: true, data: snapshot(purpose, "paid") });
    await act(async () => { render(<PaymentPanel {...props} />); });
    expect(screen.getByText(/Bíður greiðslu/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText(/ISK · Greitt/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(2);
    expect(verifyJobPaymentRequestAction).not.toHaveBeenCalled();
    expect(createServicePaymentLinkAction).not.toHaveBeenCalled();
  });

  it("pauses background reads in a hidden tab and refreshes when dispatch returns", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: snapshot("service", "pending") });
    await act(async () => { render(<PaymentPanel {...props} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(2);
  });

  it("keeps the known payment state during a failed refresh and retries without creating another request", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValueOnce({ ok: true, data: snapshot("service", "pending") })
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue({ ok: true, data: snapshot("service", "paid") });
    await act(async () => { render(<PaymentPanel {...props} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText(/Bíður greiðslu/)).toBeInTheDocument();
    expect(screen.getByText(/Reyni aftur sjálfkrafa/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText(/ISK · Greitt/)).toBeInTheDocument();
    expect(screen.queryByText(/Reyni aftur sjálfkrafa/)).not.toBeInTheDocument();
    expect(createServicePaymentLinkAction).not.toHaveBeenCalled();
  });

  it("stops background reads after leaving the job", async () => {
    vi.mocked(getPaymentPanelAction).mockResolvedValue({ ok: true, data: snapshot("service", "pending") });
    let unmount: () => void;
    await act(async () => { ({ unmount } = render(<PaymentPanel {...props} />)); });
    unmount!();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(1);
  });

  it("does not queue overlapping status reads while the network is slow", async () => {
    let finishRead!: (result: Awaited<ReturnType<typeof getPaymentPanelAction>>) => void;
    const delayed = new Promise<Awaited<ReturnType<typeof getPaymentPanelAction>>>((resolve) => { finishRead = resolve; });
    vi.mocked(getPaymentPanelAction).mockResolvedValueOnce({ ok: true, data: snapshot("service", "pending") })
      .mockReturnValueOnce(delayed);
    await act(async () => { render(<PaymentPanel {...props} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(getPaymentPanelAction).toHaveBeenCalledTimes(2);
    await act(async () => { finishRead({ ok: true, data: snapshot("service", "paid") }); });
    expect(screen.getByText(/ISK · Greitt/)).toBeInTheDocument();
  });
});

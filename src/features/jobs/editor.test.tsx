import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuickCustomerIntakeJobAction } from "@/features/customer-intake/actions";
import { JobEditor } from "./editor";
import { saveJobAction } from "./actions";
import { searchIcelandLocationsAction } from "@/features/location/actions";
import { demoJobs } from "./demo-data";
import { jobInputSchema } from "./schemas";

vi.mock("server-only", () => ({}));
vi.mock("@/features/customer-intake/actions", () => ({
  createQuickCustomerIntakeJobAction: vi.fn(),
}));
vi.mock("./actions", () => ({ saveJobAction: vi.fn() }));
vi.mock("@/features/location/actions", () => ({ searchIcelandLocationsAction: vi.fn(), findNearestIcelandAddressAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("typed dispatcher locations and validation", () => {
  it("keeps optional fields in the server schema's input format until the save action validates them", async () => {
    vi.mocked(saveJobAction).mockImplementation(async (input) => {
      const parsed = jobInputSchema.safeParse(input);
      return parsed.success ? { ok: true, data: { id: demoJobs[0].id } }
        : { ok: false, error: "Invalid server input", fieldErrors: parsed.error.flatten().fieldErrors };
    });
    const onSaved = vi.fn();
    render(<JobEditor capabilities={[]} job={{ ...demoJobs[0], vehicleRegistration: null, vehicleMake: null, rentalCompany: null, notes: null }} onClose={vi.fn()} onQuickCreated={vi.fn()} onSaved={onSaved} />);
    fireEvent.submit(screen.getByRole("button", { name: "Vista" }).closest("form")!);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(demoJobs[0].id));
    expect(saveJobAction).toHaveBeenCalledWith(expect.objectContaining({ vehicleRegistration: "", vehicleMake: "", rentalCompany: "", notes: "" }));
  });

  it("creates a job from a typed town without requiring a result or map click", async () => {
    vi.mocked(searchIcelandLocationsAction).mockResolvedValue({ ok: true, data: [{ id: "osm:node:1", label: "Keflavík · Bær", latitude: 64, longitude: -22.56 }] });
    vi.mocked(saveJobAction).mockResolvedValue({ ok: true, data: { id: demoJobs[0].id } });
    render(<JobEditor capabilities={[]} job={demoJobs[0]} onClose={vi.fn()} onQuickCreated={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Heimilisfang eða staðarheiti" }), { target: { value: "í Keflavik" } });
    fireEvent.submit(screen.getByRole("button", { name: "Vista" }).closest("form")!);
    await waitFor(() => expect(saveJobAction).toHaveBeenCalledWith(expect.objectContaining({ locationSource: "search", latitude: 64, longitude: -22.56, locationLabel: "Keflavík · Bær · Áætluð staðsetning" })));
  });

  it("identifies the invalid field, focuses it and preserves entered values", async () => {
    render(<JobEditor capabilities={[]} job={demoJobs[0]} onClose={vi.fn()} onQuickCreated={vi.fn()} onSaved={vi.fn()} />);
    const people = screen.getByRole("spinbutton", { name: "Fjöldi fólks" });
    fireEvent.change(people, { target: { value: "0" } });
    fireEvent.submit(screen.getByRole("button", { name: "Vista" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sláðu inn heilan fólksfjölda frá 1 til 99.");
    expect(people).toHaveAttribute("aria-invalid", "true");
    expect(people).toHaveFocus();
    expect(screen.getByDisplayValue(demoJobs[0].customerName)).toBeInTheDocument();
    expect(saveJobAction).not.toHaveBeenCalled();
  });
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

    fireEvent.change(screen.getByRole("combobox", { name: "Landsnúmer fyrir Sími viðskiptavinar" }), { target: { value: "IS" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Sími viðskiptavinar" }), {
      target: { value: "6597003" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Búa til WhatsApp-tengil" }));

    const copyButton = await screen.findByRole("button", { name: "Afrita skilaboð til +354 659 7003" });
    const openLink = screen.getByRole("link", { name: "Opna WhatsApp fyrir +354 659 7003" });
    const message = new URL(openLink.getAttribute("href")!).searchParams.get("text");

    expect(copyButton).toBeInTheDocument();
    expect(message).toContain("http://localhost:3000/customer/one-time-token");
    expect(openLink).toHaveAttribute("href", expect.stringContaining("https://wa.me/3546597003"));
    expect(screen.getByText("Verkefnið og tengillinn eru tilbúin")).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp tók við sjálfvirku sendingunni/)).not.toBeInTheDocument();
    expect(onQuickCreated).toHaveBeenCalledWith("30000000-0000-4000-8000-000000000001");
    expect(createQuickCustomerIntakeJobAction).toHaveBeenCalledWith({ customerPhone: "+3546597003" });
  });
});

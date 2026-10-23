import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchIcelandLocationsAction } from "@/features/location/actions";
import { saveOperatorAction } from "./actions";
import { demoOperators } from "./demo-data";
import { OperatorEditor } from "./editors";

vi.mock("./actions", () => ({ saveOperatorAction: vi.fn(), saveVehicleAction: vi.fn() }));
vi.mock("@/features/location/actions", () => ({ searchIcelandLocationsAction: vi.fn(), findNearestIcelandAddressAction: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("provider editor shared location input", () => {
  it("waits for the typed location before saving its label and coordinates", async () => {
    vi.mocked(searchIcelandLocationsAction).mockResolvedValue({ ok: true, data: [{ id: "hms:1", label: "Hafnargata 12, Keflavík", latitude: 64.001, longitude: -22.55 }] });
    vi.mocked(saveOperatorAction).mockResolvedValue({ ok: true, data: { id: demoOperators[0].id } });
    render(<OperatorEditor capabilities={[]} operator={demoOperators[0]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Heimilisfang eða bækistöð" }), { target: { value: "Hafnargata 12" } });
    fireEvent.submit(screen.getByRole("button", { name: "Vista" }).closest("form")!);
    await waitFor(() => expect(saveOperatorAction).toHaveBeenCalledWith(expect.objectContaining({ baseAddress: "Hafnargata 12, Keflavík", baseLatitude: 64.001, baseLongitude: -22.55 })));
  });

  it("keeps an unresolved location out of the save action", async () => {
    vi.mocked(searchIcelandLocationsAction).mockResolvedValue({ ok: true, data: [] });
    render(<OperatorEditor capabilities={[]} operator={demoOperators[0]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Heimilisfang eða bækistöð" }), { target: { value: "Unknown" } });
    fireEvent.submit(screen.getByRole("button", { name: "Vista" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Staðsetning fannst ekki");
    expect(saveOperatorAction).not.toHaveBeenCalled();
  });
});

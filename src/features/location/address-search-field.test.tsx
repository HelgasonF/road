import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressSearchField, type AddressSearchFieldHandle } from "./address-search-field";
import { searchIcelandLocationsAction } from "./actions";

vi.mock("./actions", () => ({ searchIcelandLocationsAction: vi.fn(), findNearestIcelandAddressAction: vi.fn() }));
const town = { id: "osm:node:1", label: "Keflavík · Bær", latitude: 64, longitude: -22.56 };
beforeEach(() => vi.mocked(searchIcelandLocationsAction).mockResolvedValue({ ok: true, data: [town] }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function Fixture() {
  const ref = createRef<AddressSearchFieldHandle>();
  const [result, setResult] = useState("");
  return <form onSubmit={async (event) => { event.preventDefault(); const result = await ref.current!.resolve(); if (result) setResult(JSON.stringify(result)); }}>
    <AddressSearchField ref={ref} label="Location" language="en" showMap={false} />
    <button type="submit">Save</button><button type="button" onClick={() => ref.current!.setLocation({ id: "gps", label: "My GPS", latitude: 64.14, longitude: -21.9, source: "gps" })}>GPS</button>
    <output data-testid="result">{result}</output>
  </form>;
}

describe("typed address input", () => {
  it("resolves a typed town on submit without clicking Find or the map", async () => {
    render(<Fixture />);
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "í Keflavik" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent('"source":"search"'));
    expect(screen.getByTestId("result")).toHaveTextContent("Approximate location");
    expect(searchIcelandLocationsAction).toHaveBeenCalledWith("Keflavik");
  });

  it("asks for a result when the typed location is ambiguous instead of choosing a pin", async () => {
    vi.mocked(searchIcelandLocationsAction).mockResolvedValue({ ok: true, data: [town, { ...town, id: "osm:node:2", label: "Keflavík · Staður", latitude: 65 }] });
    render(<Fixture />);
    const input = screen.getByRole("textbox", { name: "Location" });
    fireEvent.change(input, { target: { value: "Keflavik" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose one");
    expect(input).toHaveFocus();
    expect(screen.getByTestId("result")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Keflavík · Bær" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent('"latitude":64'));
  });

  it("keeps GPS selection when an older typed lookup finishes later", async () => {
    let finish!: (value: Awaited<ReturnType<typeof searchIcelandLocationsAction>>) => void;
    vi.mocked(searchIcelandLocationsAction).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<Fixture />);
    const input = screen.getByRole("textbox", { name: "Location" });
    fireEvent.change(input, { target: { value: "Keflavik" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "GPS" }));
    finish({ ok: true, data: [town] });
    await waitFor(() => expect(input).toHaveValue("My GPS"));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    await waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent('"source":"gps"'));
  });

  it("does not save an unknown location and explains how to correct it", async () => {
    vi.mocked(searchIcelandLocationsAction).mockResolvedValue({ ok: true, data: [] });
    render(<Fixture />);
    fireEvent.change(screen.getByRole("textbox", { name: "Location" }), { target: { value: "Unknown" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("No location found");
    expect(screen.getByTestId("result")).toBeEmptyDOMElement();
  });
});

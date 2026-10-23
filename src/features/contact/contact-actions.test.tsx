import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContactActions } from "./contact-actions";

afterEach(cleanup);

describe("ContactActions", () => {
  it("formats a US contact without changing its call or WhatsApp destinations", () => {
    render(<ContactActions personName="Noam" phone="+17022196679" />);
    expect(screen.getByText("+1 (702) 219-6679")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hringja í Noam: +1 (702) 219-6679" }))
      .toHaveAttribute("href", "tel:+17022196679");
    expect(screen.getByRole("link", { name: "WhatsApp: Noam" }))
      .toHaveAttribute("href", "https://wa.me/17022196679");
  });

  it("renders call and WhatsApp actions for an Icelandic local number", () => {
    render(<ContactActions personName="María Kristinsdóttir" phone="555-0110" />);

    expect(screen.getByRole("link", { name: "Hringja í María Kristinsdóttir: +354 555 0110" }))
      .toHaveAttribute("href", "tel:5550110");
    expect(screen.getByRole("link", { name: "WhatsApp: María Kristinsdóttir" }))
      .toHaveAttribute("href", "https://wa.me/3545550110");
  });

  it("does not offer WhatsApp when the number has no international form", () => {
    render(<ContactActions personName="Neyðarlínan" phone="112" />);

    expect(screen.getByRole("link", { name: "Hringja í Neyðarlínan: 112" }))
      .toHaveAttribute("href", "tel:112");
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
  });
});

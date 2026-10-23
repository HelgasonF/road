import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PhoneInput } from "./phone-input";

afterEach(cleanup);

function renderPhone(defaultValue = "", required = true) {
  render(<form><PhoneInput label="Phone" name="phone" defaultValue={defaultValue} language="en" required={required} /></form>);
  const input = screen.getByRole("textbox", { name: "Phone" }) as HTMLInputElement;
  const country = screen.getByRole("combobox", { name: "Country code for Phone" });
  const submitted = () => new FormData(input.form!).get("phone");
  return { input, country, submitted };
}

describe("PhoneInput", () => {
  it("starts with no country selected, then formats the chosen country and submits E.164", () => {
    const { input, country, submitted } = renderPhone();
    expect(country).toHaveValue("");
    fireEvent.change(country, { target: { value: "IS" } });
    expect(country).toHaveValue("IS");
    fireEvent.change(input, { target: { value: "6597003" } });
    expect(input).toHaveValue("659 7003");
    expect(submitted()).toBe("+3546597003");
    expect(input).toBeValid();
  });

  it("supports a selected foreign country with a national number", () => {
    const { input, country, submitted } = renderPhone();
    fireEvent.change(country, { target: { value: "US" } });
    fireEvent.change(input, { target: { value: "7022196679" } });
    expect(input).toHaveValue("(702) 219-6679");
    expect(submitted()).toBe("+17022196679");
    expect(screen.getByRole("option", { name: "United States (+1)" })).toHaveAttribute("label", "US (+1)");
  });

  it("recognizes an Icelandic calling code pasted without a plus", () => {
    const { input, country, submitted } = renderPhone();
    fireEvent.change(country, { target: { value: "IS" } });
    fireEvent.change(input, { target: { value: "3546597003" } });
    expect(country).toHaveValue("IS");
    expect(input).toHaveValue("659 7003");
    expect(submitted()).toBe("+3546597003");
  });

  it.each(["+1 (702) 219-6679", "0017022196679"])("accepts pasted %s and switches the selector", (value) => {
    const { input, country, submitted } = renderPhone();
    fireEvent.change(input, { target: { value } });
    expect(country).toHaveValue("US");
    expect(input).toHaveValue("(702) 219-6679");
    expect(submitted()).toBe("+17022196679");
  });

  it("uses the saved foreign country instead of assuming Iceland", () => {
    const { input, country, submitted } = renderPhone("+442079460958");
    expect(country).toHaveValue("GB");
    expect(input).toHaveValue("020 7946 0958");
    expect(submitted()).toBe("+442079460958");
  });

  it("changes the dialling country without duplicating its prefix", () => {
    const { input, country, submitted } = renderPhone("+17022196679");
    fireEvent.change(country, { target: { value: "CA" } });
    expect(input).toHaveValue("(702) 219-6679");
    expect(submitted()).toBe("+17022196679");
  });

  it("blocks invalid edited numbers with localized feedback and clears it after correction", () => {
    const { input, country } = renderPhone();
    fireEvent.change(country, { target: { value: "IS" } });
    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.blur(input);
    expect(input).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid phone number");
    fireEvent.change(input, { target: { value: "6597003" } });
    expect(input).toBeValid();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains an untouched short legacy number without blocking unrelated edits", () => {
    const { input, submitted } = renderPhone("112");
    expect(input).toHaveValue("112");
    expect(input).toBeValid();
    expect(submitted()).toBe("112");
    fireEvent.change(input, { target: { value: "113" } });
    expect(input).toBeInvalid();
  });

  it("does not make an optional payer number required", () => {
    const { input, submitted } = renderPhone("", false);
    expect(input).toBeValid();
    expect(submitted()).toBe("");
  });

  it("supports non-geographic international numbers without assigning a country", () => {
    const { input, country, submitted } = renderPhone("+80012345678");
    expect(country).toHaveValue("international");
    expect(submitted()).toBe("+80012345678");
    expect(input).toBeValid();
  });

  it("never assumes Iceland when a new national number is entered without a country", () => {
    const { input, country, submitted } = renderPhone();
    fireEvent.change(input, { target: { value: "6597003" } });
    fireEvent.blur(input);
    expect(country).toHaveValue("");
    expect(input).toBeInvalid();
    expect(submitted()).toBe("6597003");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a country code");
    fireEvent.change(country, { target: { value: "IS" } });
    expect(input).toBeValid();
    expect(submitted()).toBe("+3546597003");
  });

  it("handles deleting a formatting boundary without trapping backspace", () => {
    const { input, submitted } = renderPhone("+17022196679");
    fireEvent.change(input, { target: { value: "(702)219-6679", selectionStart: 5 } });
    expect(input.value.replace(/\D/g, "")).toBe("702196679");
    expect(submitted()).not.toBe("+17022196679");
    expect(input).toBeInvalid();
  });
});

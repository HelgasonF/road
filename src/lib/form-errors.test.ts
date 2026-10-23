import { describe, expect, it } from "vitest";
import { localizeFieldErrors, nativeFormErrors, focusFormField } from "./form-errors";

describe("actionable form feedback", () => {
  it("groups hidden coordinate errors into the visible location field", () => {
    expect(localizeFieldErrors({ latitude: ["too small"], longitude: ["too big"], locationLabel: ["required"] }, "is"))
      .toEqual({ locationLabel: "Skrifaðu bæ eða heimilisfang, notaðu GPS eða veldu punkt á kortinu." });
  });

  it("uses clear instructions rather than raw schema errors", () => {
    const errors = localizeFieldErrors({ peopleCount: ["Invalid input"], requiredCapability: ["Invalid enum"] }, "en");
    expect(errors.peopleCount).toBe("Enter a whole number of people from 1 to 99.");
    expect(errors.requiredCapability).toBe("Choose the assistance you need.");
  });

  it("finds the visible invalid control when a hidden field shares its name", () => {
    const form = document.createElement("form");
    form.innerHTML = '<input type="hidden" name="customerPhone" value="123"><select data-field="customerPhone"><option value="US">US</option></select><input type="tel" data-field="customerPhone">';
    document.body.append(form);
    const input = form.querySelector<HTMLInputElement>('input[type="tel"]')!;
    input.setCustomValidity("Enter a valid phone number.");
    expect(nativeFormErrors(form, "en")).toEqual({ customerPhone: "Enter a valid phone number." });
    focusFormField(form, "customerPhone");
    expect(input).toHaveFocus();
    form.remove();
  });
});

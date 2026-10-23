"use client";

import { AsYouType, getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";

import { isValidPhoneNumber, normalizePhoneNumber, parsePhoneNumber } from "@/lib/phone";
import { phoneCountryOptions } from "@/lib/phone-countries";

type Country = CountryCode | "international" | "";

const countries = getCountries();

function countryForCode(code: string | undefined) {
  return code ? (["IS", "US", "GB", ...countries] as CountryCode[])
    .find((country) => getCountryCallingCode(country) === code) : undefined;
}

function initialState(value: string): { country: Country; text: string } {
  if (!value.trim()) return { country: "", text: "" };
  const phone = parsePhoneNumber(value);
  if (!phone?.isPossible() || phone.ext) return { country: "international", text: value };
  const country = phone.country ?? countryForCode(phone.countryCallingCode) ?? "international";
  return { country, text: country !== "international" ? phone.formatNational() : phone.formatInternational() };
}

function formatInput(value: string, country: Country) {
  const international = /^\s*(?:\+|00)/.test(value);
  if (!international && (!country || country === "international")) return { country, text: value };
  const raw = value.trim().replace(/^00/, "+");
  const formatter = new AsYouType(international || country === "international" ? undefined : country || undefined);
  const formatted = formatter.input(raw);
  if (!international) {
    const phone = country && country !== "international" ? parsePhoneNumber(raw, country) : undefined;
    return { country, text: phone?.isPossible() && !phone.ext ? phone.formatNational() : formatted };
  }
  const inferred = formatter.getCountry() ?? countryForCode(formatter.getCallingCode());
  const phone = formatter.getNumber();
  return {
    country: inferred ?? (formatter.getCallingCode() ? "international" : "") as Country,
    text: inferred
      ? phone?.isPossible() ? phone.formatNational() : new AsYouType(inferred).input(formatter.getNationalNumber())
      : formatted,
  };
}

interface PhoneInputProps {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  language?: "is" | "en";
  className?: string;
  error?: string;
}

export function PhoneInput({ label, name, defaultValue = "", required = false, disabled = false, language = "is", className = "", error }: PhoneInputProps) {
  const id = useId();
  const [state, setState] = useState(() => initialState(defaultValue));
  const [edited, setEdited] = useState(false);
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const country = state.country && state.country !== "international" ? state.country : undefined;
  const explicitInternational = /^\s*(?:\+|00)/.test(state.text);
  const canParse = Boolean(country || (state.country === "international" && explicitInternational));
  const valid = (!state.text && !required) || (!edited && Boolean(defaultValue.trim())) || (canParse && isValidPhoneNumber(state.text, country));
  const message = !state.country
    ? language === "is" ? "Veldu landsnúmer eða límdu inn fullt alþjóðlegt símanúmer." : "Choose a country code or paste a full international number."
    : language === "is" ? "Sláðu inn gilt símanúmer fyrir valið land." : "Enter a valid phone number for the selected country.";
  const serialized = (canParse ? normalizePhoneNumber(state.text, country) : null) ?? state.text.trim();
  const visibleError = error || (showError && !valid ? message : undefined);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(valid || !state.text ? "" : message);
    if (caretRef.current !== null) {
      input.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  }, [valid, message, state]);

  function changeNumber(event: ChangeEvent<HTMLInputElement>) {
    let raw = event.target.value;
    let caret = event.target.selectionStart ?? raw.length;
    // Deleting only an inserted separator should also remove a digit, instead
    // of immediately re-inserting that separator and trapping backspace.
    if (raw.length < state.text.length && raw.replace(/\D/g, "") === state.text.replace(/\D/g, "")) {
      const prefix = raw.slice(0, caret);
      const shortened = prefix.replace(/\d(?=\D*$)/, "");
      raw = shortened + raw.slice(caret);
      caret -= prefix.length - shortened.length;
    }
    const next = formatInput(raw, state.country);
    if (/^\s*(?:\+|00)/.test(raw)) {
      caretRef.current = next.text.length;
    } else {
      const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
      let seen = 0;
      let position = 0;
      while (position < next.text.length && seen < digitsBefore) {
        if (/\d/.test(next.text[position])) seen++;
        position++;
      }
      caretRef.current = caret === raw.length ? next.text.length : position;
    }
    setEdited(true);
    setState(next);
  }

  function changeCountry(next: Country) {
    const phone = canParse ? parsePhoneNumber(state.text, country) : undefined;
    const digits = phone?.nationalNumber ?? state.text;
    setEdited(true);
    setState(next && next !== "international" ? formatInput(digits, next) : { country: next, text: next === "international" ? phone?.number ?? state.text : state.text });
    caretRef.current = null;
  }

  return (
    <div className={`field phone-field ${className}`}>
      <label className="phone-input-label" htmlFor={id}><span>{label}</span></label>
      <div className="phone-input-controls">
        <select data-field={name} aria-label={language === "is" ? `Landsnúmer fyrir ${label}` : `Country code for ${label}`} autoComplete="tel-country-code" disabled={disabled} required={required || Boolean(state.text)} value={state.country} onChange={(event) => changeCountry(event.target.value as Country)} onInvalid={() => setShowError(true)}>
          <option value="">{language === "is" ? "Veldu land" : "Country code"}</option>
          {phoneCountryOptions[language].map(({ code, name }) => <option key={code} value={code} label={state.country === code ? `${code} (+${getCountryCallingCode(code)})` : undefined}
              aria-label={`${name} (+${getCountryCallingCode(code)})`}>{name} (+{getCountryCallingCode(code)})</option>)}
          <option value="international">{language === "is" ? "Alþjóðlegt (+)" : "International (+)"}</option>
        </select>
        <input id={id} ref={inputRef} data-field={name} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={40} placeholder={state.country === "IS" ? "659 7003" : undefined}
          value={state.text} required={required} disabled={disabled} onChange={changeNumber} onBlur={() => setShowError(true)} onInvalid={() => setShowError(true)}
          aria-invalid={visibleError ? true : undefined} aria-describedby={visibleError ? `${id}-error` : undefined} />
        <input type="hidden" name={name} value={serialized} disabled={disabled} />
      </div>
      {visibleError ? <p className="phone-input-error" id={`${id}-error`} role={error ? undefined : "alert"}>{visibleError}</p> : null}
    </div>
  );
}

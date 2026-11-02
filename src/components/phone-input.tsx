"use client";

import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { ChevronDown } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";

import { parsePhoneNumber } from "@/lib/phone";
import { phoneCountryOptions } from "@/lib/phone-countries";

type Country = CountryCode | "international" | "";

const countries = getCountries();

function countryForCode(code: string | undefined) {
  return code ? (["IS", "US", "GB", ...countries] as CountryCode[])
    .find((country) => getCountryCallingCode(country) === code) : undefined;
}

function typedCallingCode(value: string) {
  const digits = /^(?:\+|00)?([1-9]\d{0,2})$/.exec(value.trim())?.[1];
  if (!digits) return undefined;
  const formatter = new AsYouType();
  formatter.input(`+${digits}`);
  return formatter.getCallingCode() === digits ? digits : undefined;
}

function codeForState({ country, text }: { country: Country; text: string }) {
  if (!country) return "";
  if (country !== "international") return `+${getCountryCallingCode(country)}`;
  const formatter = new AsYouType();
  formatter.input(text.trim().replace(/^00/, "+"));
  return formatter.getCallingCode() ? `+${formatter.getCallingCode()}` : "";
}

function initialState(value: string): { country: Country; text: string } {
  if (!value.trim()) return { country: "", text: "" };
  const phone = parsePhoneNumber(value);
  if (!phone?.isPossible() || phone.ext) return { country: "international", text: value };
  const country = phone.country ?? countryForCode(phone.countryCallingCode) ?? "international";
  return { country, text: country !== "international" ? phone.formatNational() : phone.formatInternational() };
}

function formatInput(value: string, country: Country, callingCode?: string) {
  const international = /^\s*(?:\+|00)/.test(value);
  if (!international && (!country || (country === "international" && !callingCode))) return { country, text: value };
  const raw = value.trim().replace(/^00/, "+");
  const formatter = new AsYouType(international ? undefined : country && country !== "international" ? country : { defaultCallingCode: callingCode });
  const formatted = formatter.input(raw);
  if (!international) {
    const phone = country && country !== "international" ? parsePhoneNumber(raw, country) : formatter.getNumber();
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
  const [codeText, setCodeText] = useState(() => codeForState(initialState(defaultValue)));
  const [edited, setEdited] = useState(false);
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const country = state.country && state.country !== "international" ? state.country : undefined;
  const callingCode = typedCallingCode(codeText);
  const explicitInternational = /^\s*(?:\+|00)/.test(state.text);
  const canParse = Boolean(country || (state.country === "international" && (explicitInternational || callingCode)));
  const phone = !canParse ? undefined : country || explicitInternational
    ? parsePhoneNumber(state.text, country)
    : parsePhoneNumberFromString(state.text, { defaultCallingCode: callingCode, extract: false });
  const untouchedLegacy = !edited && Boolean(defaultValue.trim());
  const valid = (!state.text && !required) || untouchedLegacy || Boolean(phone?.isValid() && !phone.ext);
  const invalidCode = Boolean(codeText.trim()) && !callingCode;
  const message = invalidCode
    ? language === "is" ? "Sláðu inn gilt landsnúmer, t.d. +44." : "Enter a valid country calling code, e.g. +44."
    : !state.country
      ? language === "is" ? "Sláðu inn eða veldu landsnúmer, eða límdu inn fullt alþjóðlegt símanúmer." : "Choose a country code, type it in, or paste a full international number."
      : language === "is" ? "Sláðu inn gilt símanúmer fyrir valið land." : "Enter a valid phone number for the selected country.";
  const serialized = phone?.isPossible() && !phone.ext ? phone.number : state.text.trim();
  const visibleError = error || (showError && !valid ? message : undefined);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(valid || !state.text ? "" : message);
    codeRef.current?.setCustomValidity(!state.text || untouchedLegacy || callingCode || (state.country === "international" && explicitInternational) ? "" : message);
    if (caretRef.current !== null) {
      input.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  }, [valid, message, state, untouchedLegacy, callingCode, explicitInternational]);

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
    const next = formatInput(raw, state.country, callingCode);
    if (/^\s*(?:\+|00)/.test(raw)) {
      caretRef.current = next.text.length;
      setCodeText(codeForState(next));
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
    const digits = phone?.nationalNumber ?? state.text;
    const nextState = next && next !== "international" ? formatInput(digits, next) : { country: next, text: next === "international" ? phone?.number ?? state.text : state.text };
    setEdited(true);
    setState(nextState);
    setCodeText(codeForState(nextState));
    caretRef.current = null;
  }

  function changeCode(value: string) {
    const code = typedCallingCode(value);
    const digits = phone?.nationalNumber ?? state.text;
    setEdited(true);
    setCodeText(value);
    setState(code ? formatInput(digits, countryForCode(code) ?? "international", code) : { country: "", text: digits });
    caretRef.current = null;
  }

  return (
    <div className={`field phone-field ${className}`}>
      <label className="phone-input-label" htmlFor={id}><span>{label}</span></label>
      <div className="phone-input-controls">
        <div className="phone-country-control">
          <input ref={codeRef} data-field={name} type="tel" inputMode="tel" autoComplete="tel-country-code" dir="ltr" maxLength={6} placeholder="+"
            aria-label={language === "is" ? `Sláðu inn landsnúmer fyrir ${label}` : `Enter country code for ${label}`}
            value={codeText} disabled={disabled} required={(required || Boolean(state.text)) && !untouchedLegacy && state.country !== "international"} onChange={(event) => changeCode(event.target.value)}
            onBlur={() => { if (state.text || invalidCode) setShowError(true); if (callingCode) setCodeText(`+${callingCode}`); }} onInvalid={() => setShowError(true)}
            aria-invalid={visibleError && (!state.country || invalidCode) ? true : undefined} aria-describedby={`${id}-code-help${visibleError ? ` ${id}-error` : ""}`} />
          <span className="phone-country-picker">
            <ChevronDown size={16} aria-hidden="true" />
            <select data-field={name} aria-label={language === "is" ? `Landsnúmer fyrir ${label}` : `Country code for ${label}`} title={language === "is" ? "Veldu land" : "Choose a country"} disabled={disabled} value={state.country} onChange={(event) => changeCountry(event.target.value as Country)}>
              <option value="">{language === "is" ? "Veldu land" : "Country code"}</option>
              {phoneCountryOptions[language].map(({ code, name }) => <option key={code} value={code} label={state.country === code ? `${code} (+${getCountryCallingCode(code)})` : undefined}
                aria-label={`${name} (+${getCountryCallingCode(code)})`}>{name} (+{getCountryCallingCode(code)})</option>)}
              <option value="international">{language === "is" ? "Alþjóðlegt (+)" : "International (+)"}</option>
            </select>
          </span>
        </div>
        <input id={id} ref={inputRef} data-field={name} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={40} placeholder={state.country === "IS" ? "659 7003" : undefined}
          value={state.text} required={required} disabled={disabled} onChange={changeNumber} onBlur={() => setShowError(true)} onInvalid={() => setShowError(true)}
          aria-invalid={visibleError ? true : undefined} aria-describedby={visibleError ? `${id}-error` : undefined} />
        <input type="hidden" name={name} value={serialized} disabled={disabled} />
      </div>
      <small className="phone-code-help" id={`${id}-code-help`}>{language === "is" ? "Sláðu inn landsnúmer, t.d. +44, eða veldu land." : "Type a calling code, e.g. +44, or choose a country."}</small>
      {visibleError ? <p className="phone-input-error" id={`${id}-error`} role={error ? undefined : "alert"}>{visibleError}</p> : null}
    </div>
  );
}

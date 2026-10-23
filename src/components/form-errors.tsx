"use client";

import type { RefObject } from "react";
import { focusFormField, formFieldLabel, type FormErrors, type FormLanguage } from "@/lib/form-errors";

export function FormErrorSummary({ errors, formRef, language }: { errors: FormErrors; formRef: RefObject<HTMLFormElement | null>; language: FormLanguage }) {
  if (!Object.keys(errors).length) return null;
  return <div className="form-error-summary" role="alert" aria-label={language === "en" ? "Form errors" : "Villur í formi"}>
    <strong>{language === "en" ? "Please fix the following fields:" : "Lagaðu eftirfarandi reiti:"}</strong>
    <ul>{Object.entries(errors).map(([name, message]) => <li key={name}><button type="button" onClick={() => focusFormField(formRef.current, name)}>{formFieldLabel(name, language)}: {message}</button></li>)}</ul>
  </div>;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={id}>{message}</p> : null;
}

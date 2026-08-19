"use client";

import { AlertTriangle } from "lucide-react";

import { is } from "@/lib/i18n/is";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="centered-state">
      <AlertTriangle size={38} aria-hidden="true" />
      <h1>Eitthvað fór úrskeiðis</h1>
      <p>Ekki tókst að sækja gögn fyrir aðgerðastjórnina.</p>
      <button className="primary-button" onClick={reset}>{is.retry}</button>
    </main>
  );
}

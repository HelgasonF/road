import type { Metadata } from "next";
import { KeyRound, MapPinned } from "lucide-react";

import { DriverAccessForm } from "@/features/auth/driver-access-form";
import type { DriverAccessTokenType } from "@/features/operators/driver-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ökumannsaðgangur | Vegstoð",
  robots: { index: false, follow: false },
};

interface DriverAccessPageProps {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}

export default async function DriverAccessPage({ searchParams }: DriverAccessPageProps) {
  const { token_hash: tokenHash, type } = await searchParams;
  const validType = type === "signup" || type === "magiclink"
    ? type satisfies DriverAccessTokenType
    : null;

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark brand-mark-large" aria-hidden="true">
          <MapPinned size={30} />
        </div>
        <p className="eyebrow">Vegstoð</p>
        <h1>Ökumannsaðgangur</h1>
        {tokenHash && validType ? (
          <DriverAccessForm tokenHash={tokenHash} type={validType} />
        ) : (
          <div className="access-link-error">
            <KeyRound size={30} />
            <p>Aðgangstengillinn vantar eða er ógildur. Biddu aðgerðastjórn um nýjan WhatsApp-tengil.</p>
          </div>
        )}
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="login-visual-copy">
          <span>Ökumannsskjár</span>
          <strong>Verkefnið við höndina</strong>
          <p>Staðsetning, samband og staða í einni öruggri sýn.</p>
        </div>
      </aside>
    </main>
  );
}

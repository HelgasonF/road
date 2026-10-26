import type { Metadata } from "next";
import { KeyRound, MapPinned } from "lucide-react";

import { DriverAccessForm } from "@/features/auth/driver-access-form";
import { DriverAssignmentAccessForm } from "@/features/auth/assignment-access-form";
import { assignmentTokenSchema } from "@/features/auth/assignment-link";
import type { DriverAccessTokenType } from "@/features/operators/driver-access";
import { decodeDriverAccessButtonCode } from "@/features/whatsapp/messages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ökumannsaðgangur | Iceland Road Assistance",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

interface DriverAccessPageProps {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string; assignment?: string }>;
}

export default async function DriverAccessPage({ searchParams }: DriverAccessPageProps) {
  const params = await searchParams;
  const assignment = assignmentTokenSchema.safeParse(params.assignment);
  const buttonCode = decodeDriverAccessButtonCode(params.code);
  const tokenHash = params.token_hash ?? buttonCode?.tokenHash;
  const type = params.type ?? buttonCode?.type;
  const validType = type === "signup" || type === "magiclink"
    ? type satisfies DriverAccessTokenType
    : null;

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark brand-mark-large" aria-hidden="true">
          <MapPinned size={30} />
        </div>
        <p className="eyebrow">Iceland Road Assistance</p>
        <h1>Ökumannsaðgangur</h1>
        {params.assignment !== undefined && assignment.success ? (
          <DriverAssignmentAccessForm token={assignment.data} />
        ) : params.assignment === undefined && tokenHash && validType ? (
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

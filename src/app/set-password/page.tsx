import { KeyRound, MapPinned } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswordSetupForm } from "@/features/auth/password-setup-form";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import { is } from "@/lib/i18n/is";

export const dynamic = "force-dynamic";

interface SetPasswordPageProps {
  searchParams: Promise<{ error?: string; source?: string }>;
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  if (isDemoMode() || !hasSupabaseConfig()) redirect("/login");
  const params = await searchParams;

  if (params.error) {
    return (
      <main className="centered-state password-link-error">
        <KeyRound size={38} />
        <h1>Aðgangshlekkurinn virkar ekki</h1>
        <p>Hlekkurinn gæti verið útrunninn eða þegar notaður. Biddu aðgerðastjórn um nýtt boð eða endurstillingu.</p>
        <Link className="primary-button" href="/login">Til baka í innskráningu</Link>
      </main>
    );
  }

  const identity = await getVerifiedSession();
  if (!identity) redirect("/login");
  if (identity.role !== "driver") redirect("/");

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark brand-mark-large" aria-hidden="true"><MapPinned size={30} /></div>
        <p className="eyebrow">{is.appName}</p>
        <h1>{params.source === "recovery" ? "Veldu nýtt lykilorð" : "Kláraðu ökumannsaðganginn"}</h1>
        <p className="login-intro">Lykilorðið verður aðeins notað til að skrá þig inn á öruggan ökumannsskjá Vegstoðar.</p>
        <PasswordSetupForm />
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="login-visual-copy"><span>Ökumannsskjár</span><strong>Verkefnið við höndina</strong><p>Staðsetning, samband og staða í einni öruggri sýn.</p></div>
      </aside>
    </main>
  );
}

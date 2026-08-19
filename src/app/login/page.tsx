import { MapPinned } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/login-form";
import { getVerifiedSession } from "@/lib/auth/session";
import { hasSupabaseConfig, isDemoMode } from "@/lib/config";
import { is } from "@/lib/i18n/is";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isDemoMode()) redirect("/");
  if (hasSupabaseConfig() && (await getVerifiedSession())) redirect("/");

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark brand-mark-large" aria-hidden="true">
          <MapPinned size={30} />
        </div>
        <p className="eyebrow">{is.appName}</p>
        <h1>{is.loginTitle}</h1>
        <p className="login-intro">{is.loginIntro}</p>
        <LoginForm />
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="login-visual-copy">
          <span>64.9631° N</span>
          <strong>Ísland í einni sýn</strong>
          <p>Þjónustunet, staða og búnaður — alltaf við höndina.</p>
        </div>
      </aside>
    </main>
  );
}

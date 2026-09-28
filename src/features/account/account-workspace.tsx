"use client";

import { BriefcaseBusiness, CircleUserRound, LogOut, MapPinned, ReceiptText, UserCog } from "lucide-react";
import Link from "next/link";

import { logoutAction } from "@/features/auth/actions";
import type { DispatcherIdentity } from "@/lib/domain/types";
import { ChangePasswordForm } from "./change-password-form";
import { staffRoleLabels } from "./labels";
import type { StaffMember } from "./queries";
import { StaffPanel } from "./staff-panel";

interface AccountWorkspaceProps {
  identity: DispatcherIdentity;
  staff: StaffMember[];
}

export function AccountWorkspace({ identity, staff }: AccountWorkspaceProps) {
  const isAdmin = identity.role === "admin";

  return (
    <main className="billing-app account-app">
      <header className="topbar billing-topbar">
        <div className="brand-lockup"><span className="brand-mark"><MapPinned size={22} /></span><span><strong>Iceland Road Assistance</strong><small>Aðgangur og notendur</small></span></div>
        <nav className="billing-nav" aria-label="Aðalvalmynd">
          <Link href="/"><BriefcaseBusiness size={16} /> Aðgerðastjórn</Link>
          <Link href="/billing"><ReceiptText size={16} /> Uppgjör</Link>
          <Link className="billing-nav-active" href="/account"><UserCog size={16} /> Aðgangur</Link>
        </nav>
        <div className="topbar-actions">
          <div className="identity"><CircleUserRound size={26} /><span><strong>{identity.displayName}</strong><small>{identity.email}</small></span></div>
          <form action={logoutAction}><button className="icon-button" type="submit" aria-label="Skrá út"><LogOut size={18} /></button></form>
        </div>
      </header>

      <section className="account-page">
        <div className="billing-overview-heading">
          <p className="eyebrow">{identity.role === "admin" || identity.role === "dispatcher" ? staffRoleLabels[identity.role] : ""}</p>
          <h1>Aðgangur</h1>
          <p>Skráður inn sem {identity.email}.</p>
        </div>
        <div className="account-grid">
          <ChangePasswordForm />
          {isAdmin ? <StaffPanel staff={staff} /> : null}
        </div>
      </section>
    </main>
  );
}

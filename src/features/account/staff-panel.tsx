"use client";

import { UserPlus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { createStaffUserAction } from "./actions";
import { staffRoleLabels } from "./labels";
import type { StaffMember } from "./queries";
import { staffRoles } from "./schemas";

export function StaffPanel({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const displayName = String(values.get("displayName") ?? "").trim();
    setResult(null);
    startTransition(async () => {
      const response = await createStaffUserAction({
        displayName,
        email: String(values.get("email") ?? ""),
        password: String(values.get("password") ?? ""),
        role: String(values.get("role") ?? ""),
      });
      if (!response.ok) {
        const fieldMessage = Object.values(response.fieldErrors ?? {}).flat()[0];
        setResult({ ok: false, message: fieldMessage ?? response.error ?? "Ekki tókst að búa til notandann." });
        return;
      }
      form.reset();
      setResult({ ok: true, message: `Notandinn ${displayName} var búinn til. Sendu netfang og lykilorð til viðkomandi.` });
      router.refresh();
    });
  }

  return (
    <>
      <section className="account-card" aria-labelledby="staff-title">
        <div className="account-card-heading"><UsersRound size={18} /><h2 id="staff-title">Notendur</h2></div>
        <ul className="account-staff-list" aria-label="Starfsfólk">
          {staff.map((member) => (
            <li key={member.id}>
              <span><strong>{member.displayName}</strong><small>{member.email}</small></span>
              <span className={`account-role account-role-${member.role}`}>{staffRoleLabels[member.role]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="account-card" aria-labelledby="new-user-title">
        <div className="account-card-heading"><UserPlus size={18} /><h2 id="new-user-title">Nýr notandi</h2></div>
        <p className="account-help">Stjórnendur sjá allt og geta búið til notendur. Aðgerðastjórar sjá allt nema notendastjórnun.</p>
        <form className="account-form" aria-label="Nýr notandi" onSubmit={submit}>
          <label className="field"><span>Nafn</span><input name="displayName" autoComplete="off" required maxLength={80} /></label>
          <label className="field"><span>Netfang</span><input name="email" type="email" autoComplete="off" required /></label>
          {/* Visible on purpose: the admin chooses this password and has to pass it on. */}
          <label className="field"><span>Lykilorð</span><input name="password" type="text" autoComplete="off" minLength={10} required /></label>
          <label className="field">
            <span>Hlutverk</span>
            <select name="role" defaultValue="dispatcher">
              {staffRoles.map((role) => <option key={role} value={role}>{staffRoleLabels[role]}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={pending}>{pending ? "Bý til…" : "Búa til notanda"}</button>
        </form>
        {result ? <p className={result.ok ? "account-success" : "compact-error"} role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
      </section>
    </>
  );
}

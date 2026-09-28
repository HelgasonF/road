import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "./schemas";

export interface StaffMember {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole;
  createdAt: string;
}

/** Staff can read all profiles through RLS; drivers and pending users are excluded. */
export async function getStaffMembers(): Promise<StaffMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, created_at")
    .in("role", ["admin", "dispatcher"])
    .order("display_name");
  if (error) throw new Error(`Could not load staff: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as StaffRole,
    createdAt: row.created_at,
  }));
}

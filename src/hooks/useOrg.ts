import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { can, isRole, type Role } from "@/domain/roles";

export type Me = {
  /** Profile display name, else the email's local part, else "Signed in". */
  name: string;
  /** Null until the org_members migration is applied or the user is added to an organisation. */
  orgId: string | null;
  orgName: string | null;
  role: Role | null;
  loading: boolean;
};

/** Picks a name for the signed-in user from profile and email. Pure, so it can be tested. */
export function displayNameFor(profile: { display_name: string | null; email: string | null } | null, email: string | undefined): string {
  const fromProfile = profile?.display_name?.trim();
  if (fromProfile) return fromProfile;
  const local = (profile?.email ?? email ?? "").split("@")[0].trim();
  return local || "Signed in";
}

/** Operational edits (agents, calls, knowledge): admins and supervisors. Thin alias over the permission matrix. */
export const canEdit = (role: Role | null) => can(role, "agents.edit");

const EMPTY: Me = { name: "Signed in", orgId: null, orgName: null, role: null, loading: true };

/**
 * The signed-in user's profile name and their first organisation membership.
 * Degrades to name-only when the membership tables are missing or empty, so
 * the console still renders before the domain migration is applied.
 */
export function useOrg(): Me {
  const { user } = useAuth();
  const [me, setMe] = useState<Me>(EMPTY);

  useEffect(() => {
    if (!user) return setMe({ ...EMPTY, loading: false });
    let cancelled = false;
    (async () => {
      const [{ data: profile }, membership] = await Promise.all([
        supabase.from("profiles").select("display_name, email").eq("user_id", user.id).maybeSingle(),
        supabase.from("org_members").select("org_id, role, organisations(name)").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const m = membership.error ? null : membership.data;
      setMe({
        name: displayNameFor(profile, user.email),
        orgId: m?.org_id ?? null,
        orgName: m?.organisations?.name ?? null,
        role: isRole(m?.role) ? m.role : null,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return me;
}

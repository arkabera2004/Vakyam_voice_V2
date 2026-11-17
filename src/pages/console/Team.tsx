import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Btn, PageTitle, Panel, PanelHeader, Pill, Td, Th } from "@/console/ui";
import { Field, inputClass } from "@/console/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/hooks/useOrg";
import { can, canAssignRole, ROLES, ROLE_LABEL, type Role } from "@/domain/roles";
import { toast } from "@/hooks/use-toast";

type Member = { userId: string; role: Role; status: "active" | "disabled"; name: string; email: string | null; isMe: boolean };
type Invitation = { id: string; email: string; role: Role; status: string; createdAt: string; expiresAt: string };

/** Real org_members + invitations, no localStorage. Degrades to an empty roster before the migration is applied or if the user has no organisation yet. */
export default function Team() {
  const me = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [busy, setBusy] = useState(false);

  const canManage = can(me.role, "org.manage");
  const assignableRoles = ROLES.filter((r) => canAssignRole(me.role, r));

  const load = useCallback(async () => {
    if (!me.orgId) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const [membersResult, invitationsResult] = await Promise.all([
      supabase.from("org_members").select("user_id, role, status").eq("org_id", me.orgId),
      canManage
        ? supabase.from("invitations").select("id, email, role, status, created_at, expires_at").eq("org_id", me.orgId).eq("status", "pending").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (membersResult.error) {
      setLoadError(membersResult.error.message);
      setLoading(false);
      return;
    }
    const userIds = membersResult.data.map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, display_name, email").in("user_id", userIds)
      : { data: [] as { user_id: string; display_name: string | null; email: string | null }[] };
    const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    setMembers(
      membersResult.data.map((m) => {
        const profile = byUser.get(m.user_id);
        return {
          userId: m.user_id,
          role: m.role,
          status: m.status,
          name: profile?.display_name?.trim() || profile?.email?.split("@")[0] || "Member",
          email: profile?.email ?? null,
          isMe: m.user_id === user?.id,
        };
      }),
    );
    if (invitationsResult.error) setLoadError(invitationsResult.error.message);
    else setInvitations((invitationsResult.data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role, status: i.status, createdAt: i.created_at, expiresAt: i.expires_at })));
    setLoading(false);
  }, [me.orgId, canManage, user?.id]);

  useEffect(() => {
    if (!me.loading) void load();
  }, [me.loading, load]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "invite", email, role } });
    setBusy(false);
    const message = (data as { error?: string } | null)?.error ?? (error ? error.message : null);
    if (message) return toast({ variant: "destructive", title: "Could not send the invitation", description: message });
    toast({ title: "Invitation sent", description: `${email} will receive an email to join as ${ROLE_LABEL[role]}.` });
    setEmail("");
    void load();
  };

  const revoke = async (invitationId: string) => {
    const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "revoke", invitationId } });
    const message = (data as { error?: string } | null)?.error ?? (error ? error.message : null);
    if (message) return toast({ variant: "destructive", title: "Could not revoke the invitation", description: message });
    toast({ title: "Invitation revoked" });
    void load();
  };

  const setStatus = async (userId: string, status: "active" | "disabled") => {
    const { error } = await supabase.rpc("set_member_status", { org: me.orgId as string, member: userId, new_status: status });
    if (error) return toast({ variant: "destructive", title: "Could not update the member", description: error.message });
    toast({ title: status === "disabled" ? "Member deactivated" : "Member reactivated" });
    void load();
  };

  return (
    <>
      <PageTitle crumb={me.orgName ? `Govern, ${me.orgName}` : "Govern"} title="Team" />

      {!me.orgId && !me.loading && (
        <Panel className="p-4 text-sm text-zinc-600">You do not belong to an organisation yet. Ask an administrator to invite you.</Panel>
      )}

      {me.orgId && canManage && (
        <Panel className="p-4">
          <p className="text-sm font-semibold">Invite a member</p>
          <form onSubmit={sendInvite} className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={inputClass} />
            </Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </Field>
            <Btn type="submit" variant="primary" disabled={busy || !email.trim()}>
              <UserPlus className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Send invitation"}
            </Btn>
          </form>
        </Panel>
      )}

      {me.orgId && invitations.length > 0 && (
        <Panel className="mt-4">
          <PanelHeader title="Pending invitations" hint={`${invitations.length}`} />
          <table className="w-full">
            <thead className="bg-zinc-50"><tr><Th>Email</Th><Th>Role</Th><Th>Expires</Th>{canManage && <Th className="text-right">Actions</Th>}</tr></thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-t border-zinc-100">
                  <Td>{inv.email}</Td>
                  <Td>{ROLE_LABEL[inv.role]}</Td>
                  <Td className="text-zinc-500">{new Date(inv.expiresAt).toLocaleDateString()}</Td>
                  {canManage && <Td className="text-right"><Btn size="sm" onClick={() => revoke(inv.id)}>Revoke</Btn></Td>}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {me.orgId && (
        <Panel className="mt-4">
          <PanelHeader title="Members" hint={loading ? "Loading…" : `${members.length}`} />
          {loadError ? (
            <p className="px-4 py-6 text-sm text-red-600">Could not load the team: {loadError}</p>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
          ) : members.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">No members yet.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-50"><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th>{canManage && <Th className="text-right">Actions</Th>}</tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t border-zinc-100">
                    <Td className="font-medium">{m.name}{m.isMe && " (you)"}</Td>
                    <Td>{ROLE_LABEL[m.role]}</Td>
                    <Td><Pill tone={m.status === "active" ? "green" : "neutral"}>{m.status === "active" ? "Active" : "Disabled"}</Pill></Td>
                    {canManage && (
                      <Td className="text-right">
                        {!m.isMe && (
                          <Btn size="sm" onClick={() => setStatus(m.userId, m.status === "active" ? "disabled" : "active")}>
                            {m.status === "active" ? "Deactivate" : "Reactivate"}
                          </Btn>
                        )}
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
    </>
  );
}

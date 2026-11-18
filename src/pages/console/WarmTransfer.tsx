import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Avatar, Btn, Dot, Panel, PanelHeader, Pill } from "@/console/ui";
import { canEdit, useOrg } from "@/hooks/useOrg";
import { supabase } from "@/integrations/supabase/client";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { toast } from "@/hooks/use-toast";

type Transfer = {
  id: string;
  state: "ringing" | "accepted" | "declined";
  toName: string | null;
  summary: string[];
  notes: string[];
  createdAt: string;
  callerName: string | null;
  callerTier: string | null;
  language: string | null;
};

const STATE_TONE = { ringing: "orange", accepted: "green", declined: "neutral" } as const;
const DOT_TONE = { ringing: "orange", accepted: "green", declined: "grey" } as const;

/**
 * Real `transfers` rows. Nothing in the call flow creates one yet -- no UI
 * action or realtime-agent tool raises a transfer -- so this screen's
 * common state is honestly empty rather than showing invented queue data.
 */
export default function WarmTransfer() {
  const me = useOrg();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!me.orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("transfers")
      .select("id, state, to_name, summary, notes, created_at, calls(caller_name, caller_tier, language)")
      .eq("org_id", me.orgId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const row = data?.[0];
    setTransfer(
      row
        ? {
            id: row.id,
            state: row.state,
            toName: row.to_name,
            summary: row.summary ?? [],
            notes: row.notes ?? [],
            createdAt: row.created_at,
            callerName: row.calls?.caller_name ?? null,
            callerTier: row.calls?.caller_tier ?? null,
            language: row.calls?.language ?? null,
          }
        : null,
    );
    setLoading(false);
  }, [me.orgId]);

  useEffect(() => void load(), [load]);

  const setState = async (state: Transfer["state"]) => {
    if (!transfer) return;
    const { error } = await supabase.from("transfers").update({ state }).eq("id", transfer.id);
    if (error) {
      toast({ title: "Could not update the transfer", description: error.message });
      return;
    }
    toast(state === "accepted" ? { title: `You are connected${transfer.callerName ? ` to ${transfer.callerName}` : ""}` } : { title: "Transfer declined" });
    void load();
  };

  const addNote = async () => {
    const text = note.trim();
    if (!text || !transfer) return;
    const { error } = await supabase.from("transfers").update({ notes: [...transfer.notes, text] }).eq("id", transfer.id);
    if (error) {
      toast({ title: "Could not add the note", description: error.message });
      return;
    }
    setNote("");
    setNoteOpen(false);
    toast({ title: "Note added" });
    void load();
  };

  if (loading) return <Panel className="p-8 text-center text-sm text-zinc-500">Loading…</Panel>;
  if (loadError) return <Panel className="p-8 text-center text-sm text-red-600">{loadError}</Panel>;

  return (
    <>
      <div className="mb-5">
        <p className="mb-1 text-[13px] text-zinc-500">Warm transfers</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Incoming warm transfer</h1>
      </div>

      {!transfer ? (
        <Panel className="p-8 text-center text-sm text-zinc-500">
          No warm transfer is waiting right now. Nothing in the call flow raises one yet, so this screen stays empty until a transfer row exists.
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Panel className="flex flex-wrap items-center gap-6 p-4">
              <div className="flex items-center gap-4">
                <Avatar name={transfer.callerName || transfer.toName || "Caller"} size={52} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{transfer.callerName || "Unknown caller"}</p>
                    {transfer.callerTier && <Pill tone="purple">{transfer.callerTier}</Pill>}
                  </div>
                  <p className="text-[13px] text-zinc-500">
                    {new Date(transfer.createdAt).toLocaleString()}
                    {transfer.language ? `, ${transfer.language}` : ""}
                    {transfer.toName ? `, to ${transfer.toName}` : ""}
                  </p>
                </div>
              </div>
              <Pill tone={STATE_TONE[transfer.state]} className="ml-auto">
                <Dot tone={DOT_TONE[transfer.state]} />
                <span className="ml-1.5 capitalize">{transfer.state}</span>
              </Pill>
            </Panel>

            {transfer.summary.length > 0 && (
              <Panel>
                <PanelHeader title="Handoff summary" />
                <ul className="space-y-2.5 px-4 py-4">
                  {transfer.summary.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-zinc-800">
                      <Dot tone="orange" />
                      <span className="-mt-1">{s}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="space-y-4">
            <Panel className="p-4">
              {transfer.state === "ringing" ? (
                <>
                  <Btn variant="primary" className="h-12 w-full text-base" onClick={() => setState("accepted")} disabled={!canEdit(me.role)}>
                    <Phone className="h-4 w-4" /> Accept transfer
                  </Btn>
                  <Btn className="mt-2 w-full" onClick={() => setState("declined")} disabled={!canEdit(me.role)}>
                    Decline
                  </Btn>
                </>
              ) : (
                <p className="text-sm text-zinc-600">{transfer.state === "accepted" ? "You accepted this transfer." : "This transfer was declined."}</p>
              )}
              <Btn className="mt-2 w-full" onClick={() => setNoteOpen(true)} disabled={!canEdit(me.role)}>
                Add note
              </Btn>
              {transfer.notes.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-700">
                  {transfer.notes.map((n, i) => (
                    <li key={i} className="rounded-md bg-zinc-50 px-2 py-1.5">
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {noteOpen && (
        <Modal title="Add a note to the handoff" onClose={() => setNoteOpen(false)} footer={<ModalActions onCancel={() => setNoteOpen(false)} onOk={addNote} okLabel="Add note" okDisabled={!note.trim()} />}>
          <Field label="Note">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputClass + " h-auto py-2"} />
          </Field>
        </Modal>
      )}
    </>
  );
}

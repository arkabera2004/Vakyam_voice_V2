import { useState } from "react";
import { Phone } from "lucide-react";
import { Avatar, Btn, Dot, Lang, Langs, Panel, PanelHeader, Pill } from "@/console/ui";
import { useConsole } from "@/console/store";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { toast } from "@/hooks/use-toast";

const SUMMARY = [
  "Rohan cancelled a Goa 2BR stay for 12 to 16 November after a family emergency.",
  "He asked for a full refund of ₹38,400 to the original card, not a credit note.",
  "Meera explained the cancellation window and drafted case #5521. It is above the ₹25,000 limit, so it needs a human.",
  "He also wants a Kumbhalgarh Studio in January. Meera placed a hold, nothing is confirmed.",
  "Tone is calm but anxious. He is happy to continue in Hindi.",
];

const TURNS = [
  { t: "05:41", who: "Meera", text: "Rohan ji, ₹38,400 ka refund meri limit se upar hai. Main aapko ek senior colleague se connect karti hoon." },
  { t: "05:52", who: "Rohan", text: "Theek hai, par mujhe dobara sab kuch explain nahi karna. Refund card mein hi chahiye." },
  { t: "06:03", who: "Meera", text: "Bilkul nahi. Maine sab kuch case #5521 mein likh diya hai. Please hold, Asha ji line par aa rahi hain." },
];

const DID = [
  { name: "lookup_caller", detail: "Member 31877, Platinum, Hindi. 198 ms", tone: "green" as const },
  { name: "check_availability", detail: "Kumbhalgarh, Studio, Jan. 3 options. 702 ms", tone: "green" as const },
  { name: "create_case #5521, draft", detail: "Refund ₹38,400, awaiting human approval", tone: "amber" as const },
];

export default function WarmTransfer() {
  const { state, update, log } = useConsole();
  const { transfer } = state;
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const refundDecided = state.decided["refund-5521"];

  const accept = () => {
    update({ transfer: { ...transfer, state: "accepted" } });
    log("Accepted warm transfer, call 4812, Rohan Mehta", "Transfer");
    toast({ title: "You are connected to Rohan", description: "Meera has dropped off. His case #5521 is open on your screen." });
  };
  const decline = () => {
    update({ transfer: { ...transfer, state: "declined" } });
    log("Declined warm transfer, call 4812, returned to Meera", "Transfer");
    toast({ title: "Returned to Meera", description: "Meera will offer Rohan a callback from the refunds desk within 15 minutes." });
  };
  const addNote = () => {
    const text = note.trim();
    if (!text) return;
    update({ transfer: { ...transfer, notes: [...transfer.notes, text] } });
    setNote("");
    setNoteOpen(false);
    toast({ title: "Note added", description: "It travels with the call and lands in case #5521." });
  };
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[13px] text-zinc-500">Warm transfers / Club Mahindra Platinum queue</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Incoming warm transfer</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {transfer.state === "ringing" && <Pill tone="orange"><Dot tone="orange" /><span className="ml-1.5">Ringing 00:18</span></Pill>}
          {transfer.state === "accepted" && <Pill tone="green"><Dot tone="green" /><span className="ml-1.5">Connected to you</span></Pill>}
          {transfer.state === "declined" && <Pill tone="neutral">Returned to Meera</Pill>}
          <Pill>Queue: Platinum and refunds</Pill>
          <Pill tone="purple">From Meera v7, call 4812</Pill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel className="flex flex-wrap items-center gap-6 p-4">
            <div className="flex items-center gap-4">
              <Avatar name="Rohan Mehta" size={52} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">Rohan Mehta</p>
                  <Pill tone="purple">Platinum</Pill>
                  <Lang code="HI" />
                </div>
                <p className="text-[13px] text-zinc-500">Member since 2016, 14 stays, prefers Hindi.</p>
                <p className="text-[13px] text-zinc-500">Member ID 31877</p>
              </div>
            </div>
            <div className="ml-auto grid grid-cols-3 gap-6 text-sm">
              <Fact k="Phone" v="+91 98XXX XX412" />
              <Fact k="Last stay" v="Goa, 2BR, Oct" />
              <Fact k="On call" v="6:12 with Meera" />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="What happened in the first 6 minutes" hint="Written by Meera for the handoff" />
            <ul className="space-y-2.5 px-4 py-4">
              {SUMMARY.map((s) => (
                <li key={s} className="flex gap-2.5 text-sm text-zinc-800">
                  <Dot tone="orange" />
                  <span className="-mt-1">{s}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Last three turns" hint="Language tagged per sentence" />
            <ol className="px-4 py-2">
              {TURNS.map((t) => (
                <li key={t.t} className="grid grid-cols-[48px_1fr] gap-3 py-3">
                  <span className="text-xs tabular-nums text-zinc-400">{t.t}</span>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-700">{t.who}</span>
                      <Langs codes={["HI", "EN"]} />
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-800">{t.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-3 rounded-b-xl border-t border-zinc-100 bg-zinc-50 px-4 py-3">
              <Avatar name="Asha Nair" size={32} />
              <div className="flex-1">
                <p className="text-sm font-medium">Routed to Asha Nair, Platinum and refunds desk</p>
                <p className="text-xs text-zinc-500">Chosen for Hindi fluency and refund approval rights. 2 of 6 agents free</p>
              </div>
              <span className="text-xs font-medium text-emerald-600">Available</span>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            {transfer.state === "ringing" ? (
              <Btn variant="primary" className="h-12 w-full text-base" onClick={accept}><Phone className="h-4 w-4" /> Accept transfer</Btn>
            ) : (
              <Btn variant="dark" className="h-12 w-full text-base" onClick={() => update({ transfer: { ...transfer, state: "ringing" } })}>
                {transfer.state === "accepted" ? "End call, back to queue" : "Ring me again"}
              </Btn>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn onClick={decline} disabled={transfer.state !== "ringing"}>Decline</Btn>
              <Btn onClick={() => setNoteOpen(true)}>Add note</Btn>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              {transfer.state === "ringing" && "Rohan hears hold music until you accept. Auto returns to Meera in 00:42."}
              {transfer.state === "accepted" && "You are live with Rohan. Meera's summary and case #5521 stay on screen."}
              {transfer.state === "declined" && "Meera has Rohan back and is offering a callback from the refunds desk."}
            </p>
            {transfer.notes.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-700">
                {transfer.notes.map((n, i) => <li key={i} className="rounded-md bg-zinc-50 px-2 py-1.5">{n}</li>)}
              </ul>
            )}
          </Panel>

          <div className={refundDecided ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4" : "rounded-xl border border-amber-200 bg-amber-50 p-4"}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Suggested next step</p>
              {refundDecided ? <Pill tone={refundDecided === "approved" ? "green" : "red"}>Refund {refundDecided}</Pill> : <Pill tone="amber">Policy gate</Pill>}
            </div>
            <p className="mt-1.5 text-sm font-semibold">Review and approve the ₹38,400 refund on case #5521.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
              Why: refunds over ₹25,000 need a human. The booking is inside the 7 day cancellation window, so full refund is allowed. Then confirm the Kumbhalgarh hold.
            </p>
            {!refundDecided && (
              <div className="mt-3 flex gap-2">
                <Btn size="sm" variant="dark" onClick={() => { update((s) => ({ decided: { ...s.decided, "refund-5521": "approved" } })); log("Approved ₹38,400 refund on case #5521 for Rohan Mehta", "Case 5521"); toast({ title: "Refund approved", description: "Case #5521 moves to finance. Rohan gets the money on the original card in 5 to 7 days." }); }}>Approve ₹38,400</Btn>
                <Btn size="sm" onClick={() => { update((s) => ({ decided: { ...s.decided, "refund-5521": "declined" } })); log("Declined refund on case #5521, offered credit note", "Case 5521"); toast({ title: "Refund declined", description: "A credit note for ₹38,400 is offered instead." }); }}>Decline</Btn>
              </div>
            )}
          </div>
          {noteOpen && (
            <Modal title="Add a note to the handoff" hint="Asha sees it the moment she accepts. It is also written to case #5521." onClose={() => setNoteOpen(false)} footer={<ModalActions onCancel={() => setNoteOpen(false)} onOk={addNote} okLabel="Add note" okDisabled={!note.trim()} />}>
              <Field label="Note">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputClass + " h-auto py-2"} placeholder="e.g. Rohan prefers Hindi, keep it short, he has already explained twice." />
              </Field>
            </Modal>
          )}

          <Panel>
            <PanelHeader title="What Meera already did" />
            <ul className="px-4 py-2">
              {DID.map((d) => (
                <li key={d.name} className="flex gap-2.5 py-2.5">
                  <span className="pt-1.5"><Dot tone={d.tone} /></span>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-zinc-500">{d.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Active holds" />
            <ul className="divide-y divide-zinc-100 px-4">
              <Hold title="Kumbhalgarh Studio, 9 to 12 Jan" sub="No payment taken" expires="Expires 23:41:08" />
              <Hold title="Mussoorie 1BR, 14 to 16 Feb" sub="Placed 5 days ago" expires="Expires 00:18:30" hot />
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{k}</p>
      <p className="font-semibold">{v}</p>
    </div>
  );
}

function Hold({ title, sub, expires, hot }: { title: string; sub: string; expires: string; hot?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
      <Pill tone={hot ? "red" : "orange"}>{expires}</Pill>
    </li>
  );
}

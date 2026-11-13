import { Phone } from "lucide-react";
import { Avatar, Btn, Dot, Lang, Langs, Panel, PanelHeader, Pill } from "@/console/ui";

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
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[13px] text-zinc-500">Warm transfers / Club Mahindra Platinum queue</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Incoming warm transfer</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="orange"><Dot tone="orange" /><span className="ml-1.5">Ringing 00:18</span></Pill>
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
            <Btn variant="primary" className="h-12 w-full text-base"><Phone className="h-4 w-4" /> Accept transfer</Btn>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn>Decline</Btn>
              <Btn>Add note</Btn>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Rohan hears hold music until you accept. Auto returns to Meera in 00:42.</p>
          </Panel>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Suggested next step</p>
              <Pill tone="amber">Policy gate</Pill>
            </div>
            <p className="mt-1.5 text-sm font-semibold">Review and approve the ₹38,400 refund on case #5521.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
              Why: refunds over ₹25,000 need a human. The booking is inside the 7 day cancellation window, so full refund is allowed. Then confirm the Kumbhalgarh hold.
            </p>
          </div>

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

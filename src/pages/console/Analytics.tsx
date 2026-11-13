import { Btn, PageTitle, Panel, PanelHeader, Td, Th } from "@/console/ui";

const DAYS = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
const VOLUME = [1180, 1310, 1420, 1390, 1240, 1200, 1202]; // split 46/31/23 Hindi/English/Mixed
const TREND = [68.1, 69.0, 69.6, 70.2, 70.6, 71.0, 71.4];

const COST = [
  { model: "gpt-realtime", role: "Conversation", rpm: "₹1.74", total: "₹80,388", lever: "Cache the opening line to cut 6% of audio output cost" },
  { model: "Azure Speech, Aarti Indic voice", role: "Text to speech", rpm: "₹0.88", total: "₹40,656", lever: "Pre-render the top 40 repeated phrases, saves about ₹0.07 per minute" },
  { model: "Azure Speech to text", role: "Hindi, English, Hinglish", rpm: "₹0.31", total: "₹14,322", lever: "Skip transcription of hold music and silence, about 4% fewer minutes" },
  { model: "Summary model", role: "After call notes and log_call", rpm: "₹0.17", total: "₹7,854", lever: "Summarise only transferred calls in full, short form for the rest" },
];

const C = { hi: "#18181b", en: "#E2703A", mixed: "#F3C3A6" };

export default function Analytics() {
  const max = Math.max(...VOLUME);
  const points = TREND.map((v, i) => `${(i / (TREND.length - 1)) * 100},${100 - ((v - 67) / 5) * 100}`).join(" ");
  // donut: 46 / 31 / 23
  const r = 36, circ = 2 * Math.PI * r;

  return (
    <>
      <PageTitle crumb="Govern, Club Mahindra member line, Meera v7" title="Analytics" actions={<><Btn>Export CSV</Btn><Btn variant="dark">Schedule weekly report</Btn></>} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
        <Btn size="sm">Last 7 days, 6 to 12 Nov</Btn><Btn size="sm">Club Mahindra line</Btn><Btn size="sm">All languages</Btn>
        <span className="text-zinc-500">Compared with the previous 7 days</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi l="Call volume" v="8,942" s="+6.4% vs last week" />
        <Kpi l="Containment" v="71.4%" s="+2.1 pts" />
        <Kpi l="Average handle time" v="3m 42s" s="12s faster" />
        <Kpi l="Transfer rate" v="22.6%" s="1.8 pts lower" />
        <Kpi l="Cost per minute" v="₹3.10" s="₹0.12 lower" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1.3fr_1fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between text-sm">
            <p className="font-semibold">Call volume by language</p>
            <span className="flex gap-3 text-[11px] text-zinc-600"><Leg c={C.hi} t="Hindi" /><Leg c={C.en} t="English" /><Leg c={C.mixed} t="Mixed" /></span>
          </div>
          <div className="mt-4 flex h-40 items-end gap-3">
            {VOLUME.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-zinc-500">{v.toLocaleString("en-IN")}</span>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(v / max) * 100}%` }}>
                  <div style={{ height: "46%", background: C.hi }} /><div style={{ height: "31%", background: C.en }} /><div style={{ height: "23%", background: C.mixed }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-zinc-500">{DAYS.map((d) => <span key={d} className="flex-1 text-center">{d}</span>)}</div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between text-sm"><p className="font-semibold">Containment trend</p><span className="text-xs text-zinc-500">Calls Meera closed alone</span></div>
          <svg viewBox="-4 -8 108 116" className="mt-3 h-44 w-full" preserveAspectRatio="none">
            <polyline points={points} fill="none" stroke={C.en} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            {TREND.map((v, i) => (i % 3 === 0 ? <circle key={i} cx={(i / 6) * 100} cy={100 - ((v - 67) / 5) * 100} r="2" fill="white" stroke={C.en} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : null))}
          </svg>
          <div className="-mt-1 flex justify-between text-[11px] text-zinc-500"><span>Thu · 68.1%</span><span>Sat</span><span>Mon · 70.2%</span><span className="font-medium text-[#E2703A]">Wed · 71.4%</span></div>
        </Panel>

        <Panel className="p-4">
          <p className="text-sm font-semibold">Language mix</p>
          <div className="mt-3 flex items-center gap-4">
            <svg viewBox="0 0 96 96" className="h-28 w-28 -rotate-90">
              {[["46", C.hi, 0], ["31", C.en, 46], ["23", C.mixed, 77]].map(([p, c, off]) => (
                <circle key={c as string} cx="48" cy="48" r={r} fill="none" stroke={c as string} strokeWidth="18" strokeDasharray={`${(Number(p) / 100) * circ} ${circ}`} strokeDashoffset={-(Number(off) / 100) * circ} />
              ))}
            </svg>
            <ul className="space-y-2 text-sm">
              <li><Leg c={C.hi} t={<span><b className="text-base">46%</b><br /><span className="text-xs text-zinc-500">Hindi</span></span>} /></li>
              <li><Leg c={C.en} t={<span><b className="text-base">31%</b><br /><span className="text-xs text-zinc-500">English</span></span>} /></li>
              <li><Leg c={C.mixed} t={<span><b className="text-base">23%</b><br /><span className="text-xs text-zinc-500">Mixed Hinglish</span></span>} /></li>
            </ul>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 overflow-x-auto">
        <PanelHeader title="Cost per minute by model" right={<span className="text-xs text-zinc-500">Internal cost, November to date, 46,200 voice minutes</span>} />
        <table className="w-full min-w-[720px]">
          <thead className="bg-zinc-50"><tr><Th>Model</Th><Th className="text-right">Minutes</Th><Th className="text-right">Rupees per min</Th><Th className="text-right">Total this month</Th><Th>Profit lever</Th></tr></thead>
          <tbody>
            {COST.map((c) => (
              <tr key={c.model} className="border-t border-zinc-100">
                <Td><p className="font-medium">{c.model}</p><p className="text-xs text-zinc-500">{c.role}</p></Td>
                <Td className="text-right">46,200</Td>
                <Td className="text-right font-semibold">{c.rpm}</Td>
                <Td className="text-right">{c.total}</Td>
                <Td className="text-zinc-600">{c.lever}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s: string }) {
  return (
    <Panel className="p-4">
      <p className="text-xs text-zinc-500">{l}</p>
      <p className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{v}</p>
      <p className="text-[11px] font-medium text-emerald-600">{s}</p>
    </Panel>
  );
}

function Leg({ c, t }: { c: string; t: React.ReactNode }) {
  return <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c }} />{t}</span>;
}

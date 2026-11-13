import { Link } from "react-router-dom";
import { Btn, IconTile, Pill } from "@/console/ui";
import { WayamMark } from "@/components/brand/WayamMark";

const ALERTS = [
  { emoji: "🫱", title: "Meenal Joshi, Silver", sub: "Warm transfer to Asha, 38 sec wait", action: "Open", to: "/console/transfers" },
  { emoji: "⏳", title: "2 holds expire in 10 min", sub: "Lonavala 1BR, Mussoorie 2BR", action: "Extend", to: "/console/knowledge" },
  { emoji: "🧳", title: "Upgrade request, Anita Iyer", sub: "Studio to 2BR, Goa, Gold", action: "Review", to: "/console/review" },
  { emoji: "❓", title: "Low confidence, Imran Qureshi", sub: "Billing query, 07:30, English lean", action: "Listen", to: "/console/live/4824" },
  { emoji: "🧊", title: "Freshdesk retrying", sub: "create_case slow, 1 retry in 40 sec", action: "Status", to: "/console/tools" },
];

/** Phone-first alert feed. On desktop it renders as a narrow column so the same route works everywhere. */
export default function MobileSupervisor() {
  return (
    <div className="mx-auto max-w-[420px]">
      <div className="flex items-center gap-3">
        <WayamMark size={36} />
        <div className="flex-1">
          <p className="text-lg font-semibold leading-tight">Pune desk</p>
          <p className="text-xs text-zinc-500">Kavita Rao, floor supervisor</p>
        </div>
        <Pill tone="green">14 live</Pill>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-zinc-100 p-4"><p className="text-2xl font-semibold">71.4%</p><p className="text-xs text-zinc-500">Contained today</p></div>
        <div className="rounded-xl bg-amber-50 p-4"><p className="text-2xl font-semibold text-amber-700">3</p><p className="text-xs text-zinc-600">Waiting for a human</p></div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-lg font-semibold">Needs you</p>
        <span className="text-xs font-medium text-[#E2703A]">7 alerts</span>
      </div>

      <div className="mt-3 rounded-xl border-2 border-[#E2703A] bg-[#FDF6F1] p-4">
        <div className="flex items-center gap-3">
          <IconTile emoji="🚩" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Rohan Mehta, Platinum</p>
            <p className="text-xs text-zinc-600">Refund of 38,400 rupees needs approval</p>
          </div>
          <Pill tone="orange">06:48</Pill>
        </div>
        <p className="mt-3 text-[13px] text-zinc-700">Sentiment dropped. Caller says "yeh kya policy hai, mujhe poora refund chahiye". Holding for a human.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to="/console/live/4812"><Btn variant="primary" className="w-full">Take over</Btn></Link>
          <Link to="/console/live/4812"><Btn className="w-full">Listen in</Btn></Link>
        </div>
      </div>

      <ul className="mt-3 space-y-3">
        {ALERTS.map((a) => (
          <li key={a.title} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
            <IconTile emoji={a.emoji} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.title}</p>
              <p className="truncate text-xs text-zinc-500">{a.sub}</p>
            </div>
            <Link to={a.to}><Btn size="sm">{a.action}</Btn></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

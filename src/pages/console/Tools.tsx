import { Btn, PageTitle, Panel, PanelHeader, Pill, Td, Th, type Tone } from "@/console/ui";
import { cn } from "@/lib/utils";

type Status = { label: string; tone: Tone };
const CONNECTED: Status = { label: "Connected", tone: "green" };
const NOT: Status = { label: "Not connected", tone: "neutral" };

const CRM = [
  { glyph: "☁️", name: "Salesforce", server: "salesforce-mcp", verbs: "lookup_caller, create_case, log_call", sync: "2 min ago", p95: "212 ms p95", status: CONNECTED },
  { glyph: "🟦", name: "Dynamics 365", server: "dynamics365-mcp", verbs: "lookup_caller, check_availability, place_hold", sync: "Just now", p95: "340 ms p95", status: CONNECTED },
  { glyph: "🔴", name: "Zoho", server: "zoho-crm-mcp", verbs: "lookup_caller, create_case", sync: "Never synced", p95: "No token", status: NOT },
  { glyph: "◼️", name: "LeadSquared", server: "leadsquared-mcp", verbs: "lookup_caller, log_call, create_case", sync: "6 min ago", p95: "280 ms p95", status: CONNECTED },
  { glyph: "🌈", name: "Freshdesk", server: "freshdesk-mcp", verbs: "create_case, log_call", sync: "14 min ago", p95: "1180 ms p95", slow: true, status: { label: "Degraded 1 retry", tone: "amber" as Tone } },
  { glyph: "🧡", name: "HubSpot", server: "hubspot-mcp", verbs: "lookup_caller, log_call", sync: "Never synced", p95: "No token", status: NOT },
];

const TELEPHONY = [
  { glyph: "✳️", name: "Exotel", kind: "Inbound voice", route: "Inbound number 1800 266 4411, Club Mahindra member line", latency: "86 ms", use: "22 of 60 in use", status: CONNECTED },
  { glyph: "🔴", name: "Twilio", kind: "Media Streams", route: "Outbound campaigns, bidirectional audio over WebSocket", latency: "112 ms", use: "6 of 40 in use", status: CONNECTED },
  { glyph: "📡", name: "SIP trunk", kind: "Genesys, Ozonetel, Ameyo", route: "Warm transfers to the human queue over TLS and SRTP", latency: "64 ms", use: "3 of 20 in use", status: CONNECTED },
  { glyph: "🅰️", name: "Azure Communication Services", kind: "Call Automation", route: "Planned for the next quarter, not yet routing calls", latency: "Not measured", use: "0 of 0 in use", status: { label: "Planned", tone: "purple" as Tone } },
];

const VERBS = [
  { v: "lookup_caller", p95: "212 ms", ok: "99.8%" },
  { v: "check_availability", p95: "640 ms", ok: "99.2%" },
  { v: "place_hold", p95: "810 ms", ok: "98.9%" },
  { v: "create_case", p95: "1.2 s", ok: "96.4%", slow: true },
  { v: "log_call", p95: "430 ms", ok: "99.6%" },
  { v: "handoff", p95: "380 ms", ok: "99.9%" },
];

export default function Tools() {
  return (
    <>
      <PageTitle crumb="Build / Tools and integrations" title="What Meera can reach, and how fast" actions={<><Btn>Run connection tests</Btn><Btn variant="primary">Add adapter</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel className="overflow-x-auto">
          <PanelHeader title="CRM adapters exposed as MCP tools" hint="Meera calls verbs, the adapter talks to the CRM" />
          <table className="w-full min-w-[720px]">
            <thead className="bg-zinc-50"><tr><Th>Adapter and MCP server</Th><Th>Verbs it serves</Th><Th>Last sync</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {CRM.map((a) => (
                <tr key={a.name} className="border-t border-zinc-100">
                  <Td><Row glyph={a.glyph} name={a.name} sub={a.server} /></Td>
                  <Td className="text-zinc-600">{a.verbs}</Td>
                  <Td>
                    <p className={cn(a.status === NOT && "text-zinc-400")}>{a.sync}</p>
                    <p className={cn("text-xs", a.slow ? "text-amber-600" : "text-zinc-500")}>{a.p95}</p>
                  </Td>
                  <Td><Pill tone={a.status.tone}>{a.status.label}</Pill></Td>
                  <Td className="text-right"><Btn size="sm">Configure</Btn></Td>
                </tr>
              ))}
            </tbody>
          </table>

          <PanelHeader title="Telephony and media" hint="How calls reach Meera, with media latency and channels in use" className="border-t border-dashed border-zinc-200" />
          <table className="w-full min-w-[720px]">
            <thead className="bg-zinc-50"><tr><Th>Provider</Th><Th>Route</Th><Th>Latency</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {TELEPHONY.map((t) => (
                <tr key={t.name} className="border-t border-zinc-100">
                  <Td><Row glyph={t.glyph} name={t.name} sub={t.kind} /></Td>
                  <Td className="text-zinc-600">{t.route}</Td>
                  <Td><p>{t.latency}</p><p className="text-xs text-zinc-500">{t.use}</p></Td>
                  <Td><Pill tone={t.status.tone}>{t.status.label}</Pill></Td>
                  <Td className="text-right"><Btn size="sm">Configure</Btn></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Six tool verbs" hint="Last 24 hours, all adapters combined" className="flex-col items-start gap-0" />
            <table className="w-full">
              <thead><tr><Th>Verb</Th><Th className="text-right">p95</Th><Th className="text-right">Success</Th></tr></thead>
              <tbody>
                {VERBS.map((x) => (
                  <tr key={x.v} className="border-t border-zinc-100">
                    <Td className="font-medium">{x.v}</Td>
                    <Td className={cn("text-right", x.slow && "text-amber-600")}>{x.p95}</Td>
                    <Td className={cn("text-right font-medium", x.slow ? "text-amber-600" : "text-emerald-600")}>{x.ok}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="rounded-xl bg-zinc-100 p-4 text-[13px]">
            <p className="text-sm font-semibold">Needs attention</p>
            <Note title="Freshdesk is slow" tone="text-amber-700" body="create_case p95 is 1.2 s with one retry. Meera tells the caller a ticket is being raised and moves on." />
            <Note title="Zoho and HubSpot not connected" body="No member lookups run on them. Calls use Salesforce and Dynamics 365." />
            <Note title="Azure Communication Services planned" body="Not routing calls yet. Exotel and SIP carry all traffic today." />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ glyph, name, sub }: { glyph: string; name: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg" aria-hidden>{glyph}</span>
      <div><p className="font-medium">{name}</p><p className="text-xs text-zinc-500">{sub}</p></div>
    </div>
  );
}

function Note({ title, body, tone = "text-zinc-900" }: { title: string; body: string; tone?: string }) {
  return (
    <div className="mt-3">
      <p className={cn("font-semibold", tone)}>{title}</p>
      <p className="text-zinc-600">{body}</p>
    </div>
  );
}

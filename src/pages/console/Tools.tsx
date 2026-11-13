import { useState } from "react";
import { Btn, PageTitle, Panel, PanelHeader, Pill, Td, Th, type Tone } from "@/console/ui";
import { useConsole, type AdapterStatus } from "@/console/store";
import { Modal, Field, inputClass, ModalActions } from "@/console/Modal";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TONE: Record<AdapterStatus, Tone> = { Connected: "green", "Not connected": "neutral", "Degraded 1 retry": "amber", Planned: "purple", Testing: "blue" };

const CRM = [
  { glyph: "☁️", name: "Salesforce", server: "salesforce-mcp", verbs: "lookup_caller, create_case, log_call", sync: "2 min ago", p95: "212 ms p95" },
  { glyph: "🟦", name: "Dynamics 365", server: "dynamics365-mcp", verbs: "lookup_caller, check_availability, place_hold", sync: "Just now", p95: "340 ms p95" },
  { glyph: "🔴", name: "Zoho", server: "zoho-crm-mcp", verbs: "lookup_caller, create_case", sync: "Never synced", p95: "No token" },
  { glyph: "◼️", name: "LeadSquared", server: "leadsquared-mcp", verbs: "lookup_caller, log_call, create_case", sync: "6 min ago", p95: "280 ms p95" },
  { glyph: "🌈", name: "Freshdesk", server: "freshdesk-mcp", verbs: "create_case, log_call", sync: "14 min ago", p95: "1180 ms p95" },
  { glyph: "🧡", name: "HubSpot", server: "hubspot-mcp", verbs: "lookup_caller, log_call", sync: "Never synced", p95: "No token" },
];

const TELEPHONY = [
  { glyph: "✳️", name: "Exotel", kind: "Inbound voice", route: "Inbound number 1800 266 4411, Club Mahindra member line", latency: "86 ms", use: "22 of 60 in use" },
  { glyph: "🔴", name: "Twilio", kind: "Media Streams", route: "Outbound campaigns, bidirectional audio over WebSocket", latency: "112 ms", use: "6 of 40 in use" },
  { glyph: "📡", name: "SIP trunk", kind: "Genesys, Ozonetel, Ameyo", route: "Warm transfers to the human queue over TLS and SRTP", latency: "64 ms", use: "3 of 20 in use" },
  { glyph: "🅰️", name: "Azure Communication Services", kind: "Call Automation", route: "Planned for the next quarter, not yet routing calls", latency: "Not measured", use: "0 of 0 in use" },
];

const VERBS = [
  { v: "lookup_caller", p95: "212 ms", ok: "99.8%" },
  { v: "check_availability", p95: "640 ms", ok: "99.2%" },
  { v: "place_hold", p95: "810 ms", ok: "98.9%" },
  { v: "create_case", p95: "1.2 s", ok: "96.4%", slow: true },
  { v: "log_call", p95: "430 ms", ok: "99.6%" },
  { v: "handoff", p95: "380 ms", ok: "99.9%" },
];

const ADAPTER_KINDS = ["CRM over MCP", "Ticketing over MCP", "Telephony provider"] as const;

export default function Tools() {
  const { state, update, log } = useConsole();
  const { adapters } = state;
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", kind: ADAPTER_KINDS[0] as string, url: "" });
  const [testing, setTesting] = useState(false);
  const [extra, setExtra] = useState<{ glyph: string; name: string; server: string; verbs: string; sync: string; p95: string }[]>([]);

  const set = (name: string, status: AdapterStatus) => update((s) => ({ adapters: { ...s.adapters, [name]: status } }));
  const liveStatus = (name: string): AdapterStatus => adapters[name] ?? "Not connected";

  const runTests = async () => {
    if (testing) return;
    setTesting(true);
    const names = [...CRM, ...extra].map((a) => a.name).concat(TELEPHONY.map((t) => t.name)).filter((n) => liveStatus(n) !== "Planned" && liveStatus(n) !== "Not connected");
    const before = { ...adapters };
    for (const n of names) set(n, "Testing");
    // shortcut: tests are a timed sweep, not real probes; Freshdesk recovers only if its retry budget cleared. Replace with the MCP /health call when adapters are deployed.
    for (const n of names) {
      await new Promise((r) => setTimeout(r, 350));
      set(n, before[n] === "Degraded 1 retry" ? "Degraded 1 retry" : "Connected");
    }
    setTesting(false);
    log(`Ran connection tests on ${names.length} adapters`, "Tools");
    const degraded = names.filter((n) => before[n] === "Degraded 1 retry");
    toast({ title: `${names.length} adapters tested`, description: degraded.length ? `${degraded.join(", ")} still slow. Everything else answered first try.` : "All adapters answered first try." });
  };

  const saveConfig = () => {
    if (!configuring) return;
    const name = configuring;
    const wasOff = liveStatus(name) === "Not connected" || liveStatus(name) === "Planned";
    set(name, token.trim() ? "Connected" : wasOff ? "Not connected" : liveStatus(name));
    log(token.trim() ? `${name}: token saved, adapter connected` : `${name}: configuration reviewed`, "Tools");
    toast({ title: token.trim() ? `${name} connected` : "Saved", description: token.trim() ? "Meera can call its verbs from the next call. Token is stored server side, never in the prompt." : `${name} settings unchanged.` });
    setToken("");
    setConfiguring(null);
  };

  const addAdapter = () => {
    const name = draft.name.trim();
    if (!name) return;
    const server = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-mcp";
    setExtra((x) => [...x, { glyph: "🧩", name, server, verbs: draft.kind.startsWith("Ticketing") ? "create_case, log_call" : "lookup_caller, log_call", sync: "Never synced", p95: "No token" }]);
    set(name, "Not connected");
    log(`Added adapter ${name} (${draft.kind})`, "Tools");
    setAdding(false);
    setDraft({ name: "", kind: ADAPTER_KINDS[0], url: "" });
    toast({ title: `${name} added`, description: "Configure it with a token to bring it online." });
  };

  const attention = [
    liveStatus("Freshdesk") === "Degraded 1 retry" && { title: "Freshdesk is slow", tone: "text-amber-700", body: "create_case p95 is 1.2 s with one retry. Meera tells the caller a ticket is being raised and moves on." },
    (liveStatus("Zoho") === "Not connected" || liveStatus("HubSpot") === "Not connected") && { title: [liveStatus("Zoho") === "Not connected" && "Zoho", liveStatus("HubSpot") === "Not connected" && "HubSpot"].filter(Boolean).join(" and ") + " not connected", body: "No member lookups run on them. Calls use Salesforce and Dynamics 365." },
    liveStatus("Azure Communication Services") === "Planned" && { title: "Azure Communication Services planned", body: "Not routing calls yet. Exotel and SIP carry all traffic today." },
  ].filter(Boolean) as { title: string; body: string; tone?: string }[];

  return (
    <>
      <PageTitle crumb="Build / Tools and integrations" title="What Meera can reach, and how fast" actions={<><Btn onClick={runTests} disabled={testing}>{testing ? "Testing…" : "Run connection tests"}</Btn><Btn variant="primary" onClick={() => setAdding(true)}>Add adapter</Btn></>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel className="overflow-x-auto">
          <PanelHeader title="CRM adapters exposed as MCP tools" hint="Meera calls verbs, the adapter talks to the CRM" />
          <table className="w-full min-w-[720px]">
            <thead className="bg-zinc-50"><tr><Th>Adapter and MCP server</Th><Th>Verbs it serves</Th><Th>Last sync</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {[...CRM, ...extra].map((a) => {
                const st = liveStatus(a.name);
                const off = st === "Not connected";
                return (
                  <tr key={a.name} className="border-t border-zinc-100">
                    <Td><Row glyph={a.glyph} name={a.name} sub={a.server} /></Td>
                    <Td className="text-zinc-600">{a.verbs}</Td>
                    <Td>
                      <p className={cn(off && "text-zinc-400")}>{off ? "Never synced" : st === "Testing" ? "Testing now" : a.sync === "Never synced" ? "Just now" : a.sync}</p>
                      <p className={cn("text-xs", st === "Degraded 1 retry" ? "text-amber-600" : "text-zinc-500")}>{off ? "No token" : a.p95 === "No token" ? "first sync" : a.p95}</p>
                    </Td>
                    <Td><Pill tone={TONE[st]}>{st}</Pill></Td>
                    <Td className="text-right"><Btn size="sm" onClick={() => setConfiguring(a.name)}>Configure</Btn></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <PanelHeader title="Telephony and media" hint="How calls reach Meera, with media latency and channels in use" className="border-t border-dashed border-zinc-200" />
          <table className="w-full min-w-[720px]">
            <thead className="bg-zinc-50"><tr><Th>Provider</Th><Th>Route</Th><Th>Latency</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {TELEPHONY.map((t) => {
                const st = liveStatus(t.name);
                return (
                  <tr key={t.name} className="border-t border-zinc-100">
                    <Td><Row glyph={t.glyph} name={t.name} sub={t.kind} /></Td>
                    <Td className="text-zinc-600">{t.route}</Td>
                    <Td><p>{t.latency}</p><p className="text-xs text-zinc-500">{t.use}</p></Td>
                    <Td><Pill tone={TONE[st]}>{st}</Pill></Td>
                    <Td className="text-right"><Btn size="sm" onClick={() => setConfiguring(t.name)}>Configure</Btn></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Six tool verbs" hint="Last 24 hours, all adapters combined" stack />
            <table className="w-full">
              <thead><tr><Th>Verb</Th><Th className="text-right">p95</Th><Th className="text-right">Success</Th></tr></thead>
              <tbody>
                {VERBS.map((x) => (
                  <tr key={x.v} className="border-t border-zinc-100">
                    <Td className="font-medium">{x.v}</Td>
                    <Td className={cn("whitespace-nowrap text-right", x.slow && "text-amber-600")}>{x.p95}</Td>
                    <Td className={cn("text-right font-medium", x.slow ? "text-amber-600" : "text-emerald-600")}>{x.ok}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="rounded-xl bg-zinc-100 p-4 text-[13px]">
            <p className="text-sm font-semibold">Needs attention</p>
            {attention.length === 0 && <p className="mt-2 text-zinc-600">Every adapter is connected and answering within budget.</p>}
            {attention.map((n) => (
              <div key={n.title} className="mt-3">
                <p className={cn("font-semibold", n.tone ?? "text-zinc-900")}>{n.title}</p>
                <p className="text-zinc-600">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {configuring && (
        <Modal title={`Configure ${configuring}`} hint="Tokens are stored in the adapter's secret store, never sent to the browser again." onClose={() => setConfiguring(null)} footer={<ModalActions onCancel={() => setConfiguring(null)} onOk={saveConfig} okLabel={liveStatus(configuring) === "Not connected" || liveStatus(configuring) === "Planned" ? "Connect" : "Save"} />}>
          <p>Status: <Pill tone={TONE[liveStatus(configuring)]}>{liveStatus(configuring)}</Pill></p>
          <Field label="API token or client secret"><input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={inputClass} placeholder={liveStatus(configuring) === "Connected" ? "Leave blank to keep the current token" : "Paste a token to connect"} autoComplete="off" /></Field>
          <Field label="Verbs exposed to Meera"><input readOnly value={[...CRM, ...extra].find((a) => a.name === configuring)?.verbs ?? "media, handoff"} className={inputClass + " bg-zinc-50 text-zinc-500"} /></Field>
          {liveStatus(configuring) !== "Not connected" && liveStatus(configuring) !== "Planned" && (
            <button className="text-xs font-medium text-red-600" onClick={() => { set(configuring, "Not connected"); log(`${configuring}: disconnected`, "Tools"); setConfiguring(null); toast({ title: `${configuring} disconnected`, description: "Its verbs are hidden from Meera until a token is saved again." }); }}>Disconnect this adapter</button>
          )}
        </Modal>
      )}
      {adding && (
        <Modal title="Add an adapter" hint="Creates an MCP server entry. Meera only sees its verbs once it is connected." onClose={() => setAdding(false)} footer={<ModalActions onCancel={() => setAdding(false)} onOk={addAdapter} okLabel="Add adapter" okDisabled={!draft.name.trim()} />}>
          <Field label="Name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="Kapture CRM" /></Field>
          <Field label="Kind">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={inputClass}>{ADAPTER_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </Field>
          <Field label="MCP server URL (optional)"><input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} className={inputClass} placeholder="https://mcp.internal/kapture" /></Field>
        </Modal>
      )}
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

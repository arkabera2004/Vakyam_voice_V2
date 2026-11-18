import { Btn, IconTile, Pill } from "@/console/ui";
import { WayamMark } from "@/components/brand/WayamMark";
import { useOrg } from "@/hooks/useOrg";
import { useNotifications } from "@/hooks/useNotifications";
import { ROLE_LABEL } from "@/domain/roles";

const KIND_EMOJI: Record<string, string> = { "evaluation.assigned": "📋" };

/** Real notifications for the signed-in user. Phone-first layout; on desktop it renders as a narrow column so the same route works everywhere. */
export default function MobileSupervisor() {
  const me = useOrg();
  const { notifications, loading, unreadCount, markRead } = useNotifications();

  return (
    <div className="mx-auto max-w-[420px]">
      <div className="flex items-center gap-3">
        <WayamMark size={36} />
        <div className="flex-1">
          <p className="text-lg font-semibold leading-tight">{me.orgName ?? "Alerts"}</p>
          <p className="text-xs text-zinc-500">{me.name}{me.role ? `, ${ROLE_LABEL[me.role]}` : ""}</p>
        </div>
        {unreadCount > 0 && <Pill tone="orange">{unreadCount} new</Pill>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-lg font-semibold">Notifications</p>
      </div>

      {loading ? (
        <p className="mt-3 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">Nothing yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className={`flex items-center gap-3 rounded-xl border p-3 ${n.readAt ? "border-zinc-200 bg-white" : "border-[#E2703A] bg-[#FDF6F1]"}`}>
              <IconTile emoji={KIND_EMOJI[n.kind] ?? "🔔"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{n.title}</p>
                {n.body && <p className="truncate text-xs text-zinc-500">{n.body}</p>}
                <p className="text-[11px] text-zinc-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.readAt && <Btn size="sm" onClick={() => markRead(n.id)}>Mark read</Btn>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

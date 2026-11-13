import { Bell, Search, LogOut, Mic } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { WayamMark } from "@/components/brand/WayamMark";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { Btn } from "./ui";

const CRUMBS: Record<string, string> = {
  "/console": "Home",
  "/console/live": "Live calls",
  "/console/transfers": "Warm transfers / Agent desktop",
  "/console/review": "Call review / Call 4790",
  "/console/qa": "QA scorecards",
  "/console/studio": "Agent studio / Meera",
  "/console/tools": "Tools and integrations",
  "/console/routing": "Routing and campaigns",
  "/console/knowledge": "Knowledge and policies",
  "/console/compliance": "Compliance and consent",
  "/console/analytics": "Analytics",
};

export function ConsoleShell() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const crumb = CRUMBS[pathname] ?? (pathname.startsWith("/console/live/") ? "Live calls / Call 4821, Priya Sharma" : "Console");

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <Link to="/console" className="flex items-center gap-2.5 px-4 pt-4">
          <WayamMark size={26} />
          <span className="text-[15px] font-semibold">Vakyam</span>
          <span className="text-xs text-zinc-500">Voice</span>
        </Link>

        <label className="mx-3 mt-4 flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] text-zinc-500">
          <Search className="h-3.5 w-3.5" />
          <input className="w-full bg-transparent outline-none placeholder:text-zinc-400" placeholder="Search calls, callers, tools" />
        </label>

        <nav className="mt-3 flex-1 overflow-y-auto px-3">
          {NAV.map((g, gi) => (
            <div key={gi} className="mb-3">
              {g.group && <p className="mb-1 px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{g.group}</p>}
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === "/console"}
                  className={({ isActive }) =>
                    cn(
                      "flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px]",
                      isActive ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                    )
                  }
                >
                  <it.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.badge && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-medium",
                        it.badgeTone === "orange" && "bg-orange-100 text-orange-700",
                        it.badgeTone === "purple" && "bg-violet-100 text-violet-700",
                        it.badgeTone === "muted" && "text-zinc-400",
                      )}
                    >
                      {it.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mx-3 mb-3 rounded-lg border border-zinc-200 p-3 text-xs">
          <p className="font-medium text-zinc-700">AI cost this month</p>
          <div className="mt-1.5 flex justify-between text-zinc-500">
            <span>Voice minutes</span>
            <span className="text-zinc-800">₹1.42L / ₹4L</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-zinc-200">
            <div className="h-1 w-[35%] rounded-full bg-zinc-900" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-zinc-200 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">K</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">Kavita Rao</p>
            <p className="truncate text-[11px] text-zinc-500">Floor supervisor · Pune</p>
          </div>
          <button onClick={signOut} title="Log out" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-5 backdrop-blur">
          <p className="truncate text-[13px] text-zinc-600">{crumb}</p>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 sm:inline">Meera v7 · Club Mahindra desk</span>
            <button className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
            <Link to="/voice" className="hidden sm:block">
              <Btn variant="ghost" size="sm">
                <Mic className="h-3.5 w-3.5" /> Talk to Meera
              </Btn>
            </Link>
            <Link to="/console/live">
              <Btn variant="primary" size="sm">Open live wall</Btn>
            </Link>
          </div>
        </header>
        <main className="flex-1 px-5 py-6 md:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

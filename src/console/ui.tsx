import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Light-console primitives. Everything under /console uses these so the 12 screens read as one product. */

export const ACCENT = "#E2703A";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-xl border border-zinc-200 bg-white", className)}>{children}</section>;
}

export function PanelHeader({
  title,
  hint,
  right,
  className,
  stack,
}: {
  title: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  className?: string;
  /** Put the hint under the title, for narrow panels. */
  stack?: boolean;
}) {
  return (
    <header className={cn("flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3", className)}>
      <div className={cn("flex gap-2", stack ? "flex-col gap-0.5" : "items-baseline")}>
        <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
        {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      </div>
      {right}
    </header>
  );
}

export function PageTitle({
  crumb,
  title,
  actions,
  className,
}: {
  crumb?: string;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        {crumb && <p className="mb-1 text-[13px] text-zinc-500">{crumb}</p>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-zinc-900">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export type Tone = "neutral" | "green" | "amber" | "red" | "orange" | "purple" | "blue" | "dark";

const toneClass: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  orange: "bg-orange-50 text-orange-700",
  purple: "bg-violet-50 text-violet-700",
  blue: "bg-sky-50 text-sky-700",
  dark: "bg-zinc-900 text-white",
};

export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}

/** Sentence-level language tag: HI = black, EN = orange, as in the transcript designs. */
export function Lang({ code }: { code: "HI" | "EN" }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded px-1 text-[10px] font-bold leading-none",
        code === "HI" ? "bg-zinc-900 text-white" : "bg-[#E2703A] text-white",
      )}
    >
      {code}
    </span>
  );
}

export function Langs({ codes }: { codes: ("HI" | "EN")[] }) {
  return (
    <span className="inline-flex gap-1">
      {codes.map((c, i) => (
        <Lang key={i} code={c} />
      ))}
    </span>
  );
}

export function Avatar({ name, size = 36, dark = true, className }: { name: string; size?: number; dark?: boolean; className?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dark ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Stat({
  value,
  label,
  sub,
  subTone = "green",
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  subTone?: "green" | "red" | "muted";
  className?: string;
}) {
  const subColor = { green: "text-emerald-600", red: "text-red-600", muted: "text-zinc-500" }[subTone];
  return (
    <div className={className}>
      <div className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-zinc-900">{value}</div>
      <div className="mt-1.5 text-xs text-zinc-500">{label}</div>
      {sub && <div className={cn("mt-0.5 text-[11px] font-medium", subColor)}>{sub}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "dark" | "outline" | "ghost"; size?: "sm" | "md" };

export function Btn({ variant = "outline", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E2703A]/50 disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-sm",
        {
          primary: "bg-[#E2703A] text-white hover:bg-[#cf6330]",
          dark: "bg-zinc-900 text-white hover:bg-zinc-800",
          outline: "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
          ghost: "text-zinc-700 hover:bg-zinc-100",
        }[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Segmented horizontal bar, e.g. Hindi / English / Mixed. */
export function SegmentBar({ segments, className }: { segments: { value: number; color: string }[]; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full", className)}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

/** Progress bar: dark fill up to `value`%, on a grey track. */
export function Bar({ value, color = "#18181b", className, track = "bg-zinc-200" }: { value: number; color?: string; className?: string; track?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full", track, className)}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function Toggle({ on, label }: { on: boolean; label?: string }) {
  return (
    <span
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", on ? "bg-[#E2703A]" : "bg-zinc-300")}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
    </span>
  );
}

export function Dot({ tone = "green" }: { tone?: "green" | "amber" | "red" | "grey" | "orange" }) {
  const c = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", grey: "bg-zinc-300", orange: "bg-[#E2703A]" }[tone];
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", c)} />;
}

export function KV({ k, v, vClass }: { k: ReactNode; v: ReactNode; vClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 py-2.5 text-sm last:border-0">
      <span className="text-zinc-500">{k}</span>
      <span className={cn("font-medium text-zinc-900", vClass)}>{v}</span>
    </div>
  );
}

/** Emoji stand-in for the 3D icon tiles in the design. */
export function IconTile({ emoji, size = 40, className }: { emoji: string; size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white", className)}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 text-left text-xs font-medium text-zinc-500", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle text-sm text-zinc-800", className)}>{children}</td>;
}

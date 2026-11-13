import {
  Home,
  Phone,
  ArrowLeftRight,
  PlayCircle,
  ClipboardCheck,
  AudioLines,
  Plug,
  Route,
  BookOpen,
  ShieldCheck,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string; badgeTone?: "orange" | "muted" | "purple" };

export const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ to: "/console", label: "Home", icon: Home, badge: "7", badgeTone: "orange" }] },
  {
    group: "Operate",
    items: [
      { to: "/console/live", label: "Live calls", icon: Phone, badge: "14", badgeTone: "muted" },
      { to: "/console/transfers", label: "Warm transfers", icon: ArrowLeftRight, badge: "3", badgeTone: "muted" },
      { to: "/console/review", label: "Call review", icon: PlayCircle },
      { to: "/console/qa", label: "QA scorecards", icon: ClipboardCheck },
    ],
  },
  {
    group: "Build",
    items: [
      { to: "/console/studio", label: "Agent studio", icon: AudioLines, badge: "v7", badgeTone: "purple" },
      { to: "/console/tools", label: "Tools and integrations", icon: Plug },
      { to: "/console/routing", label: "Routing and campaigns", icon: Route },
      { to: "/console/knowledge", label: "Knowledge and policies", icon: BookOpen },
    ],
  },
  {
    group: "Govern",
    items: [
      { to: "/console/compliance", label: "Compliance and consent", icon: ShieldCheck },
      { to: "/console/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CalendarDays, CheckSquare, CreditCard, Inbox, Kanban, LayoutDashboard, Megaphone, Package, QrCode, ScrollText, Settings, Store, Target, UserCog, Users, Zap } from "lucide-react";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";

const items: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/inbox", label: "Inbox", icon: Inbox },
  { to: "/app/contacts", label: "Contacts", icon: Users },
  { to: "/app/leads", label: "Leads", icon: Target },
  { to: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/profile", label: "Business profile", icon: Store },
  { to: "/app/products", label: "Products & services", icon: Package },
  { to: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/app/links", label: "QR & links", icon: QrCode },
  { to: "/app/automation", label: "Automation", icon: Zap },
  { to: "/app/team", label: "Team", icon: UserCog },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/audit", label: "Audit log", icon: ScrollText },
];

export const Route = createFileRoute("/app")({
  component: Layout,
});

function Layout() {
  return <ConsoleShell items={items} title="Business workspace" subtitle="SwiftFix Gadgets • Growth plan" user={{ name: "Chidi Okonkwo", role: "Business owner" }} />;
}

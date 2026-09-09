import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  BarChart3,
  Cpu,
  CreditCard,
  FileCheck,
  Flag,
  Headphones,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Settings,
  ShieldAlert,
  Star,
  Store,
  Tags,
  ToggleLeft,
  Users,
} from "lucide-react";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";

const items: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/businesses", label: "Businesses", icon: Store },
  { to: "/admin/claims", label: "Claims", icon: FileCheck },
  { to: "/admin/verification", label: "Verification", icon: BadgeCheck },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/moderation", label: "Moderation", icon: ShieldAlert },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/ads", label: "Ads & promotions", icon: Megaphone },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/admin/support", label: "Support tickets", icon: Headphones },
  { to: "/admin/jobs", label: "System jobs", icon: Cpu },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/flags", label: "Feature flags", icon: ToggleLeft },
  { to: "/admin/config", label: "Configuration", icon: Settings },
  { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
];

export const Route = createFileRoute("/admin")({
  component: Layout,
});

function Layout() {
  return (
    <ConsoleShell
      items={items}
      title="Admin console"
      subtitle="Platform operations"
      user={{ name: "Ada Balogun", role: "Platform administrator" }}
    />
  );
}

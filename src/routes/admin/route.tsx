import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";

const items: NavItem[] = [{ to: "/admin", label: "Operations queue", icon: LayoutDashboard }];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Operations queue — GainHub NG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Layout,
});

function Layout() {
  return (
    <ConsoleShell
      items={items}
      title="Admin console"
      subtitle="Restricted platform operations"
      requiredRole="admin"
    />
  );
}

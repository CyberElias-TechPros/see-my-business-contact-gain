import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";

const items: NavItem[] = [{ to: "/app", label: "Workspace overview", icon: LayoutDashboard }];

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Business workspace — GainHub NG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Layout,
});

function Layout() {
  return (
    <ConsoleShell
      items={items}
      title="Business workspace"
      subtitle="Published listings and enquiries"
      requiredRole="user"
    />
  );
}

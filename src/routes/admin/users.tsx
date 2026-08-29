import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [q, setQ] = useState("");
  const users = useAd(qk.adUsers(q), (b) => b.adminUsers(q));
  const update = useAdMutation(
    (b, vars: { id: string; patch: { status?: string; role?: string } }) =>
      b.adminUpdateUser(vars.id, vars.patch),
    {
      invalidate: [qk.adUsers(q), qk.adOverview],
    },
  );

  if (users.isLoading) return <LoadingCard label="Loading users…" />;
  if (users.isError)
    return (
      <LoadError message={(users.error as Error)?.message} retry={() => void users.refetch()} />
    );

  const items = users.data ?? [];

  return (
    <div>
      <SectionHead
        title="Users"
        subtitle="Suspend abusive accounts, promote moderators, audit roles."
        action={
          <Input
            placeholder="Search name or email…"
            className="w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={String(items.length)} hint="matching filter" />
        <StatCard
          label="Owners"
          value={String(items.filter((u) => u.role === "owner").length)}
          hint="with workspaces"
        />
        <StatCard
          label="Suspended"
          value={String(items.filter((u) => u.status === "suspended").length)}
          hint="restricted"
        />
        <StatCard
          label="Admins"
          value={String(items.filter((u) => u.role === "admin").length)}
          hint="staff"
        />
      </div>
      <div className="mt-6">
        <Panel title={`${items.length} users`}>
          {items.length === 0 ? (
            <EmptyState title="No users match" body="Try a different search." />
          ) : (
            <div className="space-y-2">
              {items.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email} • joined{" "}
                      {new Date(
                        Number(u.ts) * (Number(u.ts) < 1e12 ? 60000 : 1),
                      ).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {u.role}
                  </Badge>
                  <Select
                    value={u.status}
                    onValueChange={(v) =>
                      update.mutate(
                        { id: u.id, patch: { status: v } },
                        { onSuccess: () => toast.success(`${u.name} → ${v}`) },
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["active", "suspended", "pending"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={u.role}
                    onValueChange={(v) =>
                      update.mutate(
                        { id: u.id, patch: { role: v } },
                        { onSuccess: () => toast.success(`${u.name} is now ${v}`) },
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["customer", "owner", "admin"].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

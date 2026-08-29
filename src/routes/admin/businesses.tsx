import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import {
  EmptyState,
  LoadError,
  LoadingCard,
  Panel,
  StatCard,
  VerifiedBadge,
} from "@/components/kit";
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

export const Route = createFileRoute("/admin/businesses")({
  component: AdminBusinesses,
});

function AdminBusinesses() {
  const [q, setQ] = useState("");
  const businesses = useAd(qk.adBusinesses(q), (b) => b.adminBusinesses(q));
  const update = useAdMutation(
    (
      b,
      vars: {
        id: string;
        patch: { verified?: string; plan?: string; status?: string; featured?: boolean };
      },
    ) => b.adminUpdateBusiness(vars.id, vars.patch),
    { invalidate: [qk.adBusinesses(q), qk.adOverview] },
  );

  if (businesses.isLoading) return <LoadingCard label="Loading businesses…" />;
  if (businesses.isError)
    return (
      <LoadError
        message={(businesses.error as Error)?.message}
        retry={() => void businesses.refetch()}
      />
    );

  const items = businesses.data ?? [];
  const act = (id: string, patch: Parameters<typeof update.mutate>[0]["patch"], msg: string) =>
    update.mutate({ id, patch }, { onSuccess: () => toast.success(msg) });

  return (
    <div>
      <SectionHead
        title="Businesses"
        subtitle="Verification, plans, featuring and suspensions."
        action={
          <Input
            placeholder="Search businesses…"
            className="w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Listings" value={String(items.length)} hint="matching filter" />
        <StatCard
          label="Verified"
          value={String(items.filter((b) => b.verified !== "unverified").length)}
          hint="trust level"
        />
        <StatCard
          label="Featured"
          value={String(items.filter((b) => b.featured).length)}
          hint="homepage slots"
        />
        <StatCard
          label="Paid plans"
          value={String(items.filter((b) => b.plan !== "Free").length)}
          hint="recurring revenue"
        />
      </div>
      <div className="mt-6">
        <Panel title={`${items.length} listings`}>
          {items.length === 0 ? (
            <EmptyState title="No businesses match" body="Try a different search." />
          ) : (
            <div className="space-y-2">
              {items.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{b.name}</p>
                      <VerifiedBadge level={b.verified} />
                      {b.featured ? <Badge>Featured</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.id} • {b.categorySlug} • {b.address?.split(",")[0]}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={b.verified === "unverified" ? "default" : "outline"}
                    onClick={() =>
                      act(
                        b.id,
                        { verified: b.verified === "unverified" ? "documents" : "unverified" },
                        `${b.name} verification updated`,
                      )
                    }
                  >
                    {b.verified === "unverified" ? "Verify" : "Unverify"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      act(
                        b.id,
                        { featured: !b.featured },
                        b.featured ? "Unfeatured" : "Featured on homepage",
                      )
                    }
                  >
                    {b.featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Select
                    value={b.plan}
                    onValueChange={(v) => act(b.id, { plan: v }, `${b.name} → ${v} plan`)}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Free", "Growth", "Pro"].map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={b.verified}
                    onValueChange={(v) =>
                      act(b.id, { verified: v }, `${b.name} verification → ${v}`)
                    }
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["unverified", "email", "phone", "documents", "premium"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
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

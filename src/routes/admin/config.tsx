import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/config")({
  component: AdminConfig,
});

function AdminConfig() {
  const config = useAd(qk.adConfig, (b) => b.adminConfig());
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (config.data) {
      const next: Record<string, string> = {};
      for (const entry of config.data) next[entry.key] = entry.value;
      setValues(next);
    }
  }, [config.data]);

  const save = useAdMutation((b, entries: Record<string, string>) => b.adminUpdateConfig(entries), {
    success: "Configuration saved — applies on next request",
    invalidate: [qk.adConfig, qk.adOverview],
  });

  if (config.isLoading) return <LoadingCard label="Loading configuration…" />;
  if (config.isError)
    return (
      <LoadError message={(config.error as Error)?.message} retry={() => void config.refetch()} />
    );

  const items = config.data ?? [];
  const dirty = items.some((e) => (values[e.key] ?? "") !== e.value);

  return (
    <div>
      <SectionHead
        title="Configuration"
        subtitle="Platform-wide settings — take effect immediately after saving."
        action={
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(values)}>
            {save.isPending ? "Saving…" : "Save configuration"}
          </Button>
        }
      />
      <Panel title="Settings">
        {items.length === 0 ? (
          <EmptyState title="No configuration" body="Config entries seed on first boot." />
        ) : (
          <div className="space-y-3">
            {items.map((entry) => (
              <div
                key={entry.key}
                className="grid items-center gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_240px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium">{entry.key}</p>
                  <p className="truncate text-xs text-muted-foreground">{entry.notes}</p>
                </div>
                <Input
                  value={values[entry.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [entry.key]: e.target.value }))}
                  aria-label={entry.key}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, SimpleTable, StatCard } from "@/components/kit";
import { qk, useAd } from "@/lib/queries";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const analytics = useAd(qk.adAnalytics, (b) => b.adminAnalytics());

  if (analytics.isLoading) return <LoadingCard label="Loading analytics…" />;
  if (analytics.isError)
    return (
      <LoadError
        message={(analytics.error as Error)?.message}
        retry={() => void analytics.refetch()}
      />
    );

  const data = analytics.data!;
  const totalChats = data.byCategory.reduce((acc, c) => acc + c.chats, 0);
  const top = [...data.byCategory].sort((a, b) => b.chats - a.chats)[0];

  return (
    <div>
      <SectionHead title="Analytics" subtitle="Supply and demand balance across the marketplace." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} />
        ))}
        <StatCard
          label="Top category"
          value={top?.name ?? "—"}
          hint={`${(top?.chats ?? 0).toLocaleString()} chats`}
        />
      </div>
      <div className="mt-6">
        <Panel title="Demand vs supply by category">
          {data.byCategory.length === 0 ? (
            <EmptyState title="No data" body="Category analytics populate as traffic arrives." />
          ) : (
            <SimpleTable
              columns={["Category", "Listings", "Chats", "Chats / listing"]}
              rows={[...data.byCategory]
                .sort((a, b) => b.chats - a.chats)
                .map((c) => [
                  c.name,
                  String(c.listings),
                  c.chats.toLocaleString(),
                  c.listings ? (c.chats / c.listings).toFixed(1) : "—",
                ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

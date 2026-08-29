import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { qk, useWs } from "@/lib/queries";

export const Route = createFileRoute("/app/calendar")({
  component: WorkspaceCalendar,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WorkspaceCalendar() {
  const tasks = useWs(qk.wsTasks, (b) => b.workspaceTasks());
  const [monthOffset, setMonthOffset] = useState(0);

  const grid = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const startDow = first.getDay();
    const cells: (number | null)[] = Array.from({ length: startDow }, () => null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return { cells, label: first.toLocaleDateString("en-NG", { month: "long", year: "numeric" }) };
  }, [monthOffset]);

  if (tasks.isLoading) return <LoadingCard label="Loading calendar…" />;
  if (tasks.isError)
    return (
      <LoadError message={(tasks.error as Error)?.message} retry={() => void tasks.refetch()} />
    );

  const items = tasks.data ?? [];
  const byDay = new Map<number, typeof items>();
  const now = new Date();
  for (const t of items) {
    const dayMatch = /\d{1,2}/.exec(t.due);
    if (/today/i.test(t.due)) {
      const list = byDay.get(now.getDate()) ?? [];
      list.push(t);
      byDay.set(now.getDate(), list);
    } else if (/tomorrow/i.test(t.due)) {
      const list = byDay.get(now.getDate() + 1) ?? [];
      list.push(t);
      byDay.set(now.getDate() + 1, list);
    } else if (dayMatch && !/fri|mon|tue|wed|sat|sun/i.test(t.due.replace(dayMatch[0], ""))) {
      const d = Number(dayMatch[0]);
      if (d >= 1 && d <= 31) {
        const list = byDay.get(d) ?? [];
        list.push(t);
        byDay.set(d, list);
      }
    }
  }

  return (
    <div>
      <SectionHead
        title="Calendar"
        subtitle="Follow-ups and deadlines from your task list."
        action={
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => setMonthOffset((m) => m - 1)}
            >
              ←
            </button>
            <span className="text-sm font-medium">{grid.label}</span>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() => setMonthOffset((m) => m + 1)}
            >
              →
            </button>
          </div>
        }
      />
      <Card className="card-surface">
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.cells.map((day, i) => {
              const dayTasks = day ? (byDay.get(day) ?? []) : [];
              const isToday = day === now.getDate() && monthOffset === 0;
              return (
                <div
                  key={i}
                  className={`min-h-20 rounded-lg border p-1 text-left text-xs ${
                    isToday ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  {day ? <p className="px-1 pt-0.5 text-muted-foreground">{day}</p> : null}
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <p
                        key={t.id}
                        className={`truncate rounded px-1 py-0.5 ${
                          t.done
                            ? "bg-muted text-muted-foreground line-through"
                            : "bg-primary/10 text-primary"
                        }`}
                        title={t.title}
                      >
                        {t.title}
                      </p>
                    ))}
                    {dayTasks.length > 3 ? (
                      <p className="px-1 text-[10px] text-muted-foreground">
                        +{dayTasks.length - 3} more
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {items.length === 0 ? (
        <EmptyState title="No scheduled work" body="Tasks with due dates show up here." />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {items
            .filter((t) => !t.done)
            .map((t) => (
              <Badge key={t.id} variant="outline">
                {t.title} • {t.due}
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}

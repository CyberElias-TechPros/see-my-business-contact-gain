import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { qk, useWs, useWsMutation } from "@/lib/queries";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/app/tasks")({
  component: WorkspaceTasks,
});

function WorkspaceTasks() {
  const tasks = useWs(qk.wsTasks, (b) => b.workspaceTasks());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("Today");
  const [priority, setPriority] = useState<Task["priority"]>("Medium");

  const add = useWsMutation((b, data: Partial<Task>) => b.addTask(data), {
    success: "Task created",
    invalidate: [qk.wsTasks],
  });
  const toggle = useWsMutation(
    (b, vars: { id: string; done: boolean }) => b.updateTask(vars.id, { done: vars.done }),
    {
      invalidate: [qk.wsTasks],
    },
  );

  if (tasks.isLoading) return <LoadingCard label="Loading tasks…" />;
  if (tasks.isError)
    return (
      <LoadError message={(tasks.error as Error)?.message} retry={() => void tasks.refetch()} />
    );

  const items = tasks.data ?? [];
  const dueToday = items.filter((t) => !t.done && /today/i.test(t.due)).length;
  const completed = items.filter((t) => t.done).length;

  return (
    <div>
      <SectionHead
        title="Tasks"
        subtitle="Follow-ups created by you and by automation rules."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New task</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="task-title">Task</Label>
                  <Input
                    id="task-title"
                    className="mt-2"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="task-due">Due</Label>
                    <Input
                      id="task-due"
                      className="mt-2"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={priority}
                      onValueChange={(v) => setPriority(v as Task["priority"])}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["High", "Medium", "Low"].map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || title.trim().length < 3}
                  onClick={() =>
                    add.mutate(
                      { title, due, priority },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setTitle("");
                        },
                      },
                    )
                  }
                >
                  Create task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Due today" value={String(dueToday)} hint="tasks" />
        <StatCard label="Open" value={String(items.length - completed)} hint="total" />
        <StatCard label="Completed" value={String(completed)} hint="all time" />
        <StatCard
          label="High priority"
          value={String(items.filter((t) => t.priority === "High" && !t.done).length)}
          hint="needs attention"
        />
      </div>
      <div className="mt-6">
        <Panel title="Task list">
          {items.length === 0 ? (
            <EmptyState title="No tasks yet" body="Create follow-ups so no lead goes cold." />
          ) : (
            <div className="space-y-2">
              {items.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={t.done}
                    onCheckedChange={(v) => toggle.mutate({ id: t.id, done: v === true })}
                  />
                  <span className={`flex-1 ${t.done ? "text-muted-foreground line-through" : ""}`}>
                    {t.title}
                  </span>
                  <Badge
                    variant={
                      t.priority === "High"
                        ? "destructive"
                        : t.priority === "Medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {t.priority}
                  </Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{t.due}</span>
                  <span className="hidden text-xs text-muted-foreground md:inline">{t.owner}</span>
                  <TimeAgo minutes={t.ts} />
                </label>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

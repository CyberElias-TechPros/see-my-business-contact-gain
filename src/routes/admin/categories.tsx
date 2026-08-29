import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Store,
  Wrench,
  Stethoscope,
  GraduationCap,
  Scissors,
  Dumbbell,
  Car,
  Home,
  Plane,
  Camera,
  Shirt,
  PawPrint,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

const ICONS: Record<string, LucideIcon> = {
  Store,
  Wrench,
  Stethoscope,
  GraduationCap,
  Scissors,
  Dumbbell,
  Car,
  Home,
  Plane,
  Camera,
  Shirt,
  PawPrint,
  Sparkles,
};

function AdminCategories() {
  const categories = useAd(qk.adCategories, (b) => b.adminCategories());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Store");

  const add = useAdMutation(
    (b, data: { name: string; icon?: string }) => b.adminAddCategory(data),
    {
      success: "Category added",
      invalidate: [qk.adCategories, qk.adOverview],
    },
  );

  if (categories.isLoading) return <LoadingCard label="Loading categories…" />;
  if (categories.isError)
    return (
      <LoadError
        message={(categories.error as Error)?.message}
        retry={() => void categories.refetch()}
      />
    );

  const items = categories.data ?? [];

  return (
    <div>
      <SectionHead
        title="Categories"
        subtitle="The taxonomy that powers search, filters and landing pages."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add category</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New category</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cat-name">Display name</Label>
                  <Input
                    id="cat-name"
                    className="mt-2"
                    placeholder="Catering"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Icon</Label>
                  <Select value={icon} onValueChange={setIcon}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(ICONS).map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || name.trim().length < 3}
                  onClick={() =>
                    add.mutate(
                      { name, icon },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setName("");
                        },
                      },
                    )
                  }
                >
                  Add category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Categories" value={String(items.length)} hint="top level" />
        <StatCard
          label="With listings"
          value={String(items.filter((c) => c.count > 0).length)}
          hint="active"
        />
        <StatCard
          label="Empty"
          value={String(items.filter((c) => c.count === 0).length)}
          hint="need supply"
        />
        <StatCard
          label="Largest"
          value={[...items].sort((a, b) => b.count - a.count)[0]?.name ?? "—"}
          hint="by listings"
        />
      </div>
      <div className="mt-6">
        <Panel title="All categories">
          {items.length === 0 ? (
            <EmptyState
              title="No categories"
              body="Add your first category to organise listings."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => {
                const Icon = ICONS[c.icon] ?? Store;
                return (
                  <Card key={c.slug} className="card-surface">
                    <CardContent className="flex items-center gap-3 p-4">
                      <span className="grid size-10 place-items-center rounded-xl bg-secondary">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{c.slug} • {c.count} listing{c.count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

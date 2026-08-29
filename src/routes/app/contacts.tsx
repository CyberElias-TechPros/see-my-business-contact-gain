import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { qk, useWs, useWsMutation } from "@/lib/queries";
import type { Contact } from "@/lib/types";

export const Route = createFileRoute("/app/contacts")({
  component: WorkspaceContacts,
});

function WorkspaceContacts() {
  const contacts = useWs(qk.wsContacts, (b) => b.workspaceContacts());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const add = useWsMutation((b, data: Partial<Contact>) => b.addContact(data), {
    success: "Contact added",
    invalidate: [qk.wsContacts],
  });
  const remove = useWsMutation((b, id: string) => b.deleteContact(id), {
    invalidate: [qk.wsContacts],
  });

  if (contacts.isLoading) return <LoadingCard label="Loading contacts…" />;
  if (contacts.isError)
    return (
      <LoadError
        message={(contacts.error as Error)?.message}
        retry={() => void contacts.refetch()}
      />
    );

  const items = contacts.data ?? [];

  return (
    <div>
      <SectionHead
        title="Contacts"
        subtitle="Everyone who ever reached out, deduplicated and tagged."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add contact</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ct-name">Name</Label>
                  <Input
                    id="ct-name"
                    className="mt-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ct-phone">Phone</Label>
                    <Input
                      id="ct-phone"
                      className="mt-2"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ct-email">Email</Label>
                    <Input
                      id="ct-email"
                      className="mt-2"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || name.trim().length < 2}
                  onClick={() =>
                    add.mutate(
                      { name, phone, email, tags: ["Manual entry"] },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setName("");
                          setPhone("");
                          setEmail("");
                        },
                      },
                    )
                  }
                >
                  Add contact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total contacts" value={String(items.length)} hint="all time" />
        <StatCard
          label="With WhatsApp"
          value={String(items.filter((c) => c.phone).length)}
          hint="reachable"
        />
        <StatCard
          label="This week"
          value={String(items.filter((c) => c.ts < 7 * 1440).length)}
          hint="new"
        />
        <StatCard
          label="Customers"
          value={String(items.filter((c) => c.tags.includes("Customer")).length)}
          hint="tagged"
        />
      </div>
      <div className="mt-6">
        <Panel title="All contacts">
          {items.length === 0 ? (
            <EmptyState
              title="No contacts yet"
              body="Contacts are created automatically from enquiries and WhatsApp leads."
            />
          ) : (
            <div className="space-y-2">
              {items.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                  <span className="grid size-9 place-items-center rounded-full bg-secondary font-semibold">
                    {c.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.phone} {c.email ? `• ${c.email}` : ""} • via {c.source}
                    </p>
                  </div>
                  <div className="hidden gap-1 sm:flex">
                    {c.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <TimeAgo minutes={c.ts} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove.mutate(c.id)}
                    aria-label={`Delete ${c.name}`}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

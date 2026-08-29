import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Download, ListPlus, MessageCircle, NotebookPen, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { EmptyState, LoadError, LoadingCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { waLink } from "@/lib/api";
import { downloadListCsv } from "@/lib/vcard";
import {
  useCreateList,
  useDeleteList,
  useHubLists,
  useHubMembers,
  useRemoveFromList,
  useUpdateListMember,
} from "@/lib/queries";
import type { ListStatus } from "@/lib/types";

export const Route = createFileRoute("/hub")({
  head: () => ({
    meta: [
      { title: "My Contacts — GainHub NG" },
      {
        name: "description",
        content:
          "Your private contact lists: save businesses from the directory, tag them, track outreach status and export to CSV or vCard.",
      },
    ],
  }),
  component: HubPage,
});

const STATUSES: ListStatus[] = [
  "New",
  "Contacted",
  "Responded",
  "Interested",
  "Not interested",
  "Archived",
];

function HubPage() {
  const navigate = useNavigate();
  const lists = useHubLists();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ?? lists.data?.[0]?.id ?? null;
  const members = useHubMembers(active ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  const createList = useCreateList();
  const deleteList = useDeleteList();
  const updateMember = useUpdateListMember(active ?? "");
  const removeMember = useRemoveFromList(active ?? "");

  if (lists.isLoading) {
    return (
      <PublicShell>
        <PageHead eyebrow="Contact hub" title="My Contacts" />
        <LoadingCard label="Loading your lists…" />
      </PublicShell>
    );
  }

  if (lists.isError) {
    return (
      <PublicShell>
        <PageHead eyebrow="Contact hub" title="My Contacts" />
        <LoadError message={(lists.error as Error)?.message} retry={() => void lists.refetch()} />
      </PublicShell>
    );
  }

  const memberItems = members.data ?? [];
  const activeList = lists.data?.find((l) => l.id === active);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Contact hub"
        title="My Contacts"
        subtitle="Save businesses from any search, organise them into lists, track your outreach and export everything — private to your account."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <ListPlus className="size-4" /> New list
          </Button>
        }
      />

      {(lists.data?.length ?? 0) === 0 ? (
        <div className="mx-auto max-w-3xl px-4 pb-16">
          <Card className="card-surface">
            <CardContent className="space-y-4 p-8 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary">
                <Users className="size-7 text-secondary-foreground" />
              </span>
              <h2 className="text-xl font-bold">Build your first contact list</h2>
              <p className="text-sm text-muted-foreground">
                Search the directory, tick the businesses you want, then “Save to list”. Prospect
                lists, supplier lists, competitor watchlists — whatever you're building.
              </p>
              <div className="flex justify-center gap-2">
                <Button onClick={() => void navigate({ to: "/search" })}>Find businesses</Button>
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  Create an empty list
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-2">
            {lists.data!.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition-colors ${
                  l.id === active ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <span className="truncate font-medium">{l.name}</span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                  {l.businessCount}
                </span>
              </button>
            ))}
            {active ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive"
                onClick={() => {
                  if (
                    confirm(`Delete “${activeList?.name}”? The businesses stay in the directory.`)
                  ) {
                    deleteList.mutate(active, {
                      onSuccess: () => {
                        toast.success("List deleted");
                        setActiveId(null);
                      },
                    });
                  }
                }}
              >
                <Trash2 className="size-3.5" /> Delete this list
              </Button>
            ) : null}
          </aside>

          <section>
            {members.isLoading ? (
              <LoadingCard label="Loading list…" />
            ) : memberItems.length === 0 ? (
              <EmptyState
                title="This list is empty"
                body="Run a directory search and use “Save to list” to add businesses here."
                action={
                  <Button onClick={() => void navigate({ to: "/search" })}>
                    Search the directory
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {memberItems.length} contact{memberItems.length === 1 ? "" : "s"} in{" "}
                    {activeList?.name}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      downloadListCsv(activeList?.name ?? "contacts", memberItems);
                      toast.success("CSV downloaded");
                    }}
                  >
                    <Download className="size-3.5" /> Export CSV
                  </Button>
                </div>
                {memberItems.map((m) => (
                  <Card key={m.businessId} className="card-surface">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{m.business.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {m.business.categorySlug} • {m.business.city} • added{" "}
                            <TimeAgo minutes={m.ts} /> via {m.source}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild size="sm">
                            <a
                              href={waLink(m.business, "Contact hub")}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="size-3.5" /> WhatsApp
                            </a>
                          </Button>
                          <Select
                            value={m.status}
                            onValueChange={(v) =>
                              updateMember.mutate({
                                businessId: m.businessId,
                                patch: { status: v as ListStatus },
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((st) => (
                                <SelectItem key={st} value={st}>
                                  {st}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            aria-label={`Remove ${m.business.name}`}
                            onClick={() => removeMember.mutate({ businessId: m.businessId })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{m.status}</Badge>
                        {m.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                        <button
                          className="flex items-center gap-1 text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => {
                            setNoteFor(m.businessId);
                            setNoteDraft(m.note);
                            setTagDraft(m.tags.join(", "));
                          }}
                        >
                          <NotebookPen className="size-3" />
                          {m.note ? "Edit note & tags" : "Add note & tags"}
                        </button>
                      </div>
                      {m.note ? (
                        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                          {m.note}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* New list dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New contact list</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="hub-list-name">List name</Label>
            <Input
              id="hub-list-name"
              className="mt-2"
              placeholder="Lagos hotels — outreach"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={createList.isPending || newName.trim().length < 2}
              onClick={() =>
                createList.mutate(
                  {
                    name: newName,
                    onSuccess: (id) => {
                      setActiveId(id);
                      setCreateOpen(false);
                      setNewName("");
                    },
                  },
                  { onSuccess: () => toast.success("List created") },
                )
              }
            >
              Create list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note & tags dialog */}
      <Dialog open={noteFor != null} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note & tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="hub-tags">Tags (comma-separated)</Label>
              <Input
                id="hub-tags"
                className="mt-2"
                placeholder="hot, follow-up, supplier"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="hub-note">Private note</Label>
              <Textarea
                id="hub-note"
                className="mt-2"
                placeholder="Spoke to the owner — interested in a redesign quote."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Notes are private to your account and never shown on the public listing.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={updateMember.isPending}
              onClick={() => {
                updateMember.mutate(
                  {
                    businessId: noteFor ?? "",
                    patch: {
                      note: noteDraft,
                      tags: tagDraft
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Saved");
                      setNoteFor(null);
                    },
                  },
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
}

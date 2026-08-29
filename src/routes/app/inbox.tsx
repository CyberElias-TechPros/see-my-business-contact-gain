import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { qk, useWs, useWsMutation } from "@/lib/queries";
import type { Message } from "@/lib/types";

export const Route = createFileRoute("/app/inbox")({
  component: WorkspaceInbox,
});

function WorkspaceInbox() {
  const conversations = useWs(qk.wsConversations, (b) => b.workspaceConversations());
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ?? conversations.data?.[0]?.id ?? null;
  const messages = useWs(qk.wsMessages(active ?? "none"), (b) =>
    b.conversationMessages(active ?? "none"),
  );
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useWsMutation(
    (b, vars: { id: string; body: string }) => b.sendMessage(vars.id, vars.body),
    { invalidate: [qk.wsConversations, ["ws-messages"]] },
  );
  const markRead = useWsMutation((b, id: string) => b.markConversationRead(id), {
    invalidate: [qk.wsConversations],
  });

  useEffect(() => {
    if (active) markRead.mutate(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  if (conversations.isLoading) return <LoadingCard label="Loading inbox…" />;
  if (conversations.isError)
    return (
      <LoadError
        message={(conversations.error as Error)?.message}
        retry={() => void conversations.refetch()}
      />
    );

  const items = conversations.data ?? [];
  const unread = items.reduce((acc, c) => acc + c.unread, 0);

  return (
    <div>
      <SectionHead
        title="Inbox"
        subtitle="Every WhatsApp conversation, tagged and assigned automatically."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unread" value={String(unread)} hint="messages" />
        <StatCard label="Conversations" value={String(items.length)} hint="all time" />
        <StatCard
          label="Awaiting reply"
          value={String(
            items.filter((c) => c.tag === "Callback" || c.tag === "New enquiry").length,
          )}
          hint="tagged"
        />
        <StatCard
          label="Assigned to me"
          value={String(items.filter((c) => c.assigned !== "Unassigned").length)}
          hint="routed"
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="card-surface max-h-[520px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full rounded-xl p-3 text-left transition-colors ${
                  c.id === active ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <TimeAgo minutes={c.ts} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.last}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {c.tag}
                  </Badge>
                  {c.unread > 0 ? <Badge className="text-[10px]">{c.unread} new</Badge> : null}
                </div>
              </button>
            ))
          )}
        </Card>
        <Card className="card-surface flex max-h-[520px] flex-col">
          {active && messages.data ? (
            <>
              <CardContent className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.data.map((m: Message, i) => (
                  <div
                    key={i}
                    className={`flex ${m.from === "business" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        m.from === "business"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted"
                      }`}
                    >
                      {m.body}
                      <p
                        className={`mt-1 text-[10px] ${m.from === "business" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        <TimeAgo minutes={m.ts} />
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </CardContent>
              <CardContent className="border-t p-3">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    send.mutate({ id: active, body: draft }, { onSuccess: () => setDraft("") });
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a reply…"
                    aria-label="Message"
                  />
                  <Button type="submit" size="icon" aria-label="Send message">
                    <Send className="size-4" />
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <CardContent className="grid flex-1 place-items-center p-8">
              <EmptyState
                title="Select a conversation"
                body="Conversations start when customers contact you."
              />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

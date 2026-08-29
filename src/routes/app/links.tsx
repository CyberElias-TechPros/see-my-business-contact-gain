import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, SimpleTable, StatCard } from "@/components/kit";
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
import { backendMode } from "@/lib/api";
import { qk, useWs, useWsMutation } from "@/lib/queries";
import type { TrackedLink } from "@/lib/types";

export const Route = createFileRoute("/app/links")({
  component: WorkspaceLinks,
});

function linkUrl(code: string): string {
  const base =
    backendMode() === "demo"
      ? `${window.location.origin}`
      : ((import.meta.env["VITE_LINK_BASE_URL"] as string | undefined)?.replace(/\/$/, "") ??
        window.location.origin);
  return `${base}/l/${code}`;
}

function WorkspaceLinks() {
  const links = useWs(qk.wsLinks, (b) => b.workspaceLinks());
  const summary = useWs(qk.wsSummary, (b) => b.workspaceSummary());
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [source, setSource] = useState("Directory");
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const add = useWsMutation(
    (b, data: { label: string; code?: string; source?: string }) => b.addLink(data),
    {
      success: "Link created — scans are tracked automatically",
      invalidate: [qk.wsLinks, qk.wsSummary],
    },
  );
  const remove = useWsMutation((b, id: string) => b.deleteLink(id), { invalidate: [qk.wsLinks] });

  if (links.isLoading) return <LoadingCard label="Loading links…" />;
  if (links.isError)
    return (
      <LoadError message={(links.error as Error)?.message} retry={() => void links.refetch()} />
    );

  const items = links.data ?? [];
  const totalScans = items.reduce((acc, l) => acc + l.scans, 0);
  const best = [...items].sort((a, b) => b.scans - a.scans)[0];

  return (
    <div>
      <SectionHead
        title="QR codes & contact links"
        subtitle="Every tracked destination that starts a WhatsApp chat."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Generate link</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New tracked link</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="lk-label">Label</Label>
                  <Input
                    id="lk-label"
                    className="mt-2"
                    placeholder="Ikeja shop QR"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lk-code">Code (used in the URL)</Label>
                  <Input
                    id="lk-code"
                    className="mt-2"
                    placeholder="ikeja"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Directory", "QR", "Social", "Print", "Room"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || label.trim().length < 2}
                  onClick={() =>
                    add.mutate(
                      { label, code: code || undefined, source },
                      {
                        onSuccess: ({ code: created }) => {
                          setOpen(false);
                          setLabel("");
                          setCode("");
                          setPreviewCode(created);
                        },
                      },
                    )
                  }
                >
                  Create link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active links" value={String(items.length)} hint="tracked" />
        <StatCard label="Scans" value={totalScans.toLocaleString()} hint="all links" />
        <StatCard
          label="Chats started"
          value={(summary.data?.business.contactsGained ?? 0).toLocaleString()}
          hint="from this profile"
        />
        <StatCard
          label="Best performer"
          value={best?.label ?? "—"}
          hint={best ? `${best.scans.toLocaleString()} scans` : ""}
        />
      </div>

      {previewCode ? (
        <Card className="card-surface mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-6 sm:flex-row">
            <QRCodeSVG value={linkUrl(previewCode)} size={128} />
            <div className="text-sm">
              <p className="font-semibold">QR ready to print</p>
              <p className="text-muted-foreground">
                Scans of this QR open WhatsApp with your attribution attached.
              </p>
              <p className="mt-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                {linkUrl(previewCode)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6">
        <Panel title="Links & QR codes">
          {items.length === 0 ? (
            <EmptyState
              title="No tracked links yet"
              body="Generate a link or QR for your shop, flyers and social bios — every scan is attributed."
            />
          ) : (
            <div className="space-y-3">
              {items.map((l: TrackedLink) => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      /l/{l.code} • via {l.source}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{l.scans.toLocaleString()} scans</span>
                  <QRCodeSVG value={linkUrl(l.code)} size={56} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(linkUrl(l.code));
                      toast.success("Link copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  <Button asChild size="sm" variant="ghost" aria-label="Open link">
                    <a href={linkUrl(l.code)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove.mutate(l.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Links resolve on the backend at <code>/l/&lt;code&gt;</code> and redirect to WhatsApp with
        your business name and the link label pre-filled.{" "}
        <Link to="/help" className="text-primary">
          How attribution works →
        </Link>
      </p>
      <div className="mt-6">
        <Panel title="Scans by link">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <SimpleTable
              columns={["Label", "Code", "Source", "Scans"]}
              rows={[...items]
                .sort((a, b) => b.scans - a.scans)
                .map((l) => [l.label, l.code, l.source, l.scans.toLocaleString()])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

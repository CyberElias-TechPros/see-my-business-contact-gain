import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useMeta } from "@/lib/queries";
import { useSubmitForm } from "@/lib/forms";

export const Route = createFileRoute("/suggest-business")({
  head: () => ({
    meta: [
      { title: "Suggest a business or send a correction — GainHub NG" },
      {
        name: "description",
        content:
          "Know a business that should be listed, or spotted wrong details? Send a suggestion and our category team will review it.",
      },
    ],
  }),
  component: SuggestPage,
});

function SuggestPage() {
  const navigate = useNavigate();
  const { data: meta } = useMeta();
  const [type, setType] = useState("New business");
  const [categorySlug, setCategorySlug] = useState(meta?.categories[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [details, setDetails] = useState("");

  const submit = useSubmitForm("suggestion", (backend, data) => backend.postSuggestion(data), {
    success: "Suggestion received — our category team reviews new entries weekly.",
    onDone: () => void navigate({ to: "/" }),
  });

  return (
    <PublicShell>
      <PageHead
        eyebrow="Contribute"
        title="Suggest a business or correction"
        subtitle="Contributors help build the directory. Suggestions do not give you control of the listing."
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <Label>Suggestion type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New business">New business</SelectItem>
                  <SelectItem value="Correction to a listing">Correction to a listing</SelectItem>
                  <SelectItem value="Business permanently closed">
                    Business permanently closed
                  </SelectItem>
                  <SelectItem value="Duplicate listing">Duplicate listing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categorySlug || undefined} onValueChange={setCategorySlug}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {(meta?.categories ?? []).map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sg-name">Business name</Label>
              <Input
                id="sg-name"
                required
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sg-contact">Phone or WhatsApp</Label>
              <Input
                id="sg-contact"
                className="mt-2"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="sg-address">Address / area</Label>
              <Input
                id="sg-address"
                className="mt-2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="sg-details">Details</Label>
              <Textarea
                id="sg-details"
                className="mt-2"
                placeholder="What should we add or change?"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
            <Button
              className="sm:col-span-2"
              disabled={submit.isPending || name.trim().length < 2}
              onClick={() =>
                submit.mutate({
                  type,
                  categorySlug,
                  name,
                  contact,
                  address,
                  details,
                })
              }
            >
              {submit.isPending ? "Sending…" : "Send suggestion"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

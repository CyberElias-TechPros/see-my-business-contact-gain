import { createFileRoute } from "@tanstack/react-router";
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
import { categories } from "@/data/mock";

export const Route = createFileRoute("/suggest-business")({
  head: () => ({
    meta: [
      { title: "Suggest a business or send a correction — GainHub NG" },
      {
        name: "description",
        content:
          "Know a business that should be listed, or spotted wrong details? Send a suggestion and our category team will review it.",
      },
      { property: "og:title", content: "Suggest a business — GainHub NG" },
      {
        property: "og:description",
        content: "Help keep Nigeria's business directory accurate and complete.",
      },
    ],
  }),
  component: SuggestPage,
});

function SuggestPage() {
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
              <Select defaultValue="new">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New business</SelectItem>
                  <SelectItem value="correction">Correction to a listing</SelectItem>
                  <SelectItem value="closed">Business permanently closed</SelectItem>
                  <SelectItem value="duplicate">Duplicate listing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select defaultValue={categories[0]!.slug}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business name</Label>
              <Input className="mt-2" />
            </div>
            <div>
              <Label>Phone or WhatsApp</Label>
              <Input className="mt-2" />
            </div>
            <div className="sm:col-span-2">
              <Label>Address / area</Label>
              <Input className="mt-2" />
            </div>
            <div className="sm:col-span-2">
              <Label>Details</Label>
              <Textarea className="mt-2" placeholder="What should we add or change?" />
            </div>
            <Button className="sm:col-span-2">Send suggestion</Button>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

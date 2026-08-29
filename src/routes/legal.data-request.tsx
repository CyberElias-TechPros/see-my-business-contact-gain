import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useSubmitForm } from "@/lib/forms";

export const Route = createFileRoute("/legal/data-request")({
  head: () => ({
    meta: [
      { title: "Data access & delete requests — GainHub NG" },
      {
        name: "description",
        content:
          "Request an export of your data or ask us to delete your account, as provided under the NDPR.",
      },
      { property: "og:title", content: "Data access & delete requests — GainHub NG" },
      {
        property: "og:description",
        content:
          "Request an export of your data or ask us to delete your account, as provided under the NDPR.",
      },
    ],
  }),
  component: Page5590,
});

function Page5590() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal"
        title="Data access & delete requests"
        subtitle="Request an export of your data or ask us to delete your account, as provided under the NDPR."
      />
      <DataRequestForm />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Export</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Profile and account data</li>
                <li>Saved businesses and enquiry history</li>
                <li>Reviews you have written</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Deletion</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Account and login removed</li>
                <li>Personal data erased or anonymised</li>
                <li>Some records kept where the law requires</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}

function DataRequestForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("Export my data");
  const [details, setDetails] = useState("");
  const submit = useSubmitForm("data-request", (backend, data) => backend.postDataRequest(data), {
    success: "Request logged — we respond to NDPR requests within 30 days.",
    onDone: () => void navigate({ to: "/" }),
  });
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12">
      <Card className="card-surface">
        <CardContent className="grid gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Submit a request</h2>
            <p className="text-sm text-muted-foreground">
              We verify ownership before actioning any request.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dr-name">Full name</Label>
              <Input
                id="dr-name"
                required
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dr-email">Account email</Label>
              <Input
                id="dr-email"
                type="email"
                required
                className="mt-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Request type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Export my data">Export my data</SelectItem>
                <SelectItem value="Delete my account">Delete my account</SelectItem>
                <SelectItem value="Correct my data">Correct my data</SelectItem>
                <SelectItem value="Object to processing">Object to processing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dr-details">Details</Label>
            <Textarea
              id="dr-details"
              className="mt-2"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <Button
            disabled={submit.isPending || !name || !email}
            onClick={() => submit.mutate({ name, email, requestType, details })}
          >
            {submit.isPending ? "Sending…" : "Submit request"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

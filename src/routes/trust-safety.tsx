import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Eye, FileLock2, Flag, ShieldCheck } from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/trust-safety")({
  head: () => ({
    meta: [
      { title: "Trust and safety — GainHub NG" },
      {
        name: "description",
        content:
          "Understand GainHub NG verification labels, moderation boundaries, private evidence handling and the route for reporting fraud, impersonation or inaccurate listings.",
      },
      { property: "og:title", content: "Trust and safety — GainHub NG" },
      {
        property: "og:description",
        content: "What is checked, what is not guaranteed and how to report a concern privately.",
      },
    ],
  }),
  component: TrustSafetyPage,
});

const labels = [
  {
    label: "Unverified",
    meaning: "No higher verification level is currently recorded for this profile.",
    not: "It does not automatically mean the business is unsafe or illegitimate.",
  },
  {
    label: "Contact verified",
    meaning: "A contact-channel check has been recorded for the business.",
    not: "It does not verify every service, staff member, licence, price or future response.",
  },
  {
    label: "Identity verified",
    meaning:
      "Identity or ownership evidence has been reviewed for the relevant account or listing.",
    not: "It is not a guarantee of workmanship, solvency or a successful transaction.",
  },
  {
    label: "Premium verified",
    meaning:
      "An enhanced verification state is recorded under the operator's documented review process.",
    not: "The current product does not sell this label or let an applicant assign it to themselves.",
  },
];

function TrustSafetyPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Trust & safety"
        title="Trust labels should shrink uncertainty—not hide it."
        subtitle="See exactly what a label means, make your own checks and use a private route when something looks wrong."
        action={
          <Button asChild variant="secondary">
            <Link to="/report">
              <Flag aria-hidden="true" /> Report a concern
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        <section aria-labelledby="labels-heading">
          <p className="eyebrow">Read the badge</p>
          <h2 id="labels-heading" className="mt-3 text-3xl font-bold">
            Four states, each with a boundary
          </h2>
          <div className="mt-7 overflow-hidden rounded-2xl border bg-card">
            {labels.map((item, index) => (
              <div
                key={item.label}
                className={`grid gap-3 p-5 md:grid-cols-[0.45fr_1fr_1fr] md:gap-6 ${index ? "border-t" : ""}`}
              >
                <p className="font-semibold text-foreground">{item.label}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-primary">What it says: </span>
                  {item.meaning}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-foreground">What it does not say: </span>
                  {item.not}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="controls-heading">
          <p className="eyebrow">Controls in the product</p>
          <h2 id="controls-heading" className="mt-3 text-3xl font-bold">
            Safety is a set of routes, not a shield icon.
          </h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {[
              {
                icon: Eye,
                title: "Reviewed publication",
                text: "Listing applications begin in a review state. Submission alone does not put a profile into live search.",
              },
              {
                icon: FileLock2,
                title: "Private claim evidence",
                text: "Ownership evidence accepts bounded PDF or image files, requires an account and is stored away from public profile delivery.",
              },
              {
                icon: Flag,
                title: "Structured reports",
                text: "Scam, impersonation, abuse, closure and accuracy concerns enter a moderation queue with a request reference.",
              },
              {
                icon: ShieldCheck,
                title: "Restricted decisions",
                text: "Private workspaces check real sessions; aggregate moderation data is limited to the platform-admin role.",
              },
            ].map((control) => (
              <Card key={control.title} className="card-surface h-full">
                <CardContent className="p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <control.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{control.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{control.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2" aria-labelledby="check-heading">
          <Card className="card-surface border-primary/20 bg-primary/[0.025]">
            <CardContent className="p-6 sm:p-7">
              <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
              <h2 id="check-heading" className="mt-4 text-xl font-semibold">
                Before you agree or pay
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Confirm you are speaking to the contact shown on the profile.</li>
                <li>Ask for scope, price, timing and refund terms in writing.</li>
                <li>Check relevant professional licences with the issuing body.</li>
                <li>Use a traceable payment method and retain receipts.</li>
                <li>Protect passwords, one-time codes and unnecessary identity documents.</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-amber-300/60 bg-amber-50/70">
            <CardContent className="p-6 text-amber-950 sm:p-7">
              <AlertTriangle className="size-6" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold">Where our role stops</h2>
              <p className="mt-3 text-sm leading-6 text-amber-900/80">
                GainHub does not hold payment, inspect every workplace, guarantee provider conduct
                or replace regulators and emergency services. A report helps us assess the platform
                record; it is not a police report or emergency response.
              </p>
            </CardContent>
          </Card>
        </section>

        <section
          className="rounded-[2rem] bg-ink p-7 text-ink-foreground sm:p-10"
          aria-labelledby="report-heading"
        >
          <div className="grid gap-7 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="eyebrow text-sidebar-primary">Private reporting</p>
              <h2 id="report-heading" className="mt-3 text-3xl font-bold">
                Give the queue facts it can act on.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-foreground/70">
                Identify the profile, review, room or member; choose the closest reason; and explain
                what happened without publishing sensitive evidence. A successful submission returns
                a reference, not an invented resolution deadline.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg">
              <Link to="/report">Open report form</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

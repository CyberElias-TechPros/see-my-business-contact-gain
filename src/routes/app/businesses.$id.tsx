import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock3,
  Eye,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, jsonBody } from "@/lib/api";

/* -------------------------------------------------------------------------- */
/* Types — mirror the Worker payloads exactly                                   */
/* -------------------------------------------------------------------------- */

type BusinessHour = { dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string };
type BusinessService = { id: string; name: string; price: string; note: string };
type Social = { label: string; handle: string };

type ManagedBusiness = {
  id: string;
  slug: string;
  name: string;
  status: string;
  tagline: string;
  about: string;
  whatsapp: string;
  phone: string;
  website: string;
  address: string;
  priceRange: string;
  amenities: string[];
  serviceAreas: string[];
  socials: Social[];
  hours: BusinessHour[];
  services: BusinessService[];
};

type Enquiry = {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  message: string;
  status: "new" | "contacted" | "qualified" | "closed" | "spam";
  created_at: string;
};

/** The request body of `PATCH /v1/workspace/businesses/:id`. */
type UpdateBusinessPayload = {
  businessId: string;
  tagline: string;
  about: string;
  whatsapp: string;
  phone: string;
  website: string;
  address: string;
  priceRange: string;
  amenities: string[];
  serviceAreas: string[];
  socials: Social[];
  hours: BusinessHour[];
  services: Array<{ name: string; price: string; note: string }>;
};

const ENQUIRY_STATUSES = ["new", "contacted", "qualified", "closed", "spam"] as const;
type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

const STATUS_STYLE: Record<EnquiryStatus, string> = {
  new: "border-primary/35 bg-primary/10 text-primary",
  contacted: "border-border bg-muted text-muted-foreground",
  qualified: "border-accent/45 bg-accent/15 text-accent-foreground",
  closed: "border-border bg-muted/60 text-muted-foreground",
  spam: "border-destructive/35 bg-destructive/10 text-destructive",
};

/** Monday-first, matching how Nigerian businesses write their week. */
const DAYS: Array<{ dayOfWeek: number; label: string; short: string }> = [
  { dayOfWeek: 1, label: "Monday", short: "Mon" },
  { dayOfWeek: 2, label: "Tuesday", short: "Tue" },
  { dayOfWeek: 3, label: "Wednesday", short: "Wed" },
  { dayOfWeek: 4, label: "Thursday", short: "Thu" },
  { dayOfWeek: 5, label: "Friday", short: "Fri" },
  { dayOfWeek: 6, label: "Saturday", short: "Sat" },
  { dayOfWeek: 0, label: "Sunday", short: "Sun" },
];

const PRICE_RANGES = ["", "₦", "₦₦", "₦₦₦"] as const;

/* -------------------------------------------------------------------------- */
/* Shared section chrome                                                       */
/* -------------------------------------------------------------------------- */

function SectionCard({
  title,
  description,
  icon,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/70">
      <div className="flex items-start gap-4 border-b border-border/60 bg-muted/30 p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <CardContent className="p-6">{children}</CardContent>
      {footer ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 bg-muted/20 px-6 py-4">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

function SaveBar({
  dirty,
  saving,
  error,
  saved,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  error: string;
  saved: boolean;
  onReset: () => void;
}) {
  return (
    <>
      <Button type="submit" disabled={saving || !dirty}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        {saving ? "Saving…" : "Save changes"}
      </Button>
      {dirty ? (
        <Button type="button" variant="ghost" onClick={onReset} disabled={saving}>
          <RotateCcw /> Discard
        </Button>
      ) : null}
      <span className="ml-auto flex items-center gap-2 text-xs" aria-live="polite">
        {saved && !dirty ? (
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <Check className="size-3.5" /> Saved
          </span>
        ) : null}
        {error ? (
          <span className="flex items-center gap-1.5 font-semibold text-destructive" role="alert">
            <AlertTriangle className="size-3.5" /> {error}
          </span>
        ) : null}
      </span>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip list (amenities / service areas)                                       */
/* -------------------------------------------------------------------------- */

function ChipList({
  label,
  hint,
  items,
  onChange,
  max = 24,
}: {
  label: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [value, setValue] = useState("");

  function add() {
    const next = value.trim();
    if (!next) return;
    if (items.length >= max) return;
    if (items.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setValue("");
      return;
    }
    onChange([...items, next]);
    setValue("");
  }

  return (
    <div>
      <Label htmlFor={`chip-${label.replace(/\s+/g, "-").toLowerCase()}`}>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input
          id={`chip-${label.replace(/\s+/g, "-").toLowerCase()}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={hint}
          maxLength={80}
          className="h-11 flex-1 basis-56"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!value.trim()}>
          <Plus /> Add
        </Button>
      </div>

      {items.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background py-1 pl-3 pr-1.5 text-sm">
                {item}
                <button
                  type="button"
                  onClick={() => onChange(items.filter((entry) => entry !== item))}
                  className="grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${item}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing added yet.</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hours editor                                                                */
/* -------------------------------------------------------------------------- */

function HoursEditor({
  initial,
  onSave,
  saving,
}: {
  initial: BusinessHour[];
  onSave: (hours: BusinessHour[]) => void;
  saving: boolean;
}) {
  // Seed every day so the owner always sees a full week, even if the stored
  // profile only publishes a few days.
  const seed = DAYS.map((day) => {
    const existing = initial.find((entry) => entry.dayOfWeek === day.dayOfWeek);
    return (
      existing ?? {
        dayOfWeek: day.dayOfWeek,
        isClosed: true,
        opensAt: "09:00",
        closesAt: "18:00",
      }
    );
  });

  const [rows, setRows] = useState<BusinessHour[]>(seed);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(rows) !== JSON.stringify(seed);

  function update(dayOfWeek: number, patch: Partial<BusinessHour>) {
    setRows((current) =>
      current.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    );
  }

  function copyWeekdays() {
    const monday = rows.find((row) => row.dayOfWeek === 1);
    if (!monday) return;
    setRows((current) =>
      current.map((row) =>
        row.dayOfWeek >= 1 && row.dayOfWeek <= 5 ? { ...monday, dayOfWeek: row.dayOfWeek } : row,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    onSave(rows);
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-2">
        {DAYS.map((day) => {
          const row = rows.find((entry) => entry.dayOfWeek === day.dayOfWeek)!;
          return (
            <div
              key={day.dayOfWeek}
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border/70 p-3 sm:grid-cols-[7rem_6.5rem_1fr_1fr] sm:gap-4 sm:px-4"
            >
              <span className="font-semibold">
                <span className="hidden sm:inline">{day.label}</span>
                <span className="sm:hidden">{day.short}</span>
              </span>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!row.isClosed}
                  onChange={(event) =>
                    update(day.dayOfWeek, {
                      isClosed: !event.currentTarget.checked,
                    })
                  }
                  className="size-4 accent-primary"
                />
                <span className="sr-only sm:not-sr-only">{row.isClosed ? "Closed" : "Open"}</span>
              </label>

              <div className="col-span-2 flex items-center gap-2 sm:col-span-2">
                <label className="flex-1">
                  <span className="sr-only">{day.label} opens at</span>
                  <Input
                    type="time"
                    value={row.opensAt}
                    disabled={row.isClosed}
                    onChange={(event) => update(day.dayOfWeek, { opensAt: event.target.value })}
                    className="h-10 tabular-nums disabled:opacity-50"
                  />
                </label>
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <label className="flex-1">
                  <span className="sr-only">{day.label} closes at</span>
                  <Input
                    type="time"
                    value={row.closesAt}
                    disabled={row.isClosed}
                    onChange={(event) => update(day.dayOfWeek, { closesAt: event.target.value })}
                    className="h-10 tabular-nums disabled:opacity-50"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        Times are Africa/Lagos. A closing time earlier than the opening time is stored as an
        overnight shift. Mark a day closed if you do not trade on it.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-5">
        <Button type="button" variant="outline" size="sm" onClick={copyWeekdays}>
          Copy Monday to weekdays
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setRows(
              DAYS.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                isClosed: false,
                opensAt: "09:00",
                closesAt: "18:00",
              })),
            )
          }
        >
          Open every day 09:00–18:00
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
        <SaveBar
          dirty={dirty}
          saving={saving}
          error={error}
          saved={false}
          onReset={() => setRows(seed)}
        />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Services editor                                                             */
/* -------------------------------------------------------------------------- */

function ServicesEditor({
  initial,
  onSave,
  saving,
}: {
  initial: BusinessService[];
  onSave: (services: Array<{ name: string; price: string; note: string }>) => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState(
    initial.length ? initial : [{ id: "new-1", name: "", price: "", note: "" }],
  );
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial.length ? initial : []);

  function update(id: string, patch: Partial<BusinessService>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = rows
      .filter((row) => row.name.trim().length >= 2)
      .map((row) => ({ name: row.name.trim(), price: row.price.trim(), note: row.note.trim() }));
    onSave(cleaned);
  }

  return (
    <form onSubmit={submit}>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="grid gap-3 rounded-2xl border border-border/70 p-4 sm:grid-cols-[1.4fr_1fr_1.4fr_auto]"
          >
            <label>
              <span className="sr-only">Service {index + 1} name</span>
              <Input
                value={row.name}
                onChange={(event) => update(row.id, { name: event.target.value })}
                placeholder="Service name"
                maxLength={120}
                className="h-10"
              />
            </label>
            <label>
              <span className="sr-only">Service {index + 1} price</span>
              <Input
                value={row.price}
                onChange={(event) => update(row.id, { price: event.target.value })}
                placeholder="From ₦ —"
                maxLength={60}
                className="h-10"
              />
            </label>
            <label>
              <span className="sr-only">Service {index + 1} note</span>
              <Input
                value={row.note}
                onChange={(event) => update(row.id, { note: event.target.value })}
                placeholder="Short note (optional)"
                maxLength={200}
                className="h-10"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setRows((current) => current.filter((entry) => entry.id !== row.id))}
              aria-label={`Remove service ${row.name || index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: `new-${Date.now()}`, name: "", price: "", note: "" },
            ])
          }
        >
          <Plus /> Add service
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <SaveBar
            dirty={dirty}
            saving={saving}
            error=""
            saved={false}
            onReset={() => setRows(initial.length ? initial : [])}
          />
        </div>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute("/app/businesses/$id")({
  component: BusinessEditor,
  notFoundComponent: () => (
    <div>
      <SectionHead title="Listing not found" />
      <Card className="rounded-3xl border-dashed border-border/70">
        <CardContent className="grid place-items-center p-12 text-center">
          <p className="text-sm text-muted-foreground">
            This listing is not on your account, or it no longer exists.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/app/businesses">
              <ArrowLeft /> Back to your listings
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  ),
});

function BusinessEditor() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const businessQuery = useQuery({
    queryKey: ["managed-business", id],
    queryFn: () => apiRequest<ManagedBusiness>(`/v1/workspace/businesses/${id}`),
    retry: false,
  });

  const enquiriesQuery = useQuery({
    queryKey: ["workspace-summary"],
    queryFn: () =>
      apiRequest<{ businesses: Array<{ id: string }>; enquiries: Enquiry[] }>(
        "/v1/workspace/summary",
      ),
    retry: false,
  });

  const [banner, setBanner] = useState("");

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateBusinessPayload) =>
      apiRequest<{ id: string; updatedAt: string }>(`/v1/workspace/businesses/${id}`, {
        method: "PATCH",
        body: jsonBody(payload),
      }),
    onSuccess: async () => {
      setBanner("Changes saved and published.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-business", id] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-insights"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-summary"] }),
      ]);
    },
  });

  const enquiries = (enquiriesQuery.data?.enquiries ?? []).filter(
    (enquiry) => enquiry.business_id === id,
  );

  const statusMutation = useMutation({
    mutationFn: ({ enquiryId, status }: { enquiryId: string; status: EnquiryStatus }) =>
      apiRequest(`/v1/workspace/enquiries/${enquiryId}`, {
        method: "PATCH",
        body: jsonBody({ status }),
      }),
    onMutate: async ({ enquiryId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["workspace-summary"] });
      const previous = queryClient.getQueryData<{
        businesses: Array<{ id: string }>;
        enquiries: Enquiry[];
      }>(["workspace-summary"]);
      queryClient.setQueryData<{
        businesses: Array<{ id: string }>;
        enquiries: Enquiry[];
      }>(["workspace-summary"], (current) =>
        current
          ? {
              ...current,
              enquiries: current.enquiries.map((enquiry) =>
                enquiry.id === enquiryId ? { ...enquiry, status } : enquiry,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Roll back so the board never shows a state the server refused.
      if (context?.previous) {
        queryClient.setQueryData(["workspace-summary"], context.previous);
      }
      setBanner("We could not update that enquiry status. Please try again.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-summary"] });
    },
  });

  if (businessQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (businessQuery.isError || !businessQuery.data) {
    const notFoundError =
      businessQuery.error instanceof Error &&
      "status" in businessQuery.error &&
      (businessQuery.error as { status?: number }).status === 404;
    if (notFoundError) throw notFound();

    return (
      <div>
        <SectionHead title="Listing unavailable" />
        <Card className="rounded-3xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-6">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">We could not load this listing.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No placeholder profile is shown in its place.
              </p>
            </div>
            <Button variant="outline" onClick={() => void businessQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/app/businesses">
            <ArrowLeft /> Back to your listings
          </Link>
        </Button>
      </div>
    );
  }

  const business = businessQuery.data;

  /** Builds the full update payload from the stored record plus one patched section. */
  function saveWith(patch: Partial<UpdateBusinessPayload>) {
    updateMutation.mutate({
      businessId: id,
      tagline: business.tagline,
      about: business.about,
      whatsapp: business.whatsapp,
      phone: business.phone,
      website: business.website,
      address: business.address,
      priceRange: business.priceRange,
      amenities: business.amenities,
      serviceAreas: business.serviceAreas,
      socials: business.socials,
      hours: business.hours,
      services: business.services.map(({ name, price, note }) => ({ name, price, note })),
      ...patch,
    });
  }

  return (
    <div>
      <SectionHead
        title={business.name}
        subtitle="Edit the details customers rely on. Each section saves on its own, so you can update one thing without touching the rest."
        action={
          <div className="flex flex-wrap gap-2.5">
            <Button asChild variant="outline">
              <a href={`/business/${business.slug}`}>
                <Eye /> View public profile
              </a>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/app/businesses">
                <ArrowLeft /> All listings
              </Link>
            </Button>
          </div>
        }
      />

      {banner ? (
        <p
          className="mb-6 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm font-medium"
          role="status"
        >
          {banner}
        </p>
      ) : null}

      {updateMutation.isError ? (
        <p
          className="mb-6 flex items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm font-medium"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : "We could not save that change."}
        </p>
      ) : null}

      <div className="space-y-6">
        {/* ---------------- Enquiries ---------------- */}
        <Reveal>
          <SectionCard
            title="Enquiries"
            description="Consented enquiries from customers who chose to contact you through GainHub."
            icon={<MessageCircle className="size-5" aria-hidden="true" />}
          >
            {enquiries.length ? (
              <ul className="space-y-3">
                {enquiries.map((enquiry) => (
                  <li key={enquiry.id} className="rounded-2xl border border-border/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{enquiry.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(enquiry.created_at).toLocaleString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Badge variant="outline" className={STATUS_STYLE[enquiry.status]}>
                        {enquiry.status}
                      </Badge>
                    </div>

                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                      {enquiry.message}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button asChild size="sm">
                        <a
                          href={`https://wa.me/${enquiry.phone.replace(/[^\d]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle /> WhatsApp
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`tel:${enquiry.phone.replace(/\s/g, "")}`}>
                          <Phone /> {enquiry.phone}
                        </a>
                      </Button>

                      <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="sr-only sm:not-sr-only">Status</span>
                        <select
                          value={enquiry.status}
                          disabled={statusMutation.isPending}
                          onChange={(event) =>
                            statusMutation.mutate({
                              enquiryId: enquiry.id,
                              status: event.target.value as EnquiryStatus,
                            })
                          }
                          className="h-9 rounded-xl border border-border/70 bg-background px-2.5 text-sm font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {ENQUIRY_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                No enquiries yet for this listing.
              </p>
            )}
          </SectionCard>
        </Reveal>

        {/* ---------------- Profile ---------------- */}
        <Reveal>
          <ProfileSection
            business={business}
            saving={updateMutation.isPending}
            onSubmit={(patch) => saveWith(patch)}
          />
        </Reveal>

        {/* ---------------- Hours ---------------- */}
        <Reveal>
          <SectionCard
            title="Opening hours"
            description="Customers see “Open now” based on these times and Africa/Lagos."
            icon={<Clock3 className="size-5" aria-hidden="true" />}
          >
            <HoursEditor
              initial={business.hours}
              saving={updateMutation.isPending}
              onSave={(hours) => saveWith({ hours })}
            />
          </SectionCard>
        </Reveal>

        {/* ---------------- Services ---------------- */}
        <Reveal>
          <SectionCard
            title="Services"
            description="List what you actually offer. Empty rows are dropped when you save."
            icon={<Plus className="size-5" aria-hidden="true" />}
          >
            <ServicesEditor
              initial={business.services}
              saving={updateMutation.isPending}
              onSave={(services) => saveWith({ services })}
            />
          </SectionCard>
        </Reveal>

        {/* ---------------- Chips ---------------- */}
        <Reveal>
          <ChipSection
            business={business}
            saving={updateMutation.isPending}
            onSubmit={(patch) => saveWith(patch)}
          />
        </Reveal>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile + chips sections (mount per business so draft state stays simple)    */
/* -------------------------------------------------------------------------- */

function ProfileSection({
  business,
  saving,
  onSubmit,
}: {
  business: ManagedBusiness;
  saving: boolean;
  onSubmit: (patch: Partial<UpdateBusinessPayload>) => void;
}) {
  const [form, setForm] = useState({
    tagline: business.tagline,
    about: business.about,
    whatsapp: business.whatsapp,
    phone: business.phone,
    website: business.website,
    address: business.address,
    priceRange: business.priceRange,
  });
  const [saved, setSaved] = useState(false);
  const dirty = Object.keys(form).some(
    (key) => form[key as keyof typeof form] !== business[key as keyof typeof business],
  );

  return (
    <SectionCard
      title="Profile details"
      description="The first things a customer reads. Keep them specific and true."
      icon={<Eye className="size-5" aria-hidden="true" />}
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          error=""
          saved={saved}
          onReset={() =>
            setForm({
              tagline: business.tagline,
              about: business.about,
              whatsapp: business.whatsapp,
              phone: business.phone,
              website: business.website,
              address: business.address,
              priceRange: business.priceRange,
            })
          }
        />
      }
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
          onSubmit(form);
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(event) => setForm({ ...form, tagline: event.target.value })}
              minLength={8}
              maxLength={160}
              required
              className="mt-2"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {form.tagline.length}/160 characters
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="about">About</Label>
            <Textarea
              id="about"
              value={form.about}
              onChange={(event) => setForm({ ...form, about: event.target.value })}
              minLength={40}
              maxLength={2000}
              required
              rows={5}
              className="mt-2"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {form.about.length}/2000 characters
            </p>
          </div>

          <div>
            <Label htmlFor="whatsapp">WhatsApp number</Label>
            <Input
              id="whatsapp"
              value={form.whatsapp}
              onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
              placeholder="+234 801 234 5678"
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="phone">Call number (optional)</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+234 801 234 5678"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              placeholder="https://"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="priceRange">Price range</Label>
            <select
              id="priceRange"
              value={form.priceRange}
              onChange={(event) => setForm({ ...form, priceRange: event.target.value })}
              className="mt-2 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PRICE_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range === "" ? "Not stated" : range}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="address">Public address or service base</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              minLength={5}
              maxLength={220}
              required
              className="mt-2"
            />
          </div>
        </div>

        <button type="submit" className="sr-only">
          Save profile details
        </button>
      </form>
    </SectionCard>
  );
}

function ChipSection({
  business,
  saving,
  onSubmit,
}: {
  business: ManagedBusiness;
  saving: boolean;
  onSubmit: (patch: Partial<UpdateBusinessPayload>) => void;
}) {
  const [amenities, setAmenities] = useState(business.amenities);
  const [serviceAreas, setServiceAreas] = useState(business.serviceAreas);
  const dirty =
    JSON.stringify(amenities) !== JSON.stringify(business.amenities) ||
    JSON.stringify(serviceAreas) !== JSON.stringify(business.serviceAreas);

  return (
    <SectionCard
      title="Amenities and service areas"
      description="Short, factual tags. These help a customer decide before they message you."
      icon={<Check className="size-5" aria-hidden="true" />}
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          error=""
          saved={false}
          onReset={() => {
            setAmenities(business.amenities);
            setServiceAreas(business.serviceAreas);
          }}
        />
      }
    >
      <form
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ amenities, serviceAreas });
        }}
      >
        <ChipList
          label="Amenities"
          hint="e.g. Parking, Wheelchair access, Card payment"
          items={amenities}
          onChange={setAmenities}
        />
        <div className="border-t border-border/60 pt-7">
          <ChipList
            label="Service areas"
            hint="e.g. Yaba, Surulere, Ikeja"
            items={serviceAreas}
            onChange={setServiceAreas}
          />
        </div>
        <button type="submit" className="sr-only">
          Save amenities and service areas
        </button>
      </form>
    </SectionCard>
  );
}

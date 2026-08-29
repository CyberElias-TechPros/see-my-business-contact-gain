import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { qk, useWs, useWsMutation } from "@/lib/queries";

export const Route = createFileRoute("/app/products")({
  component: WorkspaceProducts,
});

function WorkspaceProducts() {
  const profile = useWs(qk.wsProfile, (b) => b.workspaceProfile());
  const [kind, setKind] = useState<"services" | "products">("services");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("Popular");

  const save = useWsMutation(
    (b, vars: { services?: typeof items; products?: typeof items }) => b.updateProfile(vars),
    {
      success: "Saved",
      invalidate: [qk.wsProfile],
    },
  );

  if (profile.isLoading) return <LoadingCard label="Loading catalogue…" />;
  if (profile.isError)
    return (
      <LoadError message={(profile.error as Error)?.message} retry={() => void profile.refetch()} />
    );

  const business = profile.data!;
  const items = kind === "services" ? business.services : business.products;

  const addItem = () => {
    if (kind === "services") {
      save.mutate({ services: [...business.services, { name, price, note }] });
    } else {
      save.mutate({ products: [...business.products, { name, price, tag }] });
    }
    setName("");
    setPrice("");
    setNote("");
  };

  const removeItem = (index: number) => {
    if (kind === "services") {
      save.mutate({ services: business.services.filter((_, i) => i !== index) });
    } else {
      save.mutate({ products: business.products.filter((_, i) => i !== index) });
    }
  };

  return (
    <div>
      <SectionHead
        title="Products & services"
        subtitle="What customers can buy from you, with honest prices."
      />
      <Tabs value={kind} onValueChange={(v) => setKind(v as "services" | "products")}>
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>
        <TabsContent value={kind} className="space-y-4 pt-6">
          {items.length === 0 ? (
            <EmptyState
              title={kind === "services" ? "No services published" : "No products published"}
              body="Listings with clear prices get significantly more enquiries."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item, i) => (
                <Card key={`${item.name}-${i}`} className="card-surface">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {"note" in item ? item.note : item.tag}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold">{item.price}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeItem(i)}
                        aria-label={`Remove ${item.name}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Card className="card-surface">
            <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_140px_140px_auto]">
              <div>
                <Label htmlFor="pi-name">Name</Label>
                <Input
                  id="pi-name"
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pi-price">Price</Label>
                <Input
                  id="pi-price"
                  className="mt-2"
                  placeholder="₦15,000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              {kind === "services" ? (
                <div>
                  <Label htmlFor="pi-note">Note</Label>
                  <Input
                    id="pi-note"
                    className="mt-2"
                    placeholder="Same-day"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <Label>Tag</Label>
                  <Select value={tag} onValueChange={setTag}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Popular", "Offer", "B2B", "New"].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end">
                <Button
                  disabled={save.isPending || name.trim().length < 2 || !price}
                  onClick={addItem}
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Tip: <Badge variant="secondary">Popular</Badge> and{" "}
            <Badge variant="secondary">Offer</Badge> tags draw attention on your public profile.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

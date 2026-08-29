import { useState } from "react";
import { Bookmark, BookmarkCheck, MessageCircle, Phone, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { waLink } from "@/lib/api";
import { useMe, useSaveBusiness, useTrackEvent } from "@/lib/queries";
import type { Business } from "@/lib/types";

export function WhatsAppButton({
  business,
  source,
  size = "default",
  label = "Chat on WhatsApp",
  variant = "default",
  className,
  message,
}: {
  business: Business;
  source?: string;
  size?: "sm" | "default" | "lg";
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  /** Custom pre-filled WhatsApp message (e.g. a specific product enquiry). */
  message?: string;
}) {
  const track = useTrackEvent();
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() => {
        void track.mutateAsync({
          businessId: business.id,
          type: "contact",
          source: source ?? "Directory profile",
        });
        window.open(waLink(business, source, message), "_blank", "noopener");
      }}
    >
      <MessageCircle className="size-4" /> {label}
    </Button>
  );
}

export function CallButton({
  business,
  size = "default",
}: {
  business: Business;
  size?: "sm" | "default" | "lg";
}) {
  const track = useTrackEvent();
  return (
    <Button
      size={size}
      variant="outline"
      onClick={() => {
        void track.mutateAsync({ businessId: business.id, type: "call", source: "Profile — Call" });
        window.location.href = `tel:${business.phone.replace(/\s+/g, "")}`;
      }}
    >
      <Phone className="size-4" /> Call
    </Button>
  );
}

export function SaveButton({
  business,
  saved,
  size = "icon",
}: {
  business: Business;
  saved?: boolean;
  size?: "icon" | "sm" | "default";
}) {
  const { data: me } = useMe();
  const save = useSaveBusiness();
  const [localSaved, setLocalSaved] = useState<boolean | null>(null);
  const isSaved = localSaved ?? saved ?? false;
  return (
    <Button
      size={size}
      variant="outline"
      aria-label={isSaved ? "Remove from saved" : "Save business"}
      onClick={() => {
        if (!me) {
          toast.error("Sign in to save businesses", {
            action: { label: "Sign in", onClick: () => window.location.assign("/auth") },
          });
          return;
        }
        setLocalSaved(!isSaved);
        save.mutate({ id: business.id, save: !isSaved });
      }}
    >
      {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      {size !== "icon" ? (isSaved ? "Saved" : "Save") : null}
    </Button>
  );
}

export function ShareButton({
  business,
  size = "icon",
}: {
  business: Business;
  size?: "icon" | "sm";
}) {
  const track = useTrackEvent();
  const url = `${window.location.origin}/business/${business.id}`;
  return (
    <Button
      size={size}
      variant="outline"
      aria-label="Share profile"
      onClick={async () => {
        void track.mutateAsync({
          businessId: business.id,
          type: "share",
          source: "Profile — Share",
        });
        const shareData = {
          title: `${business.name} — GainHub NG`,
          text: `${business.tagline} — find ${business.name} on GainHub NG`,
          url,
        };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
          } else {
            await navigator.clipboard.writeText(url);
            toast.success("Profile link copied");
          }
        } catch {
          // user dismissed the share sheet — nothing to do
        }
      }}
    >
      <Share2 className="size-4" />
      {size !== "icon" ? "Share" : null}
    </Button>
  );
}

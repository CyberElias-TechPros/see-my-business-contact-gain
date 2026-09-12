import { AlertCircle, CheckCircle2 } from "lucide-react";

export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}

export function FormFeedback({
  status,
  message,
  requestId,
}: {
  status: "idle" | "submitting" | "success" | "error";
  message: string;
  requestId?: string;
}) {
  if (!message || status === "idle" || status === "submitting") return null;
  const success = status === "success";
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${
        success
          ? "border-primary/25 bg-primary/8 text-foreground"
          : "border-destructive/25 bg-destructive/8 text-foreground"
      }`}
      role={success ? "status" : "alert"}
      aria-live="polite"
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
      ) : (
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
      )}
      <div>
        <p className="font-medium">{message}</p>
        {requestId ? (
          <p className="mt-1 text-xs text-muted-foreground">Support reference: {requestId}</p>
        ) : null}
      </div>
    </div>
  );
}

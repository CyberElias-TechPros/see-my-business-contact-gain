import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getBackend, type Backend } from "@/lib/api";

type FormKey = "claim" | "suggestion" | "report" | "data-request";

type FormPayloads = {
  claim: Parameters<Backend["postClaim"]>[0];
  suggestion: Parameters<Backend["postSuggestion"]>[0];
  report: Parameters<Backend["postReport"]>[0];
  "data-request": Parameters<Backend["postDataRequest"]>[0];
};

/**
 * Shared public-form mutation: resolves the active backend, toasts success and
 * failure consistently, and supports an optional onDone redirect.
 */
export function useSubmitForm<K extends FormKey>(
  _kind: K,
  fn: (backend: Backend, data: FormPayloads[K]) => Promise<void>,
  options: { success: string; onDone?: () => void },
) {
  return useMutation({
    mutationFn: async (data: FormPayloads[K]) => fn(await getBackend(), data),
    onSuccess: () => {
      toast.success(options.success);
      options.onDone?.();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Something went wrong — please try again."),
  });
}

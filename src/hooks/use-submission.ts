import { useCallback, useState } from "react";
import { ApiClientError } from "@/lib/api";

type SubmissionState =
  | { status: "idle"; message: ""; fields: Record<string, string> }
  | { status: "submitting"; message: ""; fields: Record<string, string> }
  | { status: "success"; message: string; fields: Record<string, string> }
  | { status: "error"; message: string; fields: Record<string, string>; requestId?: string };

const idleState: SubmissionState = { status: "idle", message: "", fields: {} };

export function useSubmission() {
  const [state, setState] = useState<SubmissionState>(idleState);

  const submit = useCallback(async (operation: () => Promise<unknown>, successMessage: string) => {
    setState({ status: "submitting", message: "", fields: {} });
    try {
      await operation();
      setState({ status: "success", message: successMessage, fields: {} });
      return true;
    } catch (error) {
      if (error instanceof ApiClientError) {
        setState({
          status: "error",
          message: error.message,
          fields: error.fields,
          ...(error.requestId ? { requestId: error.requestId } : {}),
        });
      } else {
        setState({
          status: "error",
          message: "Something went wrong. Please try again.",
          fields: {},
        });
      }
      return false;
    }
  }, []);

  const reset = useCallback(() => setState(idleState), []);

  return {
    state,
    submit,
    reset,
    isSubmitting: state.status === "submitting",
    fieldError: (name: string) => state.fields[name],
  };
}

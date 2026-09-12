import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/contracts";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiRequest<{ user: SessionUser | null }>("/v1/auth/session"),
    staleTime: 60_000,
    retry: false,
  });
}

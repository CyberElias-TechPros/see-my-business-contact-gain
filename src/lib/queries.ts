import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getBackend, backendMode, type Backend } from "@/lib/api";
import type { ListStatus, SearchParams } from "@/lib/types";

/**
 * Single source of React Query hooks. Every hook resolves the active backend
 * (live Cloudflare Worker or demo store) and shares cache keys so mutations
 * invalidate exactly what changed.
 */

export const qk = {
  me: ["me"] as const,
  meta: ["meta"] as const,
  businesses: (params: SearchParams) => ["businesses", params] as const,
  business: (id: string) => ["business", id] as const,
  rooms: (params: { q?: string; state?: string }) => ["rooms", params] as const,
  room: (id: string) => ["room", id] as const,
  saved: ["saved"] as const,
  myReviews: ["my-reviews"] as const,
  myEnquiries: ["my-enquiries"] as const,
  wsSummary: ["ws-summary"] as const,
  wsLeads: ["ws-leads"] as const,
  wsTasks: ["ws-tasks"] as const,
  wsContacts: ["ws-contacts"] as const,
  wsConversations: ["ws-conversations"] as const,
  wsMessages: (id: string) => ["ws-messages", id] as const,
  wsCampaigns: ["ws-campaigns"] as const,
  wsLinks: ["ws-links"] as const,
  wsAutomations: ["ws-automations"] as const,
  wsTeam: ["ws-team"] as const,
  wsProfile: ["ws-profile"] as const,
  wsInvoices: ["ws-invoices"] as const,
  wsAudit: ["ws-audit"] as const,
  wsReviews: ["ws-reviews"] as const,
  hubLists: ["hub-lists"] as const,
  hubMembers: (id: string) => ["hub-members", id] as const,
  listings: (params?: { q?: string; category?: string; state?: string }) =>
    ["listings", params ?? {}] as const,
  myListings: ["my-listings"] as const,
  wsAnalytics: ["ws-analytics"] as const,
  adOverview: ["ad-overview"] as const,
  adUsers: (q: string) => ["ad-users", q] as const,
  adBusinesses: (q: string) => ["ad-businesses", q] as const,
  adClaims: ["ad-claims"] as const,
  adModeration: ["ad-moderation"] as const,
  adReviews: ["ad-reviews"] as const,
  adReports: ["ad-reports"] as const,
  adSuggestions: ["ad-suggestions"] as const,
  adCategories: ["ad-categories"] as const,
  adAds: ["ad-ads"] as const,
  adSubscriptions: ["ad-subscriptions"] as const,
  adSupport: ["ad-support"] as const,
  adJobs: ["ad-jobs"] as const,
  adAnalytics: ["ad-analytics"] as const,
  adFlags: ["ad-flags"] as const,
  adConfig: ["ad-config"] as const,
  adAudit: ["ad-audit"] as const,
};

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

/** Standard onError toast for mutations. */
export function useAction() {
  return useMutation;
}

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await getBackend()).me(),
    staleTime: 30_000,
  });
}

export function useMeta() {
  return useQuery({
    queryKey: qk.meta,
    queryFn: async () => (await getBackend()).meta(),
    staleTime: 5 * 60_000,
  });
}

export function useBusinesses(params: SearchParams) {
  return useQuery({
    queryKey: qk.businesses(params),
    queryFn: async () => (await getBackend()).searchBusinesses(params),
    placeholderData: (prev) => prev,
  });
}

export function useBusiness(id: string) {
  return useQuery({
    queryKey: qk.business(id),
    queryFn: async () => {
      const backend = await getBackend();
      try {
        return await backend.business(id);
      } catch (e) {
        if (e instanceof Error && "status" in e && (e as { status?: number }).status === 404) {
          throw Object.assign(e, { notFound: true });
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useBusinessesByIds(ids: string[]) {
  return useQuery({
    queryKey: ["businesses-by-ids", ids.join(",")],
    queryFn: async () => {
      const backend = await getBackend();
      const results = await Promise.allSettled(ids.map((id) => backend.business(id)));
      return results
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof backend.business>>> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value.business);
    },
    enabled: ids.length > 0,
  });
}

export function useRooms(params: { q?: string; state?: string }) {
  return useQuery({
    queryKey: qk.rooms(params),
    queryFn: async () => (await getBackend()).rooms(params),
    placeholderData: (prev) => prev,
  });
}

export function useRoom(id: string) {
  return useQuery({
    queryKey: qk.room(id),
    queryFn: async () => {
      const backend = await getBackend();
      try {
        return await backend.room(id);
      } catch (e) {
        if (e instanceof Error && "status" in e && (e as { status?: number }).status === 404) {
          throw Object.assign(e, { notFound: true });
        }
        throw e;
      }
    },
    retry: false,
  });
}

export function useSaved() {
  return useQuery({
    queryKey: qk.saved,
    queryFn: async () => (await getBackend()).saved(),
    retry: false,
  });
}

export function useMyReviews() {
  return useQuery({
    queryKey: qk.myReviews,
    queryFn: async () => (await getBackend()).myReviews(),
    retry: false,
  });
}

export function useMyEnquiries() {
  return useQuery({
    queryKey: qk.myEnquiries,
    queryFn: async () => (await getBackend()).myEnquiries(),
    retry: false,
  });
}

// ------------------------------------------------------------- mutations

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) =>
      (await getBackend()).signIn(email, password),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; phone?: string }) =>
      (await getBackend()).signUp(data),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await getBackend()).signOut(),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name?: string;
      whatsapp?: string;
      prefs?: Record<string, unknown>;
    }) => (await getBackend()).updateMe(data),
    onSuccess: () => {
      toast.success("Settings saved");
      return qc.invalidateQueries({ queryKey: qk.me });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useSaveBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, save }: { id: string; save: boolean }) => {
      const backend = await getBackend();
      return save ? backend.saveBusiness(id) : backend.unsaveBusiness(id);
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.save ? "Saved to your account" : "Removed from saved");
      void qc.invalidateQueries({ queryKey: qk.saved });
      void qc.invalidateQueries({ queryKey: qk.business(vars.id) });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function usePostReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { author: string; rating: number; body: string }) =>
      (await getBackend()).postReview(id, data),
    onSuccess: () => {
      toast.success("Review published — thank you!");
      void qc.invalidateQueries({ queryKey: qk.business(id) });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function usePostEnquiry(id: string) {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      whatsapp: string;
      message?: string;
      service?: string;
    }) => (await getBackend()).postEnquiry(id, data),
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useTrackEvent() {
  return useMutation({
    mutationFn: async (data: {
      businessId: string;
      type: "contact" | "call" | "save" | "share";
      source?: string;
    }) => (await getBackend()).trackEvent(data.businessId, data.type, data.source),
  });
}

export function useJoinRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await getBackend()).joinRoom(id),
    onSuccess: () => {
      toast.success("You're in — remember the house rules!");
      void qc.invalidateQueries({ queryKey: ["room"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useCreateRoom() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      purpose?: string;
      rule?: string;
      slots?: number;
      state?: string;
      verifiedOnly?: boolean;
    }) => (await getBackend()).createRoom(data),
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useReportRoom() {
  return useMutation({
    mutationFn: async ({ id, details }: { id: string; details: string }) =>
      (await getBackend()).reportRoom(id, details),
    onSuccess: () => toast.success("Report received — our moderators will take a look."),
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useSubmit<T>(fn: (data: T) => Promise<void>, success: string) {
  return useMutation({
    mutationFn: fn,
    onSuccess: () => toast.success(success),
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      tagline?: string;
      about?: string;
      categorySlug: string;
      city?: string;
      state?: string;
      address?: string;
      whatsapp: string;
      phone?: string;
      website?: string;
    }) => (await getBackend()).createBusiness(data),
    onSuccess: () => {
      toast.success("Your business is live!");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

// ------------------------------------------------------------- workspace

/** Shared invalidation helper for workspace mutations. */
function useWsInvalidate() {
  const qc = useQueryClient();
  return (keys: readonly unknown[][]) =>
    Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

const WS_ALL: readonly (readonly unknown[])[] = [
  qk.wsSummary,
  qk.wsLeads,
  qk.wsTasks,
  qk.wsContacts,
  qk.wsConversations,
  qk.wsCampaigns,
  qk.wsLinks,
  qk.wsAutomations,
  qk.wsTeam,
  qk.wsProfile,
  qk.wsInvoices,
  qk.wsAudit,
  qk.wsAnalytics,
];

// ------------------------------------------------------------- contact hub
export function useHubLists() {
  return useQuery({
    queryKey: qk.hubLists,
    queryFn: async () => (await getBackend()).lists(),
    retry: false,
  });
}

export function useHubMembers(id: string) {
  return useQuery({
    queryKey: qk.hubMembers(id),
    queryFn: async () => (await getBackend()).listMembers(id),
    enabled: Boolean(id),
  });
}

function useHubMutation<TVars, TData = void>(
  fn: (b: Awaited<ReturnType<typeof getBackend>>, vars: TVars) => Promise<TData>,
  invalidate: readonly (readonly unknown[])[] = [qk.hubLists],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => fn(await getBackend(), vars),
    onSuccess: async () => {
      for (const key of invalidate) await qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useCreateList() {
  return useHubMutation((b, vars: { name: string; onSuccess?: (id: string) => void }) =>
    b.createList(vars.name).then((r) => {
      vars.onSuccess?.(r.id);
      return r;
    }),
  );
}

export function useDeleteList() {
  return useHubMutation((b, id: string) => b.deleteList(id));
}

export function useAddToList(listId: string) {
  return useHubMutation(
    (b, vars: { businessIds: string[]; source?: string }) =>
      b.addToList(listId, vars.businessIds, vars.source),
    [qk.hubLists, qk.hubMembers(listId)],
  );
}

export function useUpdateListMember(listId: string) {
  return useHubMutation(
    (
      b,
      vars: { businessId: string; patch: { status?: ListStatus; tags?: string[]; note?: string } },
    ) => b.updateListMember(listId, vars.businessId, vars.patch),
    [qk.hubLists, qk.hubMembers(listId)],
  );
}

export function useRemoveFromList(listId: string) {
  return useHubMutation(
    (b, vars: { businessId: string }) => b.removeFromList(listId, vars.businessId),
    [qk.hubLists, qk.hubMembers(listId)],
  );
}

// ------------------------------------------------- personal listings (people)
export function useListings(params?: { q?: string; category?: string; state?: string }) {
  return useQuery({
    queryKey: qk.listings(params),
    queryFn: async () => (await getBackend()).listings(params),
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: qk.myListings,
    queryFn: async () => (await getBackend()).myListings(),
    retry: false,
  });
}

function useListingMutation<TVars>(
  fn: (b: Awaited<ReturnType<typeof getBackend>>, vars: TVars) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => fn(await getBackend(), vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["listings"] });
      void qc.invalidateQueries({ queryKey: qk.myListings });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useCreateListing() {
  return useListingMutation((b, vars: Parameters<Backend["createListing"]>[0]) =>
    b.createListing(vars),
  );
}

export function useDeleteListing() {
  return useListingMutation((b, id: string) => b.deleteListing(id));
}

export function useTrackListingAdd() {
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => (await getBackend()).trackListingAdd(id),
  });
}

// --------------------------------------------------------- owner review replies
export function useWorkspaceReviews() {
  return useQuery({
    queryKey: qk.wsReviews,
    queryFn: async () => (await getBackend()).workspaceReviews(),
    retry: false,
  });
}

export function useReplyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; reply: string }) => {
      const backend = await getBackend();
      return backend.replyToReview(vars.id, vars.reply);
    },
    onSuccess: () => {
      toast.success("Reply published — it now shows under the review");
      void qc.invalidateQueries({ queryKey: qk.wsReviews });
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function useWs<T>(
  key: readonly unknown[],
  fn: (b: Awaited<ReturnType<typeof getBackend>>) => Promise<T>,
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => fn(await getBackend()),
    retry: (count, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return count < 2;
    },
  });
}

export function useWsMutation<TVars, TData = void>(
  fn: (b: Awaited<ReturnType<typeof getBackend>>, vars: TVars) => Promise<TData>,
  options?: { success?: string; invalidate?: readonly (readonly unknown[])[] },
) {
  const invalidate = useWsInvalidate() as (
    keys: readonly (readonly unknown[])[],
  ) => Promise<unknown>;
  return useMutation({
    mutationFn: async (vars: TVars) => fn(await getBackend(), vars),
    onSuccess: async () => {
      if (options?.success) toast.success(options.success);
      await invalidate(options?.invalidate ?? WS_ALL);
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

// ----------------------------------------------------------------- admin

export function useAd<T>(
  key: readonly unknown[],
  fn: (b: Awaited<ReturnType<typeof getBackend>>) => Promise<T>,
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => fn(await getBackend()),
    retry: (count, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return count < 2;
    },
  });
}

const AD_ALL: readonly (readonly unknown[])[] = [
  qk.adOverview,
  ["ad-users"] as const,
  ["ad-businesses"] as const,
  qk.adClaims,
  qk.adModeration,
  qk.adReviews,
  qk.adReports,
  qk.adSuggestions,
  qk.adCategories,
  qk.adAds,
  qk.adSubscriptions,
  qk.adSupport,
  qk.adFlags,
  qk.adConfig,
  qk.adAudit,
];

export function useAdMutation<TVars>(
  fn: (b: Awaited<ReturnType<typeof getBackend>>, vars: TVars) => Promise<void>,
  options?: { success?: string; invalidate?: readonly (readonly unknown[])[] },
) {
  const invalidate = useWsInvalidate() as (
    keys: readonly (readonly unknown[])[],
  ) => Promise<unknown>;
  return useMutation({
    mutationFn: async (vars: TVars) => fn(await getBackend(), vars),
    onSuccess: async () => {
      if (options?.success) toast.success(options.success);
      await invalidate(options?.invalidate ?? AD_ALL);
    },
    onError: (e) => toast.error(errMessage(e)),
  });
}

export function isAuthError(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  return status === 401 || status === 403;
}

export function demoMode(): boolean {
  return backendMode() === "demo";
}

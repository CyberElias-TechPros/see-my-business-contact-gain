import { assertCsrfToken, assertRequestSafety, loadSession } from "./auth.ts";
import { Router, createFetchHandler } from "./router.ts";
import {
  changePassword,
  getSession,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  updateProfileSettings,
  verifyEmail,
} from "./routes/auth.ts";
import {
  acceptInvite,
  changePlan,
  createAutomation,
  deleteAutomation,
  createCampaign,
  createLink,
  getBilling,
  inviteTeamMember,
  linkStats,
  listAutomations,
  listCampaigns,
  listLinks,
  listTeam,
  removeTeamMember,
  setLinkActive,
  toggleAutomation,
  updateCampaign,
} from "./routes/marketing.ts";
import {
  adminAudit,
  adminConfig,
  adminDeleteFlag,
  adminFlags,
  adminJobs,
  adminListCategories,
  adminListTickets,
  adminReplyTicket,
  adminStats,
  adminToggleCategory,
  adminUpdateConfig,
  adminUpsertCategory,
  adminUpsertFlag,
  decideClaim,
  decideModeration,
  decideVerification,
  listBusinesses,
  listClaims,
  listReports,
  listUsers,
  listVerificationRequests,
  moderateBusiness,
  moderationQueue,
  resolveReport,
  setUserStatus,
} from "./routes/admin.ts";
import {
  assignLead,
  createContact,
  createLead,
  createTask,
  deleteTask,
  getEnquiry,
  getLead,
  leadStats,
  listContacts,
  listEnquiries,
  listLeads,
  listTasks,
  moveLeadStage,
  replyToEnquiry,
  setEnquiryStatus,
  toggleTask,
  updateContact,
  updateLead,
  updateTask,
} from "./routes/crm.ts";
import {
  confirmUpload,
  createCatalogItem,
  createUploadIntent,
  deleteCatalogItem,
  deleteMedia,
  updateCatalogItem,
  listCatalog,
  listMedia,
  serveMedia,
  setPrimaryMedia,
  uploadMedia,
} from "./routes/catalog.ts";
import {
  getAnalytics,
  getProfile,
  getSettings,
  getSummary,
  listAudit,
  publish,
  requestVerification,
  unpublish,
  updateProfile,
  updateSettings,
  verificationStatus,
} from "./routes/workspace.ts";
import {
  getBusiness,
  listCategories,
  listLocations,
  listReviews,
  platformActivity,
  searchBusinesses,
  similarBusinesses,
  sitemapJson,
} from "./routes/directory.ts";
import {
  createClaim,
  createEnquiry,
  createReport,
  createReview,
  deleteReview,
  myEnquiries,
  mySaves,
  replyToReview,
  saveBusiness,
  suggestBusiness,
  unsaveBusiness,
  updateReview,
} from "./routes/public-actions.ts";
import {
  actOnRoomMember,
  createRoom,
  getRoom,
  joinRoom,
  listRooms,
  myRooms,
  roomCheckin,
} from "./routes/rooms.ts";
import {
  joinWithBusiness,
  listNotifications,
  markNotificationsRead,
  unreadCount,
} from "./routes/account.ts";
import { health, sitemapXml, trackRedirect, version } from "./routes/redirects.ts";
import { handleQueue } from "./queue.ts";
import { handleCron } from "./cron.ts";
import type { AppContext, Env } from "./types.ts";
import type { QueueMessage } from "./notifications.ts";

const V1 = "/api/v1";
const router = new Router();

// ------------------------------------------------------------------ meta ----

router.get("/health", health);
router.get(`${V1}/health`, health);
router.get(`${V1}/version`, version);
router.get(`${V1}/activity`, platformActivity);
router.get(`${V1}/sitemap`, sitemapJson);
router.get(`${V1}/sitemap.xml`, sitemapXml);

// ------------------------------------------------------------------- auth ----

router.post(`${V1}/auth/register`, register);
router.post(`${V1}/auth/login`, login);
router.post(`${V1}/auth/logout`, logout);
router.get(`${V1}/auth/session`, getSession);
router.post(`${V1}/auth/password/forgot`, requestPasswordReset);
router.post(`${V1}/auth/password/reset`, resetPassword);
router.post(`${V1}/auth/password/change`, changePassword);
router.post(`${V1}/auth/email/verify`, verifyEmail);
router.patch(`${V1}/auth/profile`, updateProfileSettings);
router.post(`${V1}/auth/invites/accept`, acceptInvite);

// ---------------------------------------------------------------- public ----

router.get(`${V1}/categories`, listCategories);
router.get(`${V1}/locations`, listLocations);
router.get(`${V1}/search`, searchBusinesses);
router.get(`${V1}/businesses/:idOrSlug`, getBusiness);
router.get(`${V1}/businesses/:idOrSlug/similar`, similarBusinesses);
router.get(`${V1}/businesses/:idOrSlug/reviews`, listReviews);
router.post(`${V1}/businesses/:idOrSlug/enquiries`, createEnquiry);
router.post(`${V1}/businesses/:idOrSlug/reviews`, createReview);
router.post(`${V1}/businesses/:idOrSlug/report`, createReport);
router.post(`${V1}/businesses/:idOrSlug/claim`, createClaim);
router.post(`${V1}/businesses/:idOrSlug/save`, saveBusiness);
router.delete(`${V1}/businesses/:idOrSlug/save`, unsaveBusiness);
router.patch(`${V1}/reviews/:reviewId`, updateReview);
router.delete(`${V1}/reviews/:reviewId`, deleteReview);
router.post(`${V1}/reviews/:reviewId/reply`, replyToReview);
router.post(`${V1}/suggestions`, suggestBusiness);

router.get(`${V1}/me/saves`, mySaves);
router.get(`${V1}/me/enquiries`, myEnquiries);
router.get(`${V1}/me/notifications`, listNotifications);
router.post(`${V1}/me/notifications/read`, markNotificationsRead);
router.get(`${V1}/me/notifications/count`, unreadCount);
router.get(`${V1}/my/rooms`, myRooms);

router.get(`${V1}/rooms`, listRooms);
router.post(`${V1}/rooms`, createRoom);
router.get(`${V1}/rooms/:slug`, getRoom);
router.post(`${V1}/rooms/:slug/join`, joinRoom);
router.post(`${V1}/rooms/:slug/checkin`, roomCheckin);
router.post(`${V1}/rooms/:slug/members`, actOnRoomMember);
router.post(`${V1}/join`, joinWithBusiness);

/** Short links live at the site root: a printed QR code cannot carry /api/v1. */
router.get("/go/:code", trackRedirect);

/** Media is read at the root too: an <img> tag cannot add headers, and R2 stays private. */
router.get("/media/:mediaId", serveMedia);
router.put("/media/upload/:token", uploadMedia);

// -------------------------------------------------------------- workspace ----
// Every path carries :businessId. Authorization is resolved from the session plus
// the memberships table inside `access()` — never from a header or client hint.

const WS = `${V1}/workspaces/:businessId`;

router.get(`${WS}/summary`, getSummary);
router.get(`${WS}/profile`, getProfile);
router.patch(`${WS}/profile`, updateProfile);
router.post(`${WS}/publish`, publish);
router.post(`${WS}/unpublish`, unpublish);
router.get(`${WS}/settings`, getSettings);
router.patch(`${WS}/settings`, updateSettings);
router.get(`${WS}/analytics`, getAnalytics);
router.get(`${WS}/audit`, listAudit);
router.post(`${WS}/verification`, requestVerification);
router.get(`${WS}/verification`, verificationStatus);

for (const table of ["services", "products"] as const) {
  router.get(`${WS}/${table}`, (c: AppContext) => listCatalog(c, table));
  router.post(`${WS}/${table}`, (c: AppContext) => createCatalogItem(c, table));
  router.patch(`${WS}/${table}/:itemId`, (c: AppContext) => updateCatalogItem(c, table));
  router.delete(`${WS}/${table}/:itemId`, (c: AppContext) => deleteCatalogItem(c, table));
}

router.get(`${WS}/media`, listMedia);
router.post(`${WS}/media/upload-intent`, createUploadIntent);
router.post(`${WS}/media/confirm`, confirmUpload);
router.post(`${WS}/media/:mediaId/primary`, setPrimaryMedia);
router.delete(`${WS}/media/:mediaId`, deleteMedia);

router.get(`${WS}/leads`, listLeads);
router.post(`${WS}/leads`, createLead);
router.get(`${WS}/leads/stats`, leadStats);
router.get(`${WS}/leads/:leadId`, getLead);
router.patch(`${WS}/leads/:leadId`, updateLead);
router.post(`${WS}/leads/:leadId/stage`, moveLeadStage);
router.post(`${WS}/leads/:leadId/assign`, assignLead);

router.get(`${WS}/contacts`, listContacts);
router.post(`${WS}/contacts`, createContact);
router.patch(`${WS}/contacts/:contactId`, updateContact);

router.get(`${WS}/tasks`, listTasks);
router.post(`${WS}/tasks`, createTask);
router.patch(`${WS}/tasks/:taskId`, updateTask);
router.post(`${WS}/tasks/:taskId/toggle`, toggleTask);
router.delete(`${WS}/tasks/:taskId`, deleteTask);

router.get(`${WS}/enquiries`, listEnquiries);
router.get(`${WS}/enquiries/:enquiryId`, getEnquiry);
router.patch(`${WS}/enquiries/:enquiryId/status`, setEnquiryStatus);
router.post(`${WS}/enquiries/:enquiryId/reply`, replyToEnquiry);

router.get(`${WS}/links`, listLinks);
router.post(`${WS}/links`, createLink);
router.patch(`${WS}/links/:linkId/active`, setLinkActive);
router.get(`${WS}/links/:linkId/stats`, linkStats);

router.get(`${WS}/campaigns`, listCampaigns);
router.post(`${WS}/campaigns`, createCampaign);
router.patch(`${WS}/campaigns/:campaignId`, updateCampaign);

router.get(`${WS}/automations`, listAutomations);
router.post(`${WS}/automations`, createAutomation);
router.post(`${WS}/automations/:automationId/toggle`, toggleAutomation);
router.delete(`${WS}/automations/:automationId`, deleteAutomation);

router.get(`${WS}/team`, listTeam);
router.post(`${WS}/team/invites`, inviteTeamMember);
router.delete(`${WS}/team/:userId`, removeTeamMember);

router.get(`${WS}/billing`, getBilling);
router.post(`${WS}/billing/plan`, changePlan);

// ------------------------------------------------------------------ admin ----

const A = `${V1}/admin`;
router.get(`${A}/stats`, adminStats);
router.get(`${A}/users`, listUsers);
router.patch(`${A}/users/:userId/status`, setUserStatus);
router.get(`${A}/businesses`, listBusinesses);
router.post(`${A}/businesses/:businessId/moderate`, moderateBusiness);
router.get(`${A}/moderation`, moderationQueue);
router.post(`${A}/moderation/:itemId`, decideModeration);
router.get(`${A}/reports`, listReports);
router.post(`${A}/reports/:reportId`, resolveReport);
router.get(`${A}/claims`, listClaims);
router.post(`${A}/claims/:claimId`, decideClaim);
router.get(`${A}/verification`, listVerificationRequests);
router.post(`${A}/verification/:requestId`, decideVerification);
router.get(`${A}/categories`, adminListCategories);
router.post(`${A}/categories`, adminUpsertCategory);
router.patch(`${A}/categories/:categoryId`, adminUpsertCategory);
router.post(`${A}/categories/:categoryId/toggle`, adminToggleCategory);
router.get(`${A}/tickets`, adminListTickets);
router.post(`${A}/tickets/:ticketId/reply`, adminReplyTicket);
router.get(`${A}/audit`, adminAudit);
router.get(`${A}/flags`, adminFlags);
router.put(`${A}/flags`, adminUpsertFlag);
router.delete(`${A}/flags/:key`, adminDeleteFlag);
router.get(`${A}/config`, adminConfig);
router.patch(`${A}/config`, adminUpdateConfig);
router.get(`${A}/jobs`, adminJobs);

/**
 * Requests are prepared once, here: session resolution and CSRF/origin safety run
 * before any handler touches data. Handlers therefore cannot forget the check.
 */
const fetchHandler = createFetchHandler(router, async (c: AppContext): Promise<AppContext> => {
  assertRequestSafety(c);
  const next: AppContext = { ...c, session: await loadSession(c) };
  await assertCsrfToken(next);
  return next;
});

export default {
  fetch: fetchHandler,
  queue: (batch: MessageBatch<QueueMessage>, env: Env) => handleQueue(batch, env),
  scheduled: (event: ScheduledEvent, env: Env, ctx: ExecutionContext) =>
    handleCron(event, env, ctx),
};

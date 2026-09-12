const clean = (value: string | undefined): string | undefined => value?.trim() || undefined;

/**
 * Public operator details are deployment inputs, not repository defaults. This prevents a template
 * name or invented inbox from becoming a legal representation in production.
 */
export const publicConfig = {
  siteUrl: clean(import.meta.env["VITE_SITE_URL"]),
  legalOperatorName: clean(import.meta.env["VITE_LEGAL_OPERATOR_NAME"]),
  privacyEmail: clean(import.meta.env["VITE_PRIVACY_EMAIL"]),
  supportEmail: clean(import.meta.env["VITE_SUPPORT_EMAIL"]),
  governingLaw: clean(import.meta.env["VITE_GOVERNING_LAW"]),
  disputeForum: clean(import.meta.env["VITE_DISPUTE_FORUM"]),
} as const;

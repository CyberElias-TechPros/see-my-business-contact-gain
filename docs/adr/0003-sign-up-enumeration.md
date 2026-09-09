# Sign-up says "account exists" — and is capped at four per IP per hour

**Status:** accepted (2026-09-09)

## Context

`POST /api/v1/auth/register` currently returns `409 An account already uses this email. Sign in
instead, or reset your password.` The textbook answer is to always respond as if the account was
created, so a client cannot test which emails are registered.

Two things about this product make the textbook answer actively harmful rather than merely
conservative. First, an account on GainHub is a _business_, and the directory is public:
"does gainhub.ng already know this trader?" is answerable in seconds by anyone who browses the
directory, so the enumeration protection has a hole in the front door by design. Second, the
likely failure at sign-up is a small business owner who started an account months ago, forgot,
and is now one step from giving up and losing the leads they came to collect. A vague
"check your inbox" for someone who never receives an email is how you lose exactly the user this
product cannot do without.

Nigeria's NDPR also frames this as a data-minimisation and fairness question, not just a
security one: the answer should help the user, not obscure a fact they can find elsewhere.

## Decision

Keep the truthful `409`, and make scripted enumeration expensive instead of impossible:

- `RULES.register` = **4 requests per hour per client IP** (`enforceLimit` before any database
  read, `Retry-After` header set). A scraper cannot walk a list of addresses cheaply.
- The response discloses _only_ existence — never the display name, phone, verification level or
  plan of the account, and never which of several fields collided.
- Login stays the opposite: `401 Email or password is incorrect.` for both unknown account and
  wrong password, with the same message, the same status and a KDF run even for unknown accounts
  so response time does not differ. A login is worth protecting hard because it grants access; a
  sign-up does not.
- Failed logins count up to 10 then lock the account for 15 minutes (`assertNotLocked`), and a
  successful login resets the counter — the lockout is what stops the enumeration that login
  would otherwise allow.
- Password reset always answers `If an account uses that email, a reset link is on its way.`, so
  the _unauthenticated_ path that could be abused at volume leaks nothing.

## Consequences

- A determined attacker with a botnet can still learn which of a list of emails has a GainHub
  account. Accepted, because the same information is one directory search away for any business
  that is published — which is the entire point of the product.
- A privacy-conscious reviewer will call this a finding. The response is to read this file rather
  than the code; the trade-off is deliberate, documented and enforced by the rate limit rather
  than by obscurity.
- If the product later adds private/unlisted listings, this ADR must be revisited: existence
  would no longer be public knowledge, and the flow should switch to "send a verification email
  either way, tell them to check their inbox".

## Alternatives considered

- **Always-201 + conditional email** — rejected for this audience and stage: it turns a 10-second
  recovery into an inbox hunt, and protects a fact the product publishes on purpose.
- **CAPTCHA/Turnstile on registration** — plausible when volume actually arrives; it adds a
  Cloudflare widget and a failure mode ("the challenge never loads on 3G") that this product's
  users will hit more often than a scraper will. Rate limiting is the cheap 80%.

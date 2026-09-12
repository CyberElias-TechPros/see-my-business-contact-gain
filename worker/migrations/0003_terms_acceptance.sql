-- Preserve the exact public terms version accepted by newly registered accounts.
-- Existing accounts remain NULL because consent must not be inferred retroactively.
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE users ADD COLUMN terms_version TEXT;

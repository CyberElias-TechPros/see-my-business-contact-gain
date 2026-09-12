-- Track private claim-file purging without discarding the moderation decision record.
ALTER TABLE claims ADD COLUMN evidence_deleted_at TEXT;
CREATE INDEX claims_evidence_retention_idx
  ON claims(status, updated_at)
  WHERE evidence_deleted_at IS NULL;

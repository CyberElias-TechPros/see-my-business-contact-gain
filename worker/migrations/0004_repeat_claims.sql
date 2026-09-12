-- Preserve rejected claim history while allowing a claimant to submit materially new evidence.
-- The original table-level UNIQUE constraint blocked every future attempt, even after rejection.
CREATE TABLE claims_rebuilt (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  claimant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimant_role TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  evidence_key TEXT NOT NULL,
  evidence_mime TEXT NOT NULL,
  evidence_size INTEGER NOT NULL CHECK (evidence_size > 0 AND evidence_size <= 8388608),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'contested')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  evidence_deleted_at TEXT
);

INSERT INTO claims_rebuilt
  (id, business_id, claimant_user_id, claimant_role, details, evidence_key, evidence_mime,
   evidence_size, status, created_at, updated_at, evidence_deleted_at)
SELECT id, business_id, claimant_user_id, claimant_role, details, evidence_key, evidence_mime,
       evidence_size, status, created_at, updated_at, evidence_deleted_at
  FROM claims;

DROP TABLE claims;
ALTER TABLE claims_rebuilt RENAME TO claims;

CREATE INDEX claims_queue_idx ON claims(status, created_at);
CREATE INDEX claims_evidence_retention_idx
  ON claims(status, updated_at)
  WHERE evidence_deleted_at IS NULL;
CREATE UNIQUE INDEX claims_active_claimant_unique
  ON claims(business_id, claimant_user_id)
  WHERE status IN ('pending', 'in_review', 'contested', 'approved');

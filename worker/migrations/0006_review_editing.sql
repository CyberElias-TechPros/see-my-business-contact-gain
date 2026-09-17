-- Review editing.
--
-- An edited review must be re-checked: otherwise a review could be approved and
-- then quietly rewritten into something that would never have passed. The
-- handler sends an edited review back to the moderation queue, so `edited_at`
-- exists to make that visible to both the author and the reviewer.
ALTER TABLE reviews ADD COLUMN edited_at TEXT;

-- Reviewers need to find re-submitted edits quickly.
CREATE INDEX reviews_reedit_idx ON reviews(status, edited_at) WHERE edited_at IS NOT NULL;

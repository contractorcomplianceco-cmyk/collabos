-- Project tasks: completed_at + owner backfill from title prefixes. Safe to re-run.

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Existing done tasks: use created_at as completed_at when missing.
UPDATE project_tasks
SET completed_at = created_at
WHERE status = 'done'
  AND completed_at IS NULL;

-- Backfill owners from "Rose:" / "Carmen:" title prefixes when owner is null.
UPDATE project_tasks
SET owner = 'Rose'
WHERE owner IS NULL
  AND title ~* '^Rose[[:space:]]*:';

UPDATE project_tasks
SET owner = 'Carmen'
WHERE owner IS NULL
  AND title ~* '^Carmen[[:space:]]*:';

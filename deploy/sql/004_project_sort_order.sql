-- Project priority order for Carmen's work path. Safe to re-run.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing id so current list order is stable until Rose reorders.
UPDATE projects
SET sort_order = id
WHERE sort_order = 0;

CREATE INDEX IF NOT EXISTS projects_sort_order_idx ON projects (sort_order);

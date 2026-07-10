-- Upgrade project build plans to v2 schema (phase ids, Rose/Carmen notes, project types).
-- Safe to re-run.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT;

ALTER TABLE project_build_plans
  ADD COLUMN IF NOT EXISTS current_phase_id TEXT DEFAULT 'phase-1',
  ADD COLUMN IF NOT EXISTS rose_instructions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS carmen_plan_notes TEXT NOT NULL DEFAULT '';

-- Migrate legacy columns if present from v1 backfill
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_build_plans' AND column_name = 'notes'
  ) THEN
    UPDATE project_build_plans
    SET carmen_plan_notes = notes
    WHERE carmen_plan_notes = '' AND notes <> '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_build_plans' AND column_name = 'current_phase'
  ) THEN
    UPDATE project_build_plans
    SET current_phase_id = CASE current_phase
      WHEN 'not_started' THEN 'phase-1'
      WHEN 'in_progress' THEN 'phase-2'
      WHEN 'live_stable' THEN 'phase-3'
      WHEN 'maintenance' THEN 'cc-2'
      WHEN 'blocked' THEN 'phase-2'
      ELSE 'phase-1'
    END
    WHERE current_phase_id IS NULL OR current_phase_id = 'phase-1';
  END IF;
END $$;

ALTER TABLE project_build_plans
  ALTER COLUMN current_phase_id SET NOT NULL;

ALTER TABLE project_build_plans
  DROP COLUMN IF EXISTS current_phase,
  DROP COLUMN IF EXISTS notes;

CREATE TABLE IF NOT EXISTS project_handoffs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_handoffs_project_id_idx ON project_handoffs(project_id);

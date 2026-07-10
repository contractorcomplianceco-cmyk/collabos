-- Extend project build plans, handoffs, and project type. Safe to re-run.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT;

CREATE TABLE IF NOT EXISTS project_build_plans (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  current_phase_id TEXT NOT NULL DEFAULT 'phase-1',
  progress INTEGER NOT NULL DEFAULT 0,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  rose_instructions TEXT NOT NULL DEFAULT '',
  carmen_plan_notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'sync',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate legacy column names if an older migration ran first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_build_plans' AND column_name = 'current_phase'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_build_plans' AND column_name = 'current_phase_id'
  ) THEN
    ALTER TABLE project_build_plans RENAME COLUMN current_phase TO current_phase_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_build_plans' AND column_name = 'notes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_build_plans' AND column_name = 'carmen_plan_notes'
  ) THEN
    ALTER TABLE project_build_plans RENAME COLUMN notes TO carmen_plan_notes;
  END IF;
END $$;

ALTER TABLE project_build_plans
  ADD COLUMN IF NOT EXISTS current_phase_id TEXT NOT NULL DEFAULT 'phase-1',
  ADD COLUMN IF NOT EXISTS rose_instructions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS carmen_plan_notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS project_build_plans_project_id_idx ON project_build_plans(project_id);

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

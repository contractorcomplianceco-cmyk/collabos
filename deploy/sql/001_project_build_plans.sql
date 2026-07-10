-- Project build plans: honest progress, phases, and notes per project.
-- Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS project_build_plans (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  current_phase TEXT NOT NULL DEFAULT 'not_started',
  progress INTEGER NOT NULL DEFAULT 0,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'sync',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_build_plans_project_id_idx ON project_build_plans(project_id);

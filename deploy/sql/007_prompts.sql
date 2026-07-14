-- Prompt Library: reusable prompts / AI reply templates (intent-first, optional project).
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'general',
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  shared_with TEXT,
  shared_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prompts_intent_idx ON prompts (intent);
CREATE INDEX IF NOT EXISTS prompts_project_id_idx ON prompts (project_id);
CREATE INDEX IF NOT EXISTS prompts_deleted_at_idx ON prompts (deleted_at);
CREATE INDEX IF NOT EXISTS prompts_shared_with_idx ON prompts (shared_with);

-- Link review-queue recommendations to projects when detectable. Safe to re-run.

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recommendations_project_id_idx ON recommendations (project_id);

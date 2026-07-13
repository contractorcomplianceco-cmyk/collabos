-- Cursor Direct Request attachments. Safe to re-run.

CREATE TABLE IF NOT EXISTS agent_work_attachments (
  id SERIAL PRIMARY KEY,
  agent_work_item_id INTEGER NOT NULL REFERENCES agent_work_items(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_work_attachments_item_id_idx
  ON agent_work_attachments(agent_work_item_id);

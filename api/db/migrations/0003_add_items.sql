CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  external_id TEXT,
  name TEXT,
  description TEXT,
  metadata TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

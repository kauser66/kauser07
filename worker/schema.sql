CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('news','volunteer')),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_status_created ON submissions(status, created_at);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  decision TEXT NOT NULL,
  decided_at TEXT NOT NULL
);

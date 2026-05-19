CREATE TABLE IF NOT EXISTS debates (
  id              TEXT PRIMARY KEY,
  topic           TEXT NOT NULL,
  judge_model     TEXT NOT NULL,
  round_count     INTEGER NOT NULL,
  max_tokens      INTEGER NOT NULL,
  teams_enabled   INTEGER NOT NULL,
  status          TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS teams (
  id         TEXT PRIMARY KEY,
  debate_id  TEXT NOT NULL REFERENCES debates(id),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debaters (
  id           TEXT PRIMARY KEY,
  debate_id    TEXT NOT NULL REFERENCES debates(id),
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  stance       TEXT NOT NULL,
  team_id      TEXT REFERENCES teams(id),
  speak_order  INTEGER NOT NULL,
  voice_uri    TEXT NOT NULL,
  disabled     INTEGER NOT NULL DEFAULT 0,
  persona      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS rounds (
  id           TEXT PRIMARY KEY,
  debate_id    TEXT NOT NULL REFERENCES debates(id),
  round_number INTEGER NOT NULL,
  status       TEXT NOT NULL,
  UNIQUE(debate_id, round_number)
);

CREATE TABLE IF NOT EXISTS speeches (
  id          TEXT PRIMARY KEY,
  round_id    TEXT NOT NULL REFERENCES rounds(id),
  debater_id  TEXT NOT NULL REFERENCES debaters(id),
  text        TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER,
  error       TEXT
);

CREATE TABLE IF NOT EXISTS whispers (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  debater_id TEXT NOT NULL REFERENCES debaters(id),
  team_id    TEXT NOT NULL REFERENCES teams(id),
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS interjections (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id         TEXT PRIMARY KEY,
  round_id   TEXT NOT NULL REFERENCES rounds(id),
  debater_id TEXT NOT NULL REFERENCES debaters(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verdicts (
  id              TEXT PRIMARY KEY,
  debate_id       TEXT NOT NULL REFERENCES debates(id),
  winner_debater  TEXT REFERENCES debaters(id),
  winner_team     TEXT REFERENCES teams(id),
  reasoning       TEXT NOT NULL,
  user_override   TEXT,
  override_note   TEXT,
  created_at      INTEGER NOT NULL
);

-- Krinyx Music — schéma PostgreSQL complet
-- La création automatique équivalente est exécutée par backend/auth.ts au démarrage.

CREATE TABLE IF NOT EXISTS krinyx_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS krinyx_sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS krinyx_sessions_expiry_idx ON krinyx_sessions(expires_at);

CREATE TABLE IF NOT EXISTS krinyx_email_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS krinyx_spotify_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES krinyx_users(id) ON DELETE CASCADE,
  spotify_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS krinyx_spotify_user_idx ON krinyx_spotify_accounts(spotify_user_id);

CREATE TABLE IF NOT EXISTS krinyx_favorites (
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS krinyx_playlists (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  imported BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS krinyx_playlist_tracks (
  playlist_id UUID NOT NULL REFERENCES krinyx_playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL,
  track JSONB NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, track_id)
);

-- Historique des préparations ; le fichier audio n'est pas conservé durablement ici.
CREATE TABLE IF NOT EXISTS krinyx_downloads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','downloading','complete','error')),
  filename TEXT,
  error TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  format TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS krinyx_downloads_user_idx ON krinyx_downloads(user_id, created_at DESC);

-- Métadonnées de la bibliothèque ; le fichier permanent appartient au stockage local de l'utilisateur.
CREATE TABLE IF NOT EXISTS krinyx_library (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  thumbnail TEXT,
  duration TEXT,
  source_url TEXT NOT NULL,
  local_status TEXT NOT NULL DEFAULT 'absent' CHECK (local_status IN ('absent','queued','available','streaming')),
  storage_key TEXT,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_id)
);
CREATE INDEX IF NOT EXISTS krinyx_library_user_idx ON krinyx_library(user_id, updated_at DESC);

-- File personnalisée de streaming/téléchargement : références uniquement, jamais des fichiers audio.
CREATE TABLE IF NOT EXISTS krinyx_stream_queue (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES krinyx_users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  track JSONB NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'stream' CHECK (mode IN ('stream','download')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','preparing','playing','played','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_id)
);
CREATE INDEX IF NOT EXISTS krinyx_stream_queue_user_idx ON krinyx_stream_queue(user_id, position);

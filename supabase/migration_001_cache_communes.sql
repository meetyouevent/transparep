-- TranspaRép — Cache des données communales agrégées
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS cache_communes (
  insee       TEXT PRIMARY KEY,
  nom         TEXT NOT NULL,
  data        JSONB NOT NULL,
  cached_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour purge TTL
CREATE INDEX idx_cache_communes_cached_at ON cache_communes (cached_at);

-- RLS : lecture publique, écriture via service role uniquement
ALTER TABLE cache_communes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON cache_communes FOR SELECT
  USING (true);

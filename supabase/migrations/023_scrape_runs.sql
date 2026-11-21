-- Migration 023: scrape_runs — one row per scraper run per source.
-- Additive. Until it is applied the scraper writes the same records to a
-- local JSON-lines file (PROPERTY_SCRAPER_RUN_LOG/runs-YYYY-MM.jsonl).
--
-- Alarms to build on it (plan §3): found < 70% of the 4-week median for a
-- source; newest finished_at older than 48 h; status <> 'ok'.

CREATE TABLE IF NOT EXISTS public.scrape_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,                 -- 'rentahouse' | 'remax'
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL,                 -- 'ok' | 'degraded' | 'failed'
  found integer,                        -- listing URLs in the source's index this run
  new integer,                          -- rows inserted
  updated integer,                      -- existing rows re-fetched and updated
  seen integer,                         -- existing rows still listed (last_seen_at bumped)
  expired integer,                      -- rows marked inactive (absent twice, or 404/410)
  reactivated integer,                  -- expired rows that came back
  errors integer,
  fetched integer,                      -- detail pages requested
  notes jsonb,                          -- breakdowns, error samples, guard decisions
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_source_started ON scrape_runs (source, started_at DESC);

-- Service role only (it bypasses RLS); no public access.
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;

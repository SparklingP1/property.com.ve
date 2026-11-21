-- Migration 025: close public write access and hide copied/contact columns.
--
-- 1. Migration 002 created "Service role can insert listings" / "... update
--    listings" with no TO clause, so they apply to PUBLIC (anon and
--    authenticated): anyone with the public anon key could insert or update
--    listings. The service role bypasses RLS and never needed them.
--
-- 2. Column-level read restriction for the public roles. Table-level SELECT
--    covers every column and a column REVOKE cannot carve out of it, so we
--    revoke SELECT on the table and grant it back on an explicit column list
--    that leaves out the copied source text and personal/contact data:
--      description_full, description_full_es, description_full_en,
--      agent_name, agent_phone, agent_email, agent_whatsapp,
--      street_address, postal_code, latitude, longitude
--    (agent_office stays: it holds the source's display name, e.g. "RE/MAX
--    Venezuela", per docs/data-contract.md.)
--    The web app (branch pages-linkout) never selects these columns and has
--    no select('*') on listings. NOTE: after this, select('*') on listings
--    with the anon key fails ("permission denied"), including the old local
--    analysis scripts in scripts/*.ts that use the anon key: run those with
--    the service-role key. Any column added later must be added to the GRANT
--    below to be readable by the site.
--
-- 3. The convenience view active_sale_listings (migration 005, SELECT *
--    expanded when it was created) runs with its owner's rights, so it
--    exposes description_full and agent_name to anon regardless of 1-2.
--    Nothing in the app, scraper or scripts reads it: revoke public access.
--
-- ORDER: apply after 022 (the GRANT names duplicate_of, fingerprint,
-- expired_reason) and after the pages-linkout deploy (the old site code
-- selects '*' on listings and would break).

-- 1. Public write policies
DROP POLICY IF EXISTS "Service role can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Service role can update listings" ON public.listings;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.listings FROM anon, authenticated;

-- 2. Column-level SELECT for the public roles
REVOKE SELECT ON public.listings FROM anon, authenticated;
GRANT SELECT (
  id, source, source_url, title, title_en, title_es,
  price, currency, price_per_sqm,
  location, region, state, city, neighborhood,
  bedrooms, bathrooms, parking_spaces,
  area_sqm, total_area_sqm, land_area_sqm,
  property_type, transaction_type, condition, furnished, construction_years,
  amenities, features, reference_code, agent_office,
  thumbnail_url, image_urls, photo_count, has_360_tour, has_video,
  description_short, description_short_es, description_short_en,
  translation_model, translated_at,
  url_slug, url_slug_es,
  scraped_at, last_seen_at, created_at, active, deactivated_at,
  duplicate_of, fingerprint, expired_reason
) ON public.listings TO anon, authenticated;

-- 3. The old convenience view
REVOKE ALL ON public.active_sale_listings FROM anon, authenticated;

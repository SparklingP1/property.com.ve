-- Migration 024: let the public (anon) key read expired listings.
--
-- Why: the web app runs with the anon key only (no service-role key on
-- Vercel). Expired listings (active = false, deactivated_at set) need a page:
-- "ya no disponible" + similar listings for 30 days, then 410 Gone. RLS today
-- (migration 001, "Public can read active listings") only exposes
-- active = true, so without this policy those URLs answer 404.
--
-- What stays hidden: rentals stored while rental pages are off the site
-- (active = false, deactivated_at IS NULL, docs/data-contract.md) — they do
-- not match this policy and keep answering 404.
--
-- PRECONDITION — apply only AFTER the link-out backfill has run with
-- --clear-descriptions (scraper/maintenance/backfill_linkout.py), so that no
-- expired row still holds copied descriptions or agent contacts. Check first:
--
--   select count(*) from listings
--   where deactivated_at is not null
--     and (description_full is not null or description_full_es is not null
--          or description_full_en is not null or agent_phone is not null
--          or agent_email is not null or agent_whatsapp is not null);
--   -- must be 0
--
-- Policies are OR-ed: anon/authenticated can read a row if it is active
-- (existing policy) or expired (this one). Read-only; no write access.

DROP POLICY IF EXISTS "Public can read expired listings" ON public.listings;

CREATE POLICY "Public can read expired listings"
  ON public.listings
  FOR SELECT
  TO anon, authenticated
  USING (deactivated_at IS NOT NULL);

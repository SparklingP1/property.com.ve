# Listing data contract (scraper → web pages)

From the link-out scraper (`scraper/run.py`, Nov 2026). The scraper owns
these columns; the pages read them. Owner decision 21 Nov 2026: aggregator
("link-out") style — facts, one thumbnail, our own summary, a clear link to
the source.

## Which rows to show

| State | `active` | `deactivated_at` | `expired_reason`¹ | Meaning |
|---|---|---|---|---|
| Live | `true` | `null` | `null` | Listed at the source on the latest run |
| Live rental, hidden | `false` | `null` | `null` | Stored while rentals stay off the site (see below) |
| Expired | `false` | timestamp | `missing_from_source` / `source_404` / `backlog_missing` | Left the source. Reversible: comes back to live if it reappears |

¹ `expired_reason`, `duplicate_of`, `fingerprint` exist only after migration
`022_linkout_dedup_expiry.sql` is applied.

- **Expired pages** ("ya no disponible" + similar listings for 30 days, then
  410): select by `deactivated_at`. RLS today lets the anon key read only
  `active = true` rows, so an expired page needs either the server-side
  service client or a new read policy (e.g. `active = true OR deactivated_at > now() - interval '30 days'`).
- **Rentals** (`transaction_type = 'rent'`): stored, kept hidden
  (`active = false`, `deactivated_at null`) until the pages filter by
  `transaction_type` everywhere they list sale stock (type × town pages,
  hubs, search, homepage, price pages, sitemaps). Then run the scraper with
  `--rentals-active` (or `PROPERTY_RENTALS_ACTIVE=1` in the cron env): the
  next run makes them `active = true`. Nothing else changes.
- **Duplicates**: `duplicate_of` (uuid) points at the canonical row (the
  newest copy). Show the canonical; a duplicate's URL can 301 to the
  canonical's page, or list "also on RE/MAX/Rent-A-House" there. Canonicals
  and unique rows have `duplicate_of = null`.
- `last_seen_at` = last run the source still listed it; `created_at` = first
  seen; `scraped_at` = last time we fetched the page itself.

## Fields

| Column | Contract |
|---|---|
| `source` | `rentahouse` \| `remax` |
| `source_url` | The original listing. **Every listing page must link to it** ("Ver en Rent-A-House" / "Ver en RE/MAX"; `agent_office` holds the display name: `Rent-A-House`, `RE/MAX Venezuela`). |
| `property_type` | `apartment` \| `house` \| `land` \| `annex` (Rent-A-House "anexo"). Townhouses and quintas are `house`. Commercial, office, building, business are not stored. 777 old rows have `null`. |
| `transaction_type` | `sale` \| `rent` |
| `price`, `currency` | As the source states it. Almost all USD. Rent prices are the source's rent figure (we do not assume a period). Outliers are kept in the row; only the price index filters them ($1k–$20M sale). |
| `area_sqm` | Private/built area (land: plot area). `total_area_sqm`, `land_area_sqm` when the source gives them. |
| `bedrooms`, `bathrooms`, `parking_spaces` | Integers or `null` (never 0-as-unknown). |
| `state`, `city`, `neighborhood` | As the source writes them. Not yet normalised (Falcon/Falcón etc. still split; RE/MAX "Nueva Esparta (Isla de Margarita)", Rent-A-House "Distrito Metropolitano"). `location` = `city`. |
| `title`, `title_es`, `title_en` | New rows: generated, e.g. "Apartamento de 3 habitaciones en venta en El Cafetal, Caracas" / "3-bedroom apartment for sale in El Cafetal, Caracas". Existing rows keep their old (source-written) title; the scraper never rewrites a title, so page titles don't change under you. |
| `description_short`, `description_short_es`, `description_short_en` | **Our summary**, generated from the facts by a fixed template (`scraper/facts.py`), e.g. "Apartamento en venta en El Cafetal, Caracas: 3 habitaciones, 2 baños, 120 m², USD 85.000." Safe to show as the listing text. |
| `description_full`, `description_full_es`, `description_full_en` | **`null` for new and refreshed rows** (no copy of the source text). Old rows still hold the copied text until the backfill runs with `--clear-descriptions`. Pages should not depend on it: show the summary + facts + the source link. |
| `thumbnail_url` | One image, ours (Supabase Storage `property-images/{id}/thumb.*` for new rows, `/image-0.*` for old ones). May be `null`. |
| `image_urls` | New/refreshed rows: `[thumbnail_url]` (one item). Old rows still list ~27 re-hosted photos until the photo clean-up. Pages should use `thumbnail_url` and not build galleries. `photo_count` = how many photos the source shows ("Ver las 18 fotos en RE/MAX"). |
| `agent_name`, `agent_phone`, `agent_email`, `agent_whatsapp` | **Always `null` going forward** (and for old rows once the backfill runs). Don't render them. |
| `street_address`, `postal_code`, `latitude`, `longitude` | `null` for new/refreshed rows. |
| `url_slug`, `url_slug_es` | Unchanged format; set once on insert, never rewritten. |
| `amenities` | Tag list (`pool`, `elevator`, `security`, …) from the source's checkboxes. |

## Market index

`price_history`: one `run_type = 'full'` row per live **for-sale** listing
(USD, $1k–$20M, not a duplicate) each week. `market_stats` is computed on
the 1st of each month for the previous month (`scraper/compute_stats.py`).
The first new month with data is the month the scraper restarts (a month
needs at least one weekly snapshot). Gaps (May–Nov 2026) stay gaps: never
fill them with estimates.

## Monitoring

`scrape_runs` (migration 023; until then `…/runs/runs-YYYY-MM.jsonl` on the
work server): per run per source `found`, `new`, `updated`, `seen`,
`expired`, `reactivated`, `errors`, `fetched`, `status`, `notes`.

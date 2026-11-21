# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Property.com.ve is a real estate aggregation platform for Venezuela, built on an exact-match ccTLD. It combines a Next.js frontend with a Python-based web scraper that runs on GitHub Actions weekly, storing data in Supabase.

**Strategic thesis:** 5-10 year asymmetric bet on Venezuela normalization. Content site → marketplace. Become the Rightmove of Venezuela. Content is the acquisition channel, not the product — the durable moats are the domain, the agent network (future), and proprietary listing data.

**Current phase:** Phase 1 — Authority (2026). Goal is indexation, traffic, and early demand signals. Target: 300+ pages indexed, 5-10k monthly organic visits by year-end.

**Bilingual strategy:** Spanish pages build authority and traffic volume. English pages generate high-value leads from diaspora and foreign investors.

**Tech Stack:**
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Radix UI primitives
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Scraper**: Python 3.11+, httpx, BeautifulSoup4 (no browser)
- **Deployment**: Vercel (frontend), GitHub Actions (scraper)

## Development Commands

```bash
# Frontend development
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build (may fail on ARM Windows due to Tailwind v4)
npm run lint         # Run ESLint

# Scraper (local testing; no browser needed)
pip install -r scraper/requirements.txt
python scraper/run.py --dry-run --max-fetch 3 --remax-max-pages 2 --print-records
# Requires SUPABASE_URL and SUPABASE_KEY (service-role key for live runs)

# Database migrations
# Apply via Supabase dashboard SQL editor in order:
# 001_initial_schema.sql → 002_allow_scraper_inserts.sql → 003_add_image_urls.sql → 004_add_rentahouse_fields.sql
```

## Architecture

### Frontend Architecture

**App Router Structure:**
- `/` - Homepage with hero, stats, featured listings
- `/search` - Advanced search with sidebar filters
- `/listing/[id]` - Individual listing detail pages
- `/guides`, `/about`, `/find-property`, `/list-your-property` - Static/form pages

**Key Patterns:**
- **Server Components by default**: Data fetching happens server-side with Supabase
- **Suspense boundaries**: Used for async components (listings, search results)
- **Client components**: Only for interactivity (forms, filters, navigation)

**Component Organization:**
```
src/components/
├── forms/          # React Hook Form + Zod validation
├── layout/         # Header, Footer
├── listings/       # ListingCard, ListingDetail, ListingGrid
├── search/         # SearchBar, AdvancedSearchFilters, SearchResults
├── seo/            # JSON-LD structured data
└── ui/             # Radix UI primitives (Button, Select, Input, etc.)
```

**Supabase Integration:**
- `src/lib/supabase/server.ts` - Server-side client with SSR support
- `src/lib/supabase/client.ts` - Client-side client (minimal usage)
- **Row Level Security (RLS)**: Public can read active listings, anonymous can submit forms

### Scraper Architecture (link-out, Nov 2026)

Owner decision 21 Nov 2026: aggregator ("link-out") style. Store facts, one
thumbnail and our own template summary; link to the source; no copied
descriptions, no agent names/phones/e-mails. Field contract for the pages:
`docs/data-contract.md`.

**Files** (`scraper/`): `run.py` (CLI/orchestration), `source_rentahouse.py`,
`source_remax.py` (discovery + parsing, plain HTTP, no browser),
`polite_http.py` (robots.txt incl. wildcards, crawl-delay, one request at a
time), `facts.py` (facts model, template titles/summaries, fingerprint,
slugs), `store.py` (all Supabase writes; `--dry-run` writes nothing),
`dedup.py`, `compute_stats.py` (monthly index), `cron/run_daily.sh`
(work-server cron), `maintenance/` (one-off expiry, backfill, dedup report,
photo storage report; all dry-run by default).

**Sources:**
- **Rent-A-House**: every live listing is in `sitemap-rentahouse.com.ve-property-details.xml`.
  robots.txt: `Crawl-delay: 10`, `Disallow: /*?` (never fetch a URL with a query string).
  Its `lastmod` is today's date for every URL, so it can't flag changes: we fetch
  new URLs, plus the N oldest-checked existing ones per run (`--refresh`).
- **RE/MAX**: sitemap.xml is stale; discovery walks `/inmuebles/{venta|alquiler}?ubi=VEN&page=N`
  (27 a page, server-rendered), 2 s apart (robots says 1 s, but it answers 429 at that rate; the fetcher backs off on 429). Matched to DB rows by the trailing listing id.
- Stored types: apartment, house (incl. townhouse/quinta), land, annex; sale and rent.
  Commercial/office/business skipped.

**Per run, per source:** discover → fetch new + refresh batch → upsert facts →
bump `last_seen_at` for listings still listed → expire (active=false,
deactivated_at=now) rows missing on this run and the previous one, or that
answer 404/410 → log to `scrape_runs` (or the local JSON log). Then a weekly
`price_history` snapshot (`run_type='full'`, live for-sale USD rows) and the
dedup pass (needs migration 022). Absence-expiry is skipped on the first run,
on test runs, and when discovery finds < 70% of the previous run.

**Rentals** are stored hidden (`active=false`, `deactivated_at null`) until the
pages filter by `transaction_type`; then run with `--rentals-active`.

**Key rule:** live runs need the **service-role** key; `run.py` and
`compute_stats.py` refuse any other. (The old scraper ran with a key that RLS
blocked from `price_history`: the price index silently stopped after 3 Apr 2026.)

### Refresh Schedule

- **Work server cron** (GitHub Actions were switched off for inactivity ~30 Sep 2026):
  `scraper/cron/run_daily.sh` daily; on the 1st it also computes the previous
  month's market index. Logs: `/home/dan/VE/logs/property-scraper/`.
- GitHub workflows (if re-enabled; don't run both): `scrape-daily.yml` (daily, +
  user alerts), `scrape-distributed.yml` (weekly deeper refresh, single job),
  `scrape-remax-test.yml` (manual full RE/MAX re-check), `compute-stats.yml` (monthly).

### Database Schema

**Main Table: `listings`**

Core fields:
- `id` (uuid), `source`, `source_url` (unique), `title`, `price`, `currency`
- `location`, `region`, `bedrooms`, `bathrooms`, `area_sqm`
- `property_type` (apartment, house, land, commercial, office)
- `scraped_at`, `last_seen_at`, `active` (boolean)

Enhanced fields (from migration 004):
- Location: `city`, `neighborhood`, `state`
- Details: `parking_spaces`, `condition`, `furnished`, `transaction_type`
- Areas: `total_area_sqm`, `land_area_sqm`
- Agent: `agent_name`, `agent_office`, `reference_code`
- Rich data: `amenities` (jsonb), `features` (jsonb), `image_urls` (jsonb)
- Full text: `description_full`

**Other Tables:**
- `buyer_leads` - Lead capture forms
- `agent_signups` - Agent registration
- `subscribers` - Email newsletter
- `takedown_requests` - DMCA/content removal requests

**Key Indexes:**
- B-tree: `location`, `price`, `city`, `state`, `property_type`, `transaction_type`
- GIN: `amenities` (for JSONB queries)

### Search & Filtering

**Advanced Search** (`/search` page):
- 11 filter options: transaction type, property type, state, price range, beds, baths, parking, area, furnished, keyword
- Server-side filtering with Supabase queries
- Supports complex queries: `or()` for keyword search across title/location/city/neighborhood
- Range filters: `gte()`, `lte()` for price and area
- Exact matches: `eq()` for categorical filters

**Query Pattern:**
```typescript
let query = supabase
  .from('listings')
  .select('*', { count: 'exact' })
  .eq('active', true)
  .order('scraped_at', { ascending: false });

// Apply filters dynamically based on searchParams
if (searchParams.state) query = query.eq('state', searchParams.state);
if (searchParams.minPrice) query = query.gte('price', Number(searchParams.minPrice));
// etc.
```

## Design System

**Color Palette** (following FrontEndDesign principles):
- Primary dark: `stone-900` (#1c1917)
- Accent: `amber-600` (#d97706), `amber-700` (hover)
- Neutral: `stone-50/100/200/300/400/600/700/800`
- Purpose: Earthy, sophisticated, avoids generic purple gradients

**Typography:**
- System font stack (Geist loaded via next/font)
- Bold headings: `text-4xl`, `text-5xl`, `font-bold`
- Line-broken headlines for impact ("Discover / Your Next / Space")

**Key Design Patterns:**
- **Asymmetric layouts**: Offset stat cards, 3:2 grid splits
- **Overlapping sections**: Negative margins (`-mt-12`) for depth
- **Rounded corners**: `rounded-2xl`, `rounded-3xl` (not `rounded-lg`)
- **Shadows**: `shadow-2xl` for elevation, `shadow-sm` for cards

**Component Variants:**
- Buttons: Primary (amber-600), Secondary (stone-800), Outline
- Cards: White with stone-200 border, hover states with scale transforms
- Forms: Stone-300 borders, clear focus states

## Important Patterns & Gotchas

### Scraper Patterns

- Everything that writes goes through `store.Store`; keep `--dry-run` truthful.
- Never add copied source text, extra photos or personal contact data to rows.
- Obey each source's robots.txt via `PoliteFetcher` (never bypass `check_robots`
  for listing hosts); one request at a time per host.
- Test with: `python scraper/run.py --dry-run --max-fetch 3 --remax-max-pages 2 --print-records`.

### Frontend Patterns

**Server component data fetching:**
```typescript
// In page.tsx or async components
const supabase = await createClient(); // SSR-compatible
const { data, count } = await supabase
  .from('listings')
  .select('*', { count: 'exact' })
  .eq('active', true);
```

**Client component state management:**
```typescript
// Use 'use client' directive at top
// useRouter, useSearchParams for navigation
// useState, useTransition for local state
```

**Form handling:**
- React Hook Form + Zod validation
- Server actions for submissions (in page route handlers)
- Toast notifications on success/error

### Build Issues

**ARM Windows + Tailwind CSS v4:**
- Local builds may fail with `lightningcss.win32-arm64-msvc.node` errors
- **This is expected** - code is correct, just platform-specific binary missing
- Builds work fine on x64 systems, Vercel, and CI/CD
- Don't attempt to "fix" by downgrading Tailwind CSS

### GitHub Actions

**Triggering scraper manually:**
```bash
# Via GitHub CLI
gh workflow run scrape.yml

# Via API
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/SparklingP1/property.com.ve/actions/workflows/scrape.yml/dispatches \
  -d '{"ref":"main"}'
```

**Environment secrets required:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase service role key (not anon key)

**Monitoring scraper:**
- Estimated time: 75-120 minutes for 1,000 properties
- Check Supabase: New listings should appear every ~15-20 minutes (batch uploads)
- Logs available in Actions tab, download artifacts for detailed output

## Data Flow

**Scraper → Database:**
1. Discovery from each source's sitemap / national search (robots.txt obeyed)
2. Plain-HTTP fetch of new + oldest-checked listings, parsed with BeautifulSoup into facts
3. Template titles/summaries; one thumbnail to Supabase Storage
4. Upsert in batches; last_seen_at bumped; missing/404 listings expired
5. Run logged to scrape_runs; weekly price snapshot; dedup marking

**Database → Frontend:**
1. User visits page (e.g., `/search`)
2. Server component queries Supabase with filters
3. Results streamed to client with Suspense
4. Client-side navigation updates search params
5. Server re-fetches with new filters (no client-side state)

**Forms → Database:**
1. User submits form (buyer lead, agent signup, etc.)
2. Client validates with Zod schema
3. Submits to server action or API route
4. Server inserts to Supabase (RLS allows anonymous inserts)
5. Success/error toast displayed

## TypeScript Types

**Key type definitions** (`src/types/listing.ts`):
- `PropertyType` - Union of property types
- `Currency` - Union of USD, VES, EUR
- `TransactionType` - 'sale' | 'rent'
- `Listing` - Main listing interface (30+ fields)
- `ListingFilters` - Search filter parameters
- `BuyerLead`, `AgentSignup`, `Subscriber`, `TakedownRequest` - Form data types

## Environment Variables

All env vars live in `.env.local` (gitignored). Shared keys like `ANTHROPIC_API_KEY` are also in the root `ve_sites/.env`.

**Required (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (for RLS)

**Optional (`.env.local`):**
- `NEXT_PUBLIC_SITE_URL` - Site URL for metadata (default: https://property.com.ve)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics measurement ID
- `ANTHROPIC_API_KEY` - Required for SEO content generation scripts (also available from root `.env`)

**Scraper (GitHub Actions secrets):**
- `SUPABASE_URL` - Same as frontend
- `SUPABASE_KEY` - Service role key (more permissions)

## Strategic Roadmap

See [property-com-ve-strategy.md](property-com-ve-strategy.md) for full detail. Summary of phases:

### Phase 1: Authority (2026) — CURRENT

**Technical priorities:**
- Hreflang audit and fix (highest priority) — every page needs self-referencing hreflang + reciprocal alternate-language tags
- GSC monitoring — 55 of 918 pages indexed as of March 2026, target 300+
- Sitemap hygiene — all 918 pages correctly represented, no orphans

**Content priorities:**
- Fix Margarita guide CTR — position 6.2, 400 impressions, only 2 clicks (~0.5% CTR, should be 3-5%)
- Build Falcón state hub — strongest cluster (Coro pos 1.8, Adicora 1.5, Punto Fijo 3.6, Paraguaná 7.3)
- Strengthen /apartment-for-sale page — "apartment for sale near me" at position 1.5
- Next hub candidates: Margarita Island, Caracas neighbourhoods, Valencia, Mérida

**Lead capture (critical):**
- "Register interest in [location]" form on every location page (name, email, buy/rent/invest, budget)
- Email capture on guides (lighter touch)
- Store all leads in Supabase — build demand database before content traffic window closes

### Phase 2: Demand Proof (2027)

- 20-50k monthly visits, 500+ registered buyer interests
- Agent outreach via concierge model (manual, email-based — NOT a platform yet)
- Convert traffic to owned assets (email list) before AI search erosion
- Manually curate 50-100 listings from agents on location pages

### Phase 3: Marketplace Build (2028-2029)

- Agent self-serve portal, buyer accounts, saved searches
- Revenue model TBD: freemium, subscription, lead gen, or hybrid
- Only build if Phase 2 validates demand

### Phase 4: Scale or Harvest (2030+)

- Decision based on Venezuela normalization trajectory
- If normalization: invest heavily, first-mover advantage
- If not: domain retains value, site on minimal maintenance

## Ongoing Principles

1. **Low intensity until validated** — side bet, not the main event
2. **Convert traffic to owned assets fast** — email list and registered buyers are durable value; SEO traffic is temporary scaffolding
3. **Don't build marketplace features before you need them** — concierge first, platform second
4. **Domain is the moat** — property.com.ve is irreplaceable, even if AI agents replace search
5. **Email-first outreach for agents** — fits the operator's style and the Venezuelan market
6. **Bilingual but English-monetises** — diaspora/foreign investors have the dollars

## Common Tasks

**Adding a new property source:**
1. Read its robots.txt and terms; prefer a sitemap; plain HTTP if pages are server-rendered
2. Create `scraper/source_<name>.py` with `SOURCE_ID`, `MIN_DELAY`, `classify_url(url)`,
   `discover(fetcher) -> {'urls', 'total'}` and `parse(url, html) -> ListingFacts | None`
3. Register it in `SOURCES` / `DEFAULTS` / `MIN_FOUND_FLOOR` in `scraper/run.py` and the `--source` choices
4. Add its brand to `agent_office` in `store.build_row()` and `sourceLabels` in `src/components/listings/listing-detail.tsx`
5. Dry-run with `--source <name> --dry-run --max-fetch 3 --print-records`

**Adding a new filter:**
1. Add state variable in `AdvancedSearchFilters` component
2. Add UI control (Select, Input, etc.)
3. Add to `handleSearch()` URLSearchParams logic
4. Add query filter in `SearchResults` component
5. Consider adding database index if performance suffers

**Database schema changes:**
1. Create new migration file: `005_description.sql`
2. Write migration SQL (use `alter table` and `if not exists`)
3. Test locally in Supabase SQL editor
4. Update `Listing` interface in `src/types/listing.ts`
5. Update scraper to extract new fields
6. Update frontend components to display new fields

**Design changes:**
1. Maintain earthy palette (stone/amber)
2. Use asymmetric layouts for visual interest
3. Prefer large, bold typography over small text
4. Test responsive design (mobile-first approach)
5. Avoid generic patterns (centered layouts, purple gradients)

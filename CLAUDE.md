# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Property.com.ve is a real estate aggregation platform for Venezuela. It combines a Next.js frontend with a Python-based web scraper that runs on GitHub Actions weekly, storing data in Supabase.

**Tech Stack:**
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Radix UI primitives
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Scraper**: Python 3.11, Playwright, BeautifulSoup4
- **Deployment**: Vercel (frontend), GitHub Actions (scraper)

## Development Commands

```bash
# Frontend development
npm run dev          # Start dev server on localhost:3000
npm run build        # Production build (may fail on ARM Windows due to Tailwind v4)
npm run lint         # Run ESLint

# Scraper (local testing)
cd scraper
pip install -r requirements.txt
playwright install chromium
python run.py        # Requires SUPABASE_URL and SUPABASE_KEY env vars

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

### Scraper Architecture

**File**: `scraper/run.py` (~920 lines)

**Key Classes:**
- `PropertyListing` (Pydantic): Data model with 30+ fields
- `PlaywrightExtractor`: Browser automation for JavaScript-heavy sites
- `SupabaseStorage`: Database operations with upsert logic
- `ScraperConfig`: Source configuration (URL, source_id)

**Scraper Flow:**
1. Initialize Playwright browser (Chromium)
2. For each source (Rent-A-House, BienesOnline, etc.):
   - Paginate through listing pages (83 pages for Rent-A-House)
   - Extract individual listing URLs
   - Visit each listing, parse with BeautifulSoup
   - **Batch upload every 10 pages** (critical for progress visibility)
3. Mark stale listings (not seen in current run) as inactive

**Batch Upload System:**
- Uploads listings every 10 pages (not at the end)
- Logs: `📦 Uploading batch of X listings...` and `✅ Batch uploaded: X upserted`
- Prevents data loss if scraper is cancelled
- Makes progress visible in Supabase during long runs

**Sources Supported:**
- **Rent-A-House** (primary): Residential properties only, filters out commercial/office/building
- **BienesOnline**: Currently disabled
- **Green-Acres**: Legacy support

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

**Always use batch uploads when modifying scraper:**
```python
# In extract_rentahouse_listings(), after each page:
if storage and source_id and page_num % batch_size == 0 and all_listings:
    result = storage.upsert_listings(all_listings, source_id)
    total_uploaded += result.get('upserted', 0)
    logger.info(f"✅ Batch uploaded: {result.get('upserted', 0)} upserted")
    all_listings = []  # Clear batch
```

**Filtering commercial properties:**
```python
property_type = raw_data.get('property_type', '').lower()
if property_type in ['commercial', 'office', 'building']:
    logger.info(f"Skipping commercial property: {raw_data.get('title', '')[:60]}")
    continue
```

**Image quality extraction:**
- Rent-A-House uses lazy-loading: Extract from `data-src` and `data-srcset`
- Always get highest resolution: `2048x1600` from srcset
- Pattern: `https://cdn.resize.sparkplatform.com/ven/2048x1600/true/{img_id}-o.jpg`

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
1. Playwright extracts raw HTML from property sites
2. BeautifulSoup parses HTML into structured data
3. Pydantic validates and normalizes data
4. Supabase storage upserts listings (batch every 10 pages)
5. Stale listings marked inactive at end

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

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (for RLS)

**Optional:**
- `NEXT_PUBLIC_SITE_URL` - Site URL for metadata (default: https://property.com.ve)

**Scraper (GitHub Actions secrets):**
- `SUPABASE_URL` - Same as frontend
- `SUPABASE_KEY` - Service role key (more permissions)

## Common Tasks

**Adding a new property source:**
1. Create `_parse_<source>_listing()` method in `PlaywrightExtractor`
2. Add source configuration in `get_<source>_config()`
3. Add source to `main()` function with error handling
4. Update `sourceLabels` in `listing-detail.tsx`
5. Add domain to `next.config.ts` image remotePatterns

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

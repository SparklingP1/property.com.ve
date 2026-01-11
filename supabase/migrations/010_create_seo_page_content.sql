-- Create table for storing programmatic SEO page content
-- Each row represents one SEO landing page with pre-generated content

create table if not exists public.seo_page_content (
  id uuid default gen_random_uuid() primary key,
  page_slug text unique not null,  -- e.g., "/apartments-caracas"

  -- SEO content fields
  h1 text not null,
  description text not null,  -- 2-3 sentences of human-like content
  meta_title text not null,
  meta_description text not null,

  -- Filters that define this page
  filters jsonb not null,  -- e.g., {"city": "Caracas", "property_type": "apartment"}

  -- Metadata
  listing_count integer not null default 0,  -- Current count of listings matching filters
  keywords text[] default array[]::text[],  -- Target keywords
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index if not exists idx_seo_page_content_slug on public.seo_page_content(page_slug);
create index if not exists idx_seo_page_content_filters on public.seo_page_content using gin(filters);

-- Enable RLS (Row Level Security)
alter table public.seo_page_content enable row level security;

-- Policy: Allow public read access (for displaying pages)
create policy "Allow public read access to SEO content"
  on public.seo_page_content for select
  using (true);

-- Policy: Restrict insert/update/delete to service role only
create policy "Restrict write access to service role"
  on public.seo_page_content for all
  using (false);

-- Add comment for documentation
comment on table public.seo_page_content is 'Stores pre-generated SEO content for programmatic landing pages. Content is generated via Claude API and refreshed periodically.';

comment on column public.seo_page_content.page_slug is 'URL slug in format: /2-bedroom-apartments-caracas';
comment on column public.seo_page_content.description is 'Human-like, 2-3 sentence description for display at top of page';
comment on column public.seo_page_content.filters is 'JSONB object containing filter criteria: {city, state, property_type, bedrooms}';
comment on column public.seo_page_content.listing_count is 'Cached count of matching listings (updated periodically)';

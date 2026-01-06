# Property.com.ve Setup Guide

## Supabase Configuration

### 1. Database Migrations

Run all migrations in the `supabase/migrations/` directory in order:

```sql
-- 1. Initial schema (001_initial_schema.sql)
-- 2. Allow scraper inserts (002_allow_scraper_inserts.sql)
-- 3. Add image URLs column (003_add_image_urls.sql)
```

### 2. Create Storage Bucket for Images

The scraper downloads and self-hosts property images. You need to create a storage bucket:

**In Supabase Dashboard:**

1. Go to **Storage** in the left sidebar
2. Click **New Bucket**
3. Set bucket name: `property-images`
4. Enable **Public bucket** (so images are accessible via public URLs)
5. Click **Create bucket**

**Bucket Configuration:**
- **Name:** `property-images`
- **Public:** Yes
- **File size limit:** 50MB (default)
- **Allowed MIME types:** `image/*`

The scraper will organize images as:
```
property-images/
  ├── {property-id}/
  │   ├── image-0.jpg
  │   ├── image-1.jpg
  │   └── image-2.jpg
  └── {another-property}/
      └── image-0.jpg
```

### 3. GitHub Secrets

Configure these secrets in your GitHub repository settings:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase **service role** key (not anon key!)

**To find these:**
1. Go to Project Settings > API
2. Copy the URL from "Project URL"
3. Copy the key from "service_role" (click to reveal)

## Running the Scraper

### Local Development

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium

export SUPABASE_URL="your-url"
export SUPABASE_KEY="your-key"

python run.py
```

### Production (GitHub Actions)

The scraper runs automatically:
- **Schedule:** Every Sunday at 3am UTC
- **Manual:** Go to Actions tab → "Scrape Properties" → "Run workflow"

## Cost Breakdown

### Current Setup (Zero Cost!)

- **Scraping:** Playwright (headless browser) - **$0**
- **Database:** Supabase Free Tier (500MB) - **$0**
- **Storage:** ~12GB for 5,000 properties - **~$0.24/month**
- **Bandwidth:** Included in Supabase - **$0**

**Total: ~$0.24/month** vs. **$500/month** with Firecrawl API!

### Scaling Costs

If you exceed Supabase free tier:

| Properties | Storage | Database | Cost/Month |
|-----------|---------|----------|------------|
| 5,000     | 12GB    | 50MB     | $0.24      |
| 10,000    | 24GB    | 100MB    | $0.50      |
| 50,000    | 120GB   | 500MB    | $3.00      |

## Architecture

```
GitHub Actions (Weekly)
  ↓
Playwright Scraper
  ↓
Downloads HTML → Parses with BeautifulSoup
  ↓
Downloads Images → Uploads to Supabase Storage
  ↓
Stores Listings → Supabase PostgreSQL
  ↓
Next.js App → Displays Properties
```

## Monitoring

Check scraper status:
- **GitHub Actions:** Repository → Actions tab
- **Supabase Logs:** Dashboard → Database → Logs
- **Storage Usage:** Dashboard → Storage → Usage

## Troubleshooting

### Images not appearing
- Verify `property-images` bucket exists and is public
- Check scraper logs for upload errors
- Confirm SUPABASE_KEY is service_role (not anon)

### No listings in database
- Confirm all migrations are run
- Check GitHub Actions logs for errors
- Verify secrets are set correctly

### Rate limiting
- Adjust `rate_limit` parameter in `scraper/run.py`
- Default is 10 seconds between pages

# AI Translation Feature for English-Language Portal

## Overview

Property.com.ve automatically translates all property listings from Spanish to natural, buyer-friendly English using OpenAI GPT-4.

**Last Updated:** January 2026

---

## How It Works

### Translation Pipeline

```
1. Scrape → 2. Extract Spanish Data → 3. AI Translate → 4. Store Both → 5. Display English
```

**Step 1: Scraping**
- Extract property data from Venezuelan websites (Spanish content)

**Step 2: Translation**
- Send to OpenAI GPT-4o-mini for translation
- Prompt instructs AI to translate AND lightly rewrite for English buyers
- Preserves location names as proper nouns
- Uses real estate terminology appropriate for international buyers

**Step 3: Storage**
- Store English translations (`title_en`, `description_short_en`, `description_full_en`)
- Preserve Spanish originals (`title_es`, `description_short_es`, `description_full_es`)
- Track translation metadata (`translation_model`, `translated_at`)

**Step 4: Display**
- Website shows English versions by default
- Spanish originals available for reference/debugging

---

## Translation Quality

### AI Model
- **Model:** GPT-4o-mini (fast, cost-effective, high-quality)
- **Temperature:** 0.3 (consistent, accurate translations)
- **Strategy:** Not just translation - natural rewriting for buyers

### Example Transformation

**Spanish (Original):**
```
Apartamento (1 Nivel) en Venta en Cumbres de Curumo, Distrito Metropolitano
Apartamento en venta ubicado en Cumbres de Curumo, este apartamento se encuentra en el piso 8, cuenta con 3 habitaciones, 2 baños, sala, comedor, cocina, área de servicio, 2 puestos de estacionamiento techados.
```

**English (AI-Translated & Rewritten):**
```
3-Bedroom Apartment for Sale in Cumbres de Curumo, Caracas
Modern apartment located on the 8th floor in Cumbres de Curumo featuring 3 bedrooms, 2 bathrooms, living room, dining room, kitchen, service area, and 2 covered parking spaces.
```

### Translation Features

✅ **Natural language** - Sounds like native English, not machine translation
✅ **Real estate terminology** - Uses terms familiar to international buyers
✅ **Location preservation** - Keeps Venezuelan place names as proper nouns
✅ **Measurement consistency** - Already in m², no conversion needed
✅ **Factual accuracy** - Maintains all details from original

---

## Database Schema

### English Fields (Primary Display)
```sql
title_en TEXT                   -- Translated title
description_short_en TEXT       -- Translated short description (200 chars)
description_full_en TEXT        -- Translated full description
```

### Spanish Fields (Reference)
```sql
title_es TEXT                   -- Original Spanish title
description_short_es TEXT       -- Original Spanish short description
description_full_es TEXT        -- Original Spanish full description
```

### Metadata
```sql
translation_model TEXT          -- AI model used (e.g., 'gpt-4o-mini')
translated_at TIMESTAMP         -- When translation occurred
```

### Full-Text Search
```sql
-- English full-text search indexes for fast queries
CREATE INDEX idx_listings_title_en
  ON listings USING gin(to_tsvector('english', title_en));

CREATE INDEX idx_listings_description_en
  ON listings USING gin(to_tsvector('english', description_full_en));
```

---

## Cost Analysis

### Per-Listing Cost
- **Average listing:** ~300 words (title + descriptions)
- **GPT-4o-mini pricing:** $0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Estimated cost:** ~$0.0002 per listing

### Monthly Cost (Full Scale)
- **15,405 listings** (Rent-A-House full inventory)
- **Translation cost:** ~$3-5 per scrape
- **4 scrapes per month:** ~$12-20/month for translation

**Total scraping cost with translation:**
- Scraping: ~$75-125/month
- Translation: ~$12-20/month
- **Total: ~$87-145/month**

### Cost Optimization
- Translations cached in database (only translate once)
- Updates only re-translate if description changed
- Incremental scraping reduces redundant translations

---

## Setup Instructions

### 1. Add OpenAI API Key

**In GitHub:**
1. Go to Repository Settings → Secrets and variables → Actions
2. Add new repository secret:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (from platform.openai.com)

**For Local Testing:**
```bash
export OPENAI_API_KEY="sk-..."
```

### 2. Apply Database Migration

Run in Supabase SQL Editor:
```sql
-- File: supabase/migrations/006_add_english_translations.sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_short_en TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_full_en TEXT;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS title_es TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_short_es TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_full_es TEXT;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS translation_model TEXT;

-- Create full-text search indexes
CREATE INDEX idx_listings_title_en
  ON listings USING gin(to_tsvector('english', title_en));

CREATE INDEX idx_listings_description_en
  ON listings USING gin(to_tsvector('english', description_full_en));
```

### 3. Verify Installation

Translation is automatic - just run the scraper:

```bash
python scraper/run.py --max-pages 1
```

Look for log messages:
```
✅ Translation enabled - listings will be converted to English
✅ Translated: Apartamento (1 Nivel)... → 3-Bedroom Apartment...
```

---

## Frontend Integration

### Display English Content

```typescript
// components/PropertyCard.tsx
export function PropertyCard({ listing }) {
  // Use English versions with fallback to Spanish
  const title = listing.title_en || listing.title;
  const description = listing.description_short_en || listing.description_short;

  return (
    <div className="property-card">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
```

### Search in English

```typescript
// lib/search.ts
export async function searchListings(query: string) {
  const { data } = await supabase
    .from('listings')
    .select('*')
    .or(`title_en.ilike.%${query}%,description_full_en.ilike.%${query}%`)
    .eq('active', true)
    .order('last_seen_at', { ascending: false });

  return data;
}
```

### Full-Text Search (Advanced)

```typescript
// Use PostgreSQL full-text search for better results
export async function fullTextSearch(query: string) {
  const { data } = await supabase
    .from('listings')
    .select('*')
    .textSearch('title_en', query, {
      type: 'websearch',
      config: 'english'
    })
    .eq('active', true)
    .limit(50);

  return data;
}
```

---

## Translation Prompt

The scraper uses this prompt structure for AI translation:

```
You are a professional real estate copywriter specializing in translating
Venezuelan property listings for English-speaking international buyers.

Translate and lightly rewrite to sound natural and appealing while
maintaining accuracy.

INSTRUCTIONS:
1. Translate the title to clear, descriptive English
   (e.g., "3-Bedroom Apartment in Caracas")
2. Translate the short description (keep under 200 characters)
3. Translate the full description, rewriting slightly to sound natural
   in English
4. Keep location names as proper nouns
   (Caracas, Distrito Metropolitano, etc.)
5. Convert measurements if needed (already in m²)
6. Use US real estate terminology where appropriate
7. Maintain all factual information accurately
```

---

## Monitoring & Quality Control

### Check Translation Coverage

```sql
-- See how many listings have been translated
SELECT
  COUNT(*) as total_listings,
  COUNT(title_en) as translated,
  COUNT(title_en)::float / COUNT(*)::float * 100 as coverage_percent
FROM listings
WHERE active = true;
```

### Review Translation Quality

```sql
-- Sample translations for manual review
SELECT
  title_es as spanish_title,
  title_en as english_title,
  description_short_es as spanish_desc,
  description_short_en as english_desc,
  translation_model,
  translated_at
FROM listings
WHERE active = true
  AND title_en IS NOT NULL
ORDER BY translated_at DESC
LIMIT 10;
```

### Monitor Translation Costs

```sql
-- Count unique translations by date
SELECT
  DATE(translated_at) as translation_date,
  COUNT(*) as translations,
  COUNT(*) * 0.0002 as estimated_cost_usd
FROM listings
WHERE translated_at IS NOT NULL
GROUP BY DATE(translated_at)
ORDER BY translation_date DESC;
```

---

## Troubleshooting

### Translation Not Working

**Check 1: API Key**
```bash
# Verify env var is set
echo $OPENAI_API_KEY

# Check GitHub Actions logs for:
✅ Translation enabled - listings will be converted to English
```

**Check 2: Python Module**
```bash
# Ensure translator.py exists
ls scraper/translator.py

# Test import
python -c "from scraper.translator import PropertyTranslator"
```

**Check 3: OpenAI Package**
```bash
pip install openai>=1.12.0
```

### Slow Scraping

Translation adds ~1-2 seconds per listing. For 15K listings:
- Without translation: ~53 hours
- With translation: ~60 hours (+13%)

Still completes within 6-hour timeout with distributed scraping.

### API Rate Limits

GPT-4o-mini has generous rate limits:
- **Tier 1:** 500 requests/minute, 200K tokens/minute
- **Our usage:** ~1 request/3 seconds = 20 req/min (well below limit)

If hit rate limits:
- Increase delay between translations
- Batch translations (send multiple in one request)
- Use retries with exponential backoff (already implemented)

---

## Future Enhancements

### Phase 2: Amenity Translation

Translate amenity terms:
```python
amenities_es = ['piscina', 'gimnasio', 'seguridad']
amenities_en = ['pool', 'gym', 'security']
```

### Phase 3: Multi-Language Support

Add Portuguese, French for broader LATAM/international audience:
```sql
ALTER TABLE listings ADD COLUMN title_pt TEXT;  -- Portuguese
ALTER TABLE listings ADD COLUMN title_fr TEXT;  -- French
```

### Phase 4: AI-Enhanced Descriptions

Use AI to add contextual information:
- Neighborhood descriptions
- Distance to amenities
- Market insights
- Investment highlights

---

## Summary

✅ **Automatic translation** - Every listing converted to English
✅ **High quality** - GPT-4o-mini with real estate expertise
✅ **Cost-effective** - ~$0.0002 per listing
✅ **Production-ready** - Integrated into distributed scraper
✅ **Fallback-safe** - Spanish preserved if translation fails
✅ **SEO-optimized** - Full-text search indexes for English content

Property.com.ve is now a true English-language portal for international buyers!

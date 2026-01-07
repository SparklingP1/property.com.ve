# Distributed Scraping Strategy for High-Volume Sources

## Problem Statement

**Rent-A-House Scale:**
- 15,405 total listings
- 1,284 pages at 12 listings/page
- ~2.5 minutes per page = **53.5 hours** total
- Current 60-min timeout = **1.9% coverage**

**Challenge:** GitHub Actions has a 6-hour max timeout, but we need 53.5 hours to complete.

---

## Solution: Parallel Matrix Scraping

Split the workload across multiple parallel jobs, each handling a page range.

### Architecture

```
GitHub Actions Workflow (Matrix Strategy)
├── Job 1: Pages 1-150    (6 hours)
├── Job 2: Pages 151-300  (6 hours)
├── Job 3: Pages 301-450  (6 hours)
├── Job 4: Pages 451-600  (6 hours)
├── Job 5: Pages 601-750  (6 hours)
├── Job 6: Pages 751-900  (6 hours)
├── Job 7: Pages 901-1050 (6 hours)
├── Job 8: Pages 1051-1200 (6 hours)
└── Job 9: Pages 1201-1284 (3.5 hours)

Total: 9 parallel jobs × 6 hours = 54 hours of work in 6 hours wall time
```

### Benefits

✅ **Completes in 6 hours** (within GitHub Actions limits)
✅ **Fault tolerant** (one job failure doesn't stop others)
✅ **Scalable** (add more jobs = faster completion)
✅ **Cost efficient** (GitHub free tier: 2,000 min/month = 33 hours)

---

## Implementation

### 1. Update Scraper to Support Page Ranges

Add command-line arguments:
```bash
python scraper/run.py --start-page 1 --end-page 150
```

### 2. GitHub Actions Workflow Matrix

```yaml
name: Scrape Properties (Distributed)

on:
  schedule:
    - cron: '0 3 * * 0'  # Sunday 3am UTC
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 360  # 6 hours
    environment: Production

    strategy:
      max-parallel: 10  # Run 10 jobs concurrently
      fail-fast: false  # Continue other jobs if one fails
      matrix:
        page_range:
          - { start: 1, end: 150 }
          - { start: 151, end: 300 }
          - { start: 301, end: 450 }
          - { start: 451, end: 600 }
          - { start: 601, end: 750 }
          - { start: 751, end: 900 }
          - { start: 901, end: 1050 }
          - { start: 1051, end: 1200 }
          - { start: 1201, end: 1284 }

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r scraper/requirements.txt

      - name: Install Playwright
        run: playwright install chromium

      - name: Run scraper for page range ${{ matrix.page_range.start }}-${{ matrix.page_range.end }}
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: |
          python scraper/run.py \
            --start-page ${{ matrix.page_range.start }} \
            --end-page ${{ matrix.page_range.end }}

      - name: Report completion
        if: always()
        run: |
          echo "✅ Completed pages ${{ matrix.page_range.start }}-${{ matrix.page_range.end }}"
```

### 3. Scraper Code Changes

Add argparse support:

```python
import argparse

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start-page', type=int, default=1)
    parser.add_argument('--end-page', type=int, default=None)
    return parser.parse_args()

# In scrape_rentahouse method:
def scrape_rentahouse(self, config, start_page=1, end_page=None):
    base_url = "https://rentahouse.com.ve/buscar-propiedades?tipo_negocio=venta&tipo_inmueble=Apartamento,Casa,Townhouse"

    for page_num in range(start_page, (end_page or max_pages) + 1):
        url = f"{base_url}&page={page_num}"
        # ... scraping logic
```

---

## Cost Analysis

### GitHub Actions Free Tier
- **Limit:** 2,000 minutes/month for free accounts
- **Usage:** 9 jobs × 6 hours × 4 weeks = **1,296 minutes/week** = 5,184 min/month
- **Cost:** $0.008/min for private repos beyond free tier
- **Monthly cost:** (5,184 - 2,000) × $0.008 = **$25.47/month**

### Firecrawl API
- **Pages per month:** 1,284 pages × 4 weeks = 5,136 pages
- **Listings per month:** 15,405 × 4 = 61,620 listings
- **Estimated cost:** ~$50-100/month depending on plan

### Total: ~$75-125/month for complete coverage

---

## Alternative: Incremental Scraping (Smart Stop)

For cost optimization, implement early stopping:

```python
def scrape_with_smart_stop(self, config, max_known_ratio=0.8):
    """Stop scraping when 80% of recent listings are already known."""

    seen_count = 0
    known_count = 0

    for page in range(1, max_pages):
        listings_on_page = self.scrape_page(page)

        for listing in listings_on_page:
            seen_count += 1

            # Check if listing already exists
            exists = self.check_listing_exists(listing.source_url)
            if exists:
                known_count += 1

            # Early stop condition
            if seen_count > 100:  # After seeing at least 100 listings
                known_ratio = known_count / seen_count
                if known_ratio > max_known_ratio:
                    logger.info(f"🛑 Stopping early: {known_ratio:.1%} listings already known")
                    return
```

**Benefits:**
- Focuses on new/updated listings (first pages)
- Typical runs complete in 1-2 hours
- Full refresh runs monthly for comprehensive updates
- **Saves 80% of API costs**

---

## Recommended Approach

### Phase 1: Initial Full Scrape (One-time)
Use distributed matrix approach to get complete initial dataset:
- Run once with all 9 parallel jobs
- Populates database with all 15,405 listings
- Takes 6 hours, ~$20 in costs

### Phase 2: Incremental Updates (Ongoing)
Switch to smart incremental scraping:
- Run 3x per week (Mon/Wed/Sat)
- Stop when hitting 80% known listings
- Typically completes in 1-2 hours
- Focuses on new/updated properties
- Cost: ~$15/month

### Phase 3: Monthly Full Refresh
Run full distributed scrape once per month:
- Catches any missed updates
- Verifies old listings still active
- Ensures database completeness

---

## Implementation Timeline

**Week 1: Distributed Scraping**
- ✅ Update scraper with page range support
- ✅ Create distributed workflow
- ✅ Run initial full scrape (6 hours)
- ✅ Validate 15K+ listings in database

**Week 2: Incremental Optimization**
- Add smart stop logic
- Test incremental runs
- Fine-tune stopping threshold
- Monitor cost savings

**Week 3: Production Schedule**
- 3x weekly incremental scrapes
- 1x monthly full refresh
- Monitor and adjust

---

## Monitoring

Track these metrics in GitHub Actions logs:

```python
logger.info(f"📊 Scrape Statistics:")
logger.info(f"  Pages scraped: {pages_completed}/{total_pages}")
logger.info(f"  Listings found: {listings_found}")
logger.info(f"  New listings: {new_count}")
logger.info(f"  Updated listings: {updated_count}")
logger.info(f"  Known ratio: {known_ratio:.1%}")
logger.info(f"  Duration: {duration_minutes:.1f} minutes")
logger.info(f"  Est. API cost: ${estimated_cost:.2f}")
```

---

## Risk Mitigation

**Risk: Too many parallel requests to source**
- Solution: Add 2-3 second delays between requests
- Stagger job start times (1-minute intervals)

**Risk: Hitting Firecrawl rate limits**
- Solution: Monitor rate limit headers
- Implement exponential backoff
- Reduce parallel jobs if needed

**Risk: Database locking conflicts**
- Solution: Batch uploads already implemented
- Supabase handles concurrent writes well
- Use upsert for conflict resolution

**Risk: One matrix job fails**
- Solution: `fail-fast: false` continues other jobs
- Re-run individual failed job ranges
- Results still saved from successful jobs

---

## Conclusion

The distributed matrix approach is the best solution for high-volume scraping:

✅ Handles 15K+ listings efficiently
✅ Completes within GitHub Actions limits
✅ Fault-tolerant and scalable
✅ Cost-effective with incremental updates
✅ Production-ready architecture

Next steps: Implement page range support in scraper, then deploy distributed workflow.

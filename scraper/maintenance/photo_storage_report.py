#!/usr/bin/env python3
"""How much Supabase Storage the copied photos use (read-only).

The old scraper re-hosted every photo of every listing in the
`property-images` bucket as {pid}/image-{n}.{ext}. The link-out rule keeps
one: image-0 (or thumb.*). This counts the folders, measures a random
sample of them and extrapolates the space taken by photos other than #1.

How to remove the extra photos later (not done here; needs the owner's OK):
  1. For each folder, list its objects and call
     storage.from_('property-images').remove([...every name except image-0.* / thumb.*])
     in batches of up to 1000 paths.
  2. Set listings.image_urls = [thumbnail_url] for every row (the link-out
     runner already does this for every row it refreshes).
  Do step 2 first so no page points at a deleted file. Storage space is
  freed immediately; it cannot be undone (the source still has the photos).
"""

from __future__ import annotations

import json
import logging
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from store import BUCKET, Store  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)


def main(sample_n: int = 80):
    store = Store(dry_run=True)
    b = store.client.storage.from_(BUCKET)
    folders, off = [], 0
    while True:
        page = b.list("", {"limit": 1000, "offset": off, "sortBy": {"column": "name", "order": "asc"}})
        names = [o["name"] for o in page if o.get("id") is None]  # folders have no id
        folders += names
        if len(page) < 1000:
            break
        off += 1000
    sample = random.Random(7).sample(folders, min(sample_n, len(folders)))
    first_bytes = other_bytes = files = 0
    for f in sample:
        objs = b.list(f, {"limit": 1000})
        for o in objs:
            size = int((o.get("metadata") or {}).get("size") or 0)
            files += 1
            if re.match(r"^(image-0|thumb)\.", o["name"]):
                first_bytes += size
            else:
                other_bytes += size
    n = max(1, len(sample))
    scale = len(folders) / n
    out = {
        "folders_in_bucket": len(folders),
        "sampled_folders": len(sample),
        "avg_files_per_folder": round(files / n, 1),
        "avg_first_photo_kb": round(first_bytes / n / 1024, 1),
        "avg_other_photos_mb_per_folder": round(other_bytes / n / 1048576, 2),
        "estimated_total_gb": round((first_bytes + other_bytes) * scale / 1024 ** 3, 1),
        "estimated_extra_photos_gb": round(other_bytes * scale / 1024 ** 3, 1),
        "estimated_first_photos_gb": round(first_bytes * scale / 1024 ** 3, 2),
    }
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 80)

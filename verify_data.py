"""Quick script to verify Supabase data has all required fields."""
import os
from supabase import create_client

# Get environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch recent listings
response = client.table("listings").select("*").limit(5).execute()

print(f"\nFetched {len(response.data)} sample listings from Supabase:\n")
print("=" * 100)

for i, listing in enumerate(response.data, 1):
    print(f"\n{i}. {listing.get('title', 'NO TITLE')[:60]}")
    print(f"   Source: {listing.get('source')}")
    print(f"   Bedrooms: {listing.get('bedrooms', 'MISSING')}")
    print(f"   Bathrooms: {listing.get('bathrooms', 'MISSING')}")
    print(f"   Area (sqm): {listing.get('area_sqm', 'MISSING')}")
    print(f"   Price: ${listing.get('price_usd', 'MISSING'):,}" if listing.get('price_usd') else "   Price: MISSING")
    print(f"   Images: {len(listing.get('image_urls', [])) if listing.get('image_urls') else 0} image(s)")
    if listing.get('image_urls') and len(listing.get('image_urls')) > 0:
        print(f"   Sample image: {listing['image_urls'][0][:80]}...")
    print(f"   Active: {listing.get('active')}")

print("\n" + "=" * 100)

# Summary statistics
total = client.table("listings").select("id", count="exact").execute()
with_bedrooms = client.table("listings").select("id", count="exact").not_.is_("bedrooms", "null").execute()
with_bathrooms = client.table("listings").select("id", count="exact").not_.is_("bathrooms", "null").execute()
with_area = client.table("listings").select("id", count="exact").not_.is_("area_sqm", "null").execute()
with_images = client.table("listings").select("id", count="exact").not_.is_("image_urls", "null").execute()

print(f"\nDatabase Summary:")
print(f"  Total listings: {total.count}")
print(f"  With bedrooms: {with_bedrooms.count} ({with_bedrooms.count/total.count*100:.1f}%)")
print(f"  With bathrooms: {with_bathrooms.count} ({with_bathrooms.count/total.count*100:.1f}%)")
print(f"  With area: {with_area.count} ({with_area.count/total.count*100:.1f}%)")
print(f"  With images: {with_images.count} ({with_images.count/total.count*100:.1f}%)")
print()

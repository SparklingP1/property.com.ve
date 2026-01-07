#!/usr/bin/env python3
"""Test script to verify agent_office extraction from Rent-A-House."""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from scraper.run import PropertyScraper

def test_agent_office_extraction():
    """Test the agent_office field extraction."""
    print("🧪 Testing agent_office extraction\n")
    print("=" * 80)

    # Sample Rent-A-House listing
    test_url = "https://rentahouse.com.ve/apartamento_en_venta_en_caracas_en_cumbres-de-curumo_rah-26-11502.html"

    print(f"\n📄 Test URL: {test_url}\n")

    scraper = PropertyScraper()

    try:
        # Parse the listing
        print("⏳ Fetching and parsing listing...")
        result = scraper._parse_rentahouse_listing(test_url, "https://rentahouse.com.ve")

        print("\n✅ Extraction completed!\n")
        print("-" * 80)
        print("\n📊 EXTRACTED DATA:\n")

        # Key fields to display
        fields_to_check = [
            'title',
            'agent_name',
            'agent_office',  # ⭐ The field we're testing
            'reference_code',
            'property_type',
            'city',
            'state',
            'price',
            'currency',
        ]

        for field in fields_to_check:
            value = result.get(field, '❌ NOT FOUND')
            if field == 'agent_office':
                print(f"⭐ {field}: {value}")
            else:
                print(f"   {field}: {value}")

        print("\n" + "-" * 80)

        # Verdict
        if result.get('agent_office'):
            print("\n✅ SUCCESS: agent_office field is now being extracted!")
            print(f"   Value: {result['agent_office']}")
        else:
            print("\n❌ FAILURE: agent_office field is still missing")
            print("   This may indicate the HTML structure has changed.")

        print("\n" + "=" * 80)

    except Exception as e:
        print(f"\n❌ Error during extraction: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_agent_office_extraction()

#!/usr/bin/env python3
"""
AI-powered translation service for property listings.
Translates Spanish property listings to natural English for international buyers.
Uses Google Gemini 2.0 Flash-Lite for cost-effective, high-quality translation.
"""

import os
import logging
from typing import Dict, List, Optional
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class PropertyTranslator:
    """Translates property listings from Spanish to English using Google Gemini."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash-lite"):
        """Initialize the translator.

        Args:
            api_key: Google AI API key (defaults to GEMINI_API_KEY env var)
            model: Gemini model to use (gemini-2.0-flash-lite is most cost-effective)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Google Gemini API key required (GEMINI_API_KEY env var)")

        # Configure Gemini
        genai.configure(api_key=self.api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(model)

        logger.info(f"✅ Initialized PropertyTranslator with {model}")
        logger.info(f"💰 Cost: $0.07/1M input, $0.30/1M output tokens")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def translate_listing(self, listing_data: Dict) -> Dict:
        """Translate a property listing from Spanish to English.

        Args:
            listing_data: Dictionary with Spanish property data

        Returns:
            Dictionary with English translations added
        """
        # Extract fields to translate
        title_es = listing_data.get('title', '')
        desc_short_es = listing_data.get('description_short', '')
        desc_full_es = listing_data.get('description_full', '')

        # Skip if no content to translate
        if not title_es:
            logger.warning("No title to translate, skipping")
            return listing_data

        # Build translation prompt
        prompt = self._build_translation_prompt(title_es, desc_short_es, desc_full_es)

        try:
            # Call Gemini API
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.3,  # Lower for more consistent translations
                    "max_output_tokens": 1000,
                }
            )

            # Parse response
            translation = response.text
            parsed = self._parse_translation(translation)

            # Add English translations to listing data
            listing_data['title_en'] = parsed.get('title', title_es)
            listing_data['description_short_en'] = parsed.get('description_short', desc_short_es)
            listing_data['description_full_en'] = parsed.get('description_full', desc_full_es)

            # Preserve Spanish originals
            listing_data['title_es'] = title_es
            listing_data['description_short_es'] = desc_short_es
            listing_data['description_full_es'] = desc_full_es

            # Add metadata
            listing_data['translation_model'] = self.model_name

            logger.info(f"✅ Translated: {title_es[:50]}... → {parsed.get('title', '')[:50]}...")
            return listing_data

        except Exception as e:
            logger.error(f"Translation failed: {e}")
            # Fallback: Use Spanish as-is
            listing_data['title_en'] = title_es
            listing_data['description_short_en'] = desc_short_es
            listing_data['description_full_en'] = desc_full_es
            return listing_data

    def _build_translation_prompt(
        self,
        title: str,
        desc_short: str,
        desc_full: str
    ) -> str:
        """Build the translation prompt for Gemini."""
        prompt = f"""You are a professional real estate copywriter specializing in translating Venezuelan property listings for English-speaking international buyers.

Translate and lightly rewrite to sound natural and appealing while maintaining accuracy.

**TITLE (Spanish):**
{title}

**SHORT DESCRIPTION (Spanish):**
{desc_short or 'N/A'}

**FULL DESCRIPTION (Spanish):**
{desc_full or 'N/A'}

**INSTRUCTIONS:**
1. Translate the title to clear, descriptive English (e.g., "3-Bedroom Apartment in Caracas")
2. Translate the short description (keep under 200 characters)
3. Translate the full description, rewriting slightly to sound natural in English
4. Keep location names as proper nouns (Caracas, Distrito Metropolitano, etc.)
5. Keep measurements in m² (already metric)
6. Use US real estate terminology where appropriate
7. Maintain all factual information accurately

**OUTPUT FORMAT (return exactly this structure):**
TITLE_EN: [translated title]
DESC_SHORT_EN: [translated short description]
DESC_FULL_EN: [translated full description]"""

        return prompt

    def _parse_translation(self, response: str) -> Dict[str, str]:
        """Parse the Gemini response into structured fields."""
        result = {}

        lines = response.strip().split('\n')
        current_field = None
        current_content = []

        for line in lines:
            if line.startswith('TITLE_EN:'):
                if current_field:
                    result[current_field] = '\n'.join(current_content).strip()
                current_field = 'title'
                current_content = [line.replace('TITLE_EN:', '').strip()]
            elif line.startswith('DESC_SHORT_EN:'):
                if current_field:
                    result[current_field] = '\n'.join(current_content).strip()
                current_field = 'description_short'
                current_content = [line.replace('DESC_SHORT_EN:', '').strip()]
            elif line.startswith('DESC_FULL_EN:'):
                if current_field:
                    result[current_field] = '\n'.join(current_content).strip()
                current_field = 'description_full'
                current_content = [line.replace('DESC_FULL_EN:', '').strip()]
            elif current_field:
                current_content.append(line)

        # Add last field
        if current_field:
            result[current_field] = '\n'.join(current_content).strip()

        return result

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def translate_amenities(self, amenities_es: List[str]) -> List[str]:
        """Translate amenity list from Spanish to English.

        Args:
            amenities_es: List of Spanish amenity terms

        Returns:
            List of English amenity terms
        """
        if not amenities_es:
            return []

        # Simple mapping for common amenities (fast path)
        amenity_map = {
            'piscina': 'pool',
            'gym': 'gym',
            'gimnasio': 'gym',
            'seguridad': 'security',
            'portero': 'concierge',
            'elevador': 'elevator',
            'ascensor': 'elevator',
            'estacionamiento': 'parking',
            'parque infantil': 'playground',
            'salon de fiestas': 'party_room',
            'salón de fiestas': 'party_room',
            'cancha deportiva': 'sports_court',
        }

        translated = []
        for amenity in amenities_es:
            amenity_lower = amenity.lower()
            if amenity_lower in amenity_map:
                translated.append(amenity_map[amenity_lower])
            else:
                # Keep as-is if not in map (many are already English-like)
                translated.append(amenity)

        return list(set(translated))  # Remove duplicates


# Convenience function for standalone usage
def translate_listing(listing_data: Dict, api_key: Optional[str] = None) -> Dict:
    """Translate a single listing (convenience function).

    Args:
        listing_data: Dictionary with Spanish property data
        api_key: Google Gemini API key (optional)

    Returns:
        Dictionary with English translations added
    """
    translator = PropertyTranslator(api_key=api_key)
    return translator.translate_listing(listing_data)

/**
 * Generate SEO content using Claude API
 * Creates human-like, natural descriptions for programmatic landing pages
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SEOPageFilters } from './seo-url-parser';
import { getPageTitle } from './seo-url-parser';

export interface GeneratedSEOContent {
  h1: string;
  description: string;  // 2-3 sentences
  meta_title: string;
  meta_description: string;
  keywords: string[];
}

/**
 * Generate SEO content for a specific page using Claude API
 */
export async function generateSEOContent(
  filters: SEOPageFilters,
  listingCount: number,
  apiKey: string
): Promise<GeneratedSEOContent> {
  const anthropic = new Anthropic({
    apiKey,
  });

  // Build context for Claude
  const pageTitle = getPageTitle(filters);
  const location = filters.city || filters.state || 'Venezuela';
  const propertyType = filters.property_type || 'property';
  const bedrooms = filters.bedrooms ? `${filters.bedrooms}-bedroom ` : '';

  const prompt = `You are writing SEO-optimized content for a real estate listing website in Venezuela called Property.com.ve.

Generate unique, natural-sounding content for this landing page:
- Page focus: ${pageTitle}
- Current listings: ${listingCount}
- Property type: ${bedrooms}${propertyType}
- Location: ${location}

Requirements:
1. Write 2-3 sentences that are informative, engaging, and SEO-friendly
2. Sound human and natural (NOT robotic or overly promotional)
3. Include local context about ${location} if relevant
4. Mention the property type naturally
5. Keep it conversational and helpful
6. Write in English
7. Do NOT use emojis or special characters
8. Do NOT use phrases like "discover" or "your dream property" - be more subtle

Return your response in this exact JSON format:
{
  "h1": "A compelling H1 heading (5-8 words)",
  "description": "2-3 natural, informative sentences about these properties and the area",
  "meta_title": "SEO title tag (50-60 characters)",
  "meta_description": "SEO meta description (140-155 characters)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Make each piece of content unique and valuable. Avoid generic phrases.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',  // Claude Sonnet 4.5 - Latest and best
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response as JSON');
    }

    const parsed: GeneratedSEOContent = JSON.parse(jsonMatch[0]);

    // Validate response
    if (!parsed.h1 || !parsed.description || !parsed.meta_title || !parsed.meta_description || !parsed.keywords) {
      throw new Error('Incomplete response from Claude API');
    }

    return parsed;
  } catch (error) {
    console.error('Error generating SEO content:', error);

    // Fallback to template-based content if API fails
    return generateFallbackContent(filters, listingCount);
  }
}

/**
 * Generate fallback content when Claude API is unavailable
 */
function generateFallbackContent(
  filters: SEOPageFilters,
  listingCount: number
): GeneratedSEOContent {
  const pageTitle = getPageTitle(filters);
  const location = filters.city || filters.state || 'Venezuela';
  const propertyType = filters.property_type || 'properties';
  const bedroomText = filters.bedrooms ? `${filters.bedrooms}-bedroom ` : '';

  const h1 = pageTitle;

  const description =
    listingCount > 0
      ? `Browse ${listingCount} ${bedroomText}${propertyType} currently available in ${location}. ` +
        `Our listings include detailed property information, photos, and pricing. ` +
        `Find the right ${propertyType} for your needs in ${location}.`
      : `Explore ${bedroomText}${propertyType} in ${location} on Property.com.ve. ` +
        `We regularly update our listings with new properties. ` +
        `Save your search and get notified when new ${propertyType} become available.`;

  const meta_title = `${pageTitle} | Property.com.ve`;

  const meta_description =
    listingCount > 0
      ? `Browse ${listingCount} ${bedroomText}${propertyType} for sale in ${location}. View photos, prices, and details on Property.com.ve.`
      : `Find ${bedroomText}${propertyType} for sale in ${location}. New listings added regularly on Property.com.ve.`;

  const keywords = [
    `${propertyType} ${location}`,
    `${location} real estate`,
    `${propertyType} for sale ${location}`,
    bedroomText ? `${bedroomText}${propertyType} ${location}` : '',
    `Venezuela ${propertyType}`,
  ].filter(Boolean);

  return {
    h1,
    description,
    meta_title,
    meta_description,
    keywords,
  };
}

/**
 * Batch generate content for multiple pages
 * Includes rate limiting to avoid API throttling
 */
export async function batchGenerateSEOContent(
  pages: Array<{ filters: SEOPageFilters; listing_count: number; slug: string }>,
  apiKey: string,
  onProgress?: (current: number, total: number, slug: string) => void
): Promise<Array<{ slug: string; content: GeneratedSEOContent }>> {
  const results: Array<{ slug: string; content: GeneratedSEOContent }> = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (onProgress) {
      onProgress(i + 1, pages.length, page.slug);
    }

    const content = await generateSEOContent(
      page.filters,
      page.listing_count,
      apiKey
    );

    results.push({
      slug: page.slug,
      content,
    });

    // Rate limiting: Wait 1 second between requests to avoid throttling
    if (i < pages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'land'
  | 'commercial'
  | 'office'
  | 'building'
  | 'annex';

export type Currency = 'USD' | 'VES' | 'EUR';

export type TransactionType = 'sale' | 'rent';

export interface Listing {
  id: string;
  source: string;
  source_url: string;
  title: string;
  price: number | null;
  currency: Currency;
  location: string | null;
  region: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  thumbnail_url: string | null;
  image_urls: string[] | null;
  description_short: string | null;
  description_full: string | null;
  property_type: PropertyType | null;
  scraped_at: string;
  last_seen_at: string;
  active: boolean;
  created_at: string;

  // Enhanced fields (Rent-A-House and others)
  parking_spaces: number | null;
  condition: string | null;
  furnished: boolean | null;
  transaction_type: TransactionType | null;
  property_style: string | null;
  city: string | null;
  neighborhood: string | null;
  state: string | null;
  total_area_sqm: number | null;
  land_area_sqm: number | null;
  amenities: string[] | null;
  features: Record<string, any> | null;
  agent_name: string | null;
  agent_office: string | null;
  reference_code: string | null;
  photo_count: number | null;

  // English translations (for international buyers)
  title_en: string | null;
  description_short_en: string | null;
  description_full_en: string | null;

  // Spanish originals (preserved for reference)
  title_es: string | null;
  description_short_es: string | null;
  description_full_es: string | null;

  // Translation metadata
  translation_model: string | null;
  translated_at: string | null;
}

export interface ListingFilters {
  region?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  search?: string;
}

export interface BuyerLead {
  id?: string;
  email: string;
  budget_min?: number;
  budget_max?: number;
  location_preference?: string;
  property_type?: string;
  notes?: string;
  created_at?: string;
}

export interface AgentSignup {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  agency?: string;
  message?: string;
  created_at?: string;
}

export interface Subscriber {
  id?: string;
  email: string;
  created_at?: string;
}

export interface TakedownRequest {
  id?: string;
  email: string;
  listing_url: string;
  reason?: string;
  created_at?: string;
}

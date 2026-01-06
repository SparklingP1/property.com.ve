export type PropertyType =
  | 'apartment'
  | 'house'
  | 'land'
  | 'commercial'
  | 'office';

export type Currency = 'USD' | 'VES' | 'EUR';

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
  description_short: string | null;
  property_type: PropertyType | null;
  scraped_at: string;
  last_seen_at: string;
  active: boolean;
  created_at: string;
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

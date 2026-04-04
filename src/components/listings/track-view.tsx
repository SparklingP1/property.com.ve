'use client';

import { useEffect } from 'react';
import { trackRecentlyViewed } from '@/actions/properties';

interface TrackViewProps {
  listingId: string;
}

export function TrackView({ listingId }: TrackViewProps) {
  useEffect(() => {
    trackRecentlyViewed(listingId);
  }, [listingId]);

  return null;
}

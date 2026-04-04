'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveProperty, unsaveProperty } from '@/actions/properties';
import type { User } from '@supabase/supabase-js';

interface SaveButtonProps {
  listingId: string;
  size?: 'sm' | 'md';
}

export function SaveButton({ listingId, size = 'sm' }: SaveButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from('saved_properties')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
          .maybeSingle()
          .then(({ data }) => {
            setSaved(!!data);
          });
      }
    });
  }, [listingId]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push(`/register?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoading(true);
    if (saved) {
      const result = await unsaveProperty(listingId);
      setSaved(result.saved);
    } else {
      const result = await saveProperty(listingId);
      setSaved(result.saved);
    }
    setLoading(false);
  };

  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const buttonSize = size === 'md' ? 'w-10 h-10' : 'w-8 h-8';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${buttonSize} rounded-full flex items-center justify-center transition-all ${
        saved
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'bg-white/90 text-stone-600 hover:bg-white hover:text-red-500'
      } shadow-sm backdrop-blur-sm cursor-pointer`}
      aria-label={saved ? 'Unsave property' : 'Save property'}
    >
      <Heart
        className={`${iconSize} ${saved ? 'fill-current' : ''} ${loading ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}

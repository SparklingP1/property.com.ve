'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveProperty, unsaveProperty } from '@/actions/properties';
import type { User } from '@supabase/supabase-js';

interface SaveButtonProps {
  listingId: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SaveButton({ listingId, size = 'sm' }: SaveButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations('listing');

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

  // Large variant — pill button with text (for listing detail sidebar)
  if (size === 'lg') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
          saved
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 hover:text-red-500'
        }`}
        aria-label={saved ? t('unsave') : t('save')}
      >
        <Heart
          className={`h-4 w-4 ${saved ? 'fill-current' : ''} ${loading ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
        {saved ? t('saved') : t('save')}
      </button>
    );
  }

  // Icon-only variants
  const config = size === 'md'
    ? { icon: 'h-5 w-5', button: 'w-11 h-11' }
    : { icon: 'h-4 w-4', button: 'w-8 h-8' };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${config.button} rounded-full flex items-center justify-center transition-all ${
        saved
          ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
          : 'bg-white/90 text-stone-500 hover:bg-white hover:text-red-500 hover:shadow-md'
      } shadow-sm backdrop-blur-sm cursor-pointer`}
      aria-label={saved ? t('unsave') : t('saveToFavourites')}
      title={saved ? t('unsave') : t('saveToFavourites')}
    >
      <Heart
        className={`${config.icon} ${saved ? 'fill-current' : ''} ${loading ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function SaveSearchButton() {
  const [user, setUser] = useState<User | null>(null);
  const searchParams = useSearchParams();
  const t = useTranslations('alerts');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const hasFilters = Array.from(searchParams.entries()).some(
    ([key]) => !['sort', 'page'].includes(key) && searchParams.get(key)
  );

  if (!hasFilters) return null;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('sort');
    params.delete('page');

    if (user) {
      router.push(`/dashboard/alerts/new?${params.toString()}`);
    } else {
      const redirectUrl = `/dashboard/alerts/new?${params.toString()}`;
      router.push(`/register?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className="border-primary text-primary hover:bg-primary-50"
    >
      <Bell className="h-4 w-4 mr-2" aria-hidden="true" />
      {t('saveThisSearch')}
    </Button>
  );
}

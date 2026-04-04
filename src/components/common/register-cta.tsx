'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User } from '@supabase/supabase-js';

interface RegisterCTAProps {
  location?: string;
  variant?: 'default' | 'compact';
}

export function RegisterCTA({ location, variant = 'default' }: RegisterCTAProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('cta');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  // Don't show CTA to logged-in users or while loading
  if (loading || user) return null;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-5 py-4">
        <Bell className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
        <p className="text-sm text-stone-700 flex-1">
          {location ? t('alertsForLocation', { location }) : t('alertsGeneric')}
        </p>
        <Link href="/register">
          <Button size="sm" className="bg-primary hover:bg-primary-700 text-sm font-semibold shrink-0">
            {t('signUp')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 text-center">
      <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-4">
        <Bell className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
      <h3 className="font-bold text-lg text-foreground mb-2">
        {location ? t('trackLocation', { location }) : t('trackGeneric')}
      </h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
        {t('description')}
      </p>
      <Link href="/register">
        <Button className="bg-primary hover:bg-primary-700 font-semibold px-8">
          {t('createAccount')}
        </Button>
      </Link>
    </div>
  );
}

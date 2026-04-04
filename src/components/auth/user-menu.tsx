'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { User, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function UserMenu() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('auth');

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  if (loading) {
    return <div className="w-20 h-8" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-base font-medium text-stone-600 hover:text-foreground transition-colors"
        >
          {t('logIn')}
        </Link>
        <Link href="/register">
          <Button className="bg-primary hover:bg-primary-700 text-sm font-semibold px-5 py-2 h-auto rounded-lg">
            {t('register')}
          </Button>
        </Link>
      </div>
    );
  }

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    window.location.href = '/';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-stone-50"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        <User className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline max-w-[120px] truncate">{user.email}</span>
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-50">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            {t('dashboard')}
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors w-full text-left"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('logOut')}
          </button>
        </div>
      )}
    </div>
  );
}

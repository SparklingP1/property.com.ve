import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { Bell, Plus, TrendingUp, Heart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertList } from '@/components/dashboard/alert-list';
import { ListingGrid } from '@/components/listings/listing-grid';
import type { Listing } from '@/types/listing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();

  const [
    { data: alerts },
    { data: savedRows },
    { data: viewedRows },
  ] = await Promise.all([
    supabase
      .from('property_alerts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('saved_properties')
      .select('listing_id, listings(*)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('recently_viewed')
      .select('listing_id, listings(*)')
      .eq('user_id', user!.id)
      .order('viewed_at', { ascending: false })
      .limit(6),
  ]);

  const activeCount = alerts?.filter((a) => a.is_active).length ?? 0;
  const totalMatches = alerts?.reduce((sum, a) => sum + (a.match_count || 0), 0) ?? 0;
  const savedListings = (savedRows?.map((r) => r.listings).filter(Boolean) ?? []) as unknown as Listing[];
  const viewedListings = (viewedRows?.map((r) => r.listings).filter(Boolean) ?? []) as unknown as Listing[];
  const savedCount = savedListings.length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{user?.email}</p>
        </div>
        <Link href="/dashboard/alerts/new">
          <Button className="bg-primary hover:bg-primary-700">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Create Alert
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Alerts</p>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saved Properties</p>
              <p className="text-2xl font-bold text-foreground">{savedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Matches</p>
              <p className="text-2xl font-bold text-foreground">{totalMatches}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Properties */}
      {savedListings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Saved Properties</h2>
          </div>
          <ListingGrid listings={savedListings} />
        </section>
      )}

      {/* Recently Viewed */}
      {viewedListings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-stone-400" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Recently Viewed</h2>
          </div>
          <ListingGrid listings={viewedListings} />
        </section>
      )}

      <AlertList alerts={alerts ?? []} />
    </div>
  );
}

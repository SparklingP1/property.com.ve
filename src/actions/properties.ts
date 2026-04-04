'use server';

import { createClient, getUser } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function saveProperty(listingId: string): Promise<{ saved: boolean }> {
  const user = await getUser();
  if (!user) return { saved: false };

  const supabase = await createClient();
  await supabase
    .from('saved_properties')
    .insert({ user_id: user.id, listing_id: listingId });

  revalidatePath('/dashboard');
  return { saved: true };
}

export async function unsaveProperty(listingId: string): Promise<{ saved: boolean }> {
  const user = await getUser();
  if (!user) return { saved: false };

  const supabase = await createClient();
  await supabase
    .from('saved_properties')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', listingId);

  revalidatePath('/dashboard');
  return { saved: false };
}

export async function trackRecentlyViewed(listingId: string): Promise<void> {
  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase
    .from('recently_viewed')
    .upsert(
      { user_id: user.id, listing_id: listingId, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,listing_id' }
    );
}

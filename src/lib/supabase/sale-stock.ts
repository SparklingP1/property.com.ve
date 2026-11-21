/**
 * The one definition of "listings we show as for-sale stock" (server only).
 *
 *   active = true AND transaction_type = 'sale' [AND duplicate_of IS NULL]
 *
 * transaction_type: rentals are stored (docs/data-contract.md) and will be
 * flipped active once rental pages exist; every sale-stock query must filter
 * on it so that flip cannot leak rentals into sale pages, counts or sitemaps.
 *
 * duplicate_of: added by migration 022. Before it is applied the column does
 * not exist and filtering on it would make PostgREST answer 400, so we probe
 * for it once an hour and only add the filter when it exists.
 */
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from './server';

/** True once migration 022 (listings.duplicate_of) is applied. Cached 1 h. */
export const hasDuplicateOfColumn = cache(
  unstable_cache(
    async (): Promise<boolean> => {
      const { error } = await createServiceClient().from('listings').select('duplicate_of').limit(1);
      if (!error) return true;
      // 42703 = undefined column: migration 022 not applied yet.
      if (error.code === '42703') return false;
      // Anything else (outage, timeout): throw so nothing is cached for an hour.
      throw new Error(`sale-stock probe: ${error.code ?? ''} ${error.message}`);
    },
    ['schema-has-duplicate-of-v1'],
    { revalidate: 3600, tags: ['schema'] }
  )
);

// Supabase query builders are awkward to type generically; keep it local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filterable = { eq: any; is: any };

/** Adds the sale-stock filters to a listings query. */
export function saleStock<Q extends Filterable>(
  query: Q,
  options: { excludeDuplicates: boolean; transactionType?: 'sale' | 'rent' }
): Q {
  let q = query.eq('active', true).eq('transaction_type', options.transactionType || 'sale');
  if (options.excludeDuplicates) q = q.is('duplicate_of', null);
  return q;
}

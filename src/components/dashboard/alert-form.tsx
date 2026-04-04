'use client';

import { useActionState, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createAlert, updateAlert, type FormState } from '@/actions/alerts';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AlertFormProps {
  mode: 'create' | 'edit';
  alertId?: string;
  initialName?: string;
  initialCriteria?: Record<string, string>;
}

const initialState: FormState = {
  success: false,
  message: '',
};

const PROPERTY_TYPES = [
  { value: 'apartment', labelKey: 'apartment' },
  { value: 'house', labelKey: 'house' },
  { value: 'land', labelKey: 'land' },
  { value: 'commercial', labelKey: 'commercial' },
  { value: 'office', labelKey: 'office' },
];

interface AvailableLocationRow {
  state?: string | null;
  city?: string | null;
}

export function AlertForm({ mode, alertId, initialName = '', initialCriteria = {} }: AlertFormProps) {
  const t = useTranslations('alerts');
  const tSearch = useTranslations('search');
  const tListing = useTranslations('listing');
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialCriteria.type || '');
  const [transaction, setTransaction] = useState(initialCriteria.transaction || '');
  const [state, setState] = useState(initialCriteria.state || '');
  const [city, setCity] = useState(initialCriteria.city || '');
  const [minPrice, setMinPrice] = useState(initialCriteria.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initialCriteria.maxPrice || '');
  const [bedrooms, setBedrooms] = useState(initialCriteria.bedrooms || '');
  const [bathrooms, setBathrooms] = useState(initialCriteria.bathrooms || '');
  const [parking, setParking] = useState(initialCriteria.parking || '');
  const [minArea, setMinArea] = useState(initialCriteria.minArea || '');
  const [maxArea, setMaxArea] = useState(initialCriteria.maxArea || '');
  const [furnished, setFurnished] = useState(initialCriteria.furnished || '');

  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('listings')
      .select('state, city')
      .eq('active', true)
      .not('state', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        const rows = data as AvailableLocationRow[];
        const uniqueStates = [...new Set(rows.map((r) => r.state).filter(Boolean))] as string[];
        setStates(uniqueStates.sort());
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!state || state === 'all') {
      // Use microtask to avoid synchronous setState in effect body
      queueMicrotask(() => { if (!cancelled) setCities([]); });
      return () => { cancelled = true; };
    }
    const supabase = createClient();
    supabase
      .from('listings')
      .select('city')
      .eq('active', true)
      .eq('state', state)
      .not('city', 'is', null)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const rows = data as { city?: string | null }[];
        const uniqueCities = [...new Set(rows.map((r) => r.city).filter(Boolean))] as string[];
        setCities(uniqueCities.sort());
      });
    return () => { cancelled = true; };
  }, [state]);

  const buildCriteria = () => {
    const criteria: Record<string, string> = {};
    if (type) criteria.type = type;
    if (transaction) criteria.transaction = transaction;
    if (state) criteria.state = state;
    if (city) criteria.city = city;
    if (minPrice) criteria.minPrice = minPrice;
    if (maxPrice) criteria.maxPrice = maxPrice;
    if (bedrooms) criteria.bedrooms = bedrooms;
    if (bathrooms) criteria.bathrooms = bathrooms;
    if (parking) criteria.parking = parking;
    if (minArea) criteria.minArea = minArea;
    if (maxArea) criteria.maxArea = maxArea;
    if (furnished) criteria.furnished = furnished;
    return criteria;
  };

  const action = mode === 'create' ? createAlert : updateAlert;

  const wrappedAction = async (prevState: FormState, formData: FormData) => {
    formData.set('criteria', JSON.stringify(buildCriteria()));
    if (alertId) formData.set('alertId', alertId);
    const result = await action(prevState, formData);
    if (result.success) {
      router.push('/dashboard');
      router.refresh();
    }
    return result;
  };

  const [formState, formAction, isPending] = useActionState(wrappedAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="name">{t('alertName')}</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('alertNamePlaceholder')}
          required
          className="mt-1"
        />
        {formState.errors?.name && (
          <p className="text-sm text-red-500 mt-1" role="alert">{formState.errors.name[0]}</p>
        )}
      </div>

      <div className="bg-stone-50 rounded-xl p-6 space-y-4">
        <h3 className="font-medium text-foreground">{t('criteria')}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{tSearch('transactionType')}</Label>
            <Select value={transaction} onValueChange={setTransaction}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('any')}</SelectItem>
                <SelectItem value="sale">{tListing('forSale')}</SelectItem>
                <SelectItem value="rent">{tListing('forRent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('propertyType')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('anyType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('anyType')}</SelectItem>
                {PROPERTY_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {tListing(pt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('state')}</Label>
            <Select value={state} onValueChange={(val) => { setState(val); setCity(''); }}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('anyState')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('allStates')}</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('city')}</Label>
            <Select value={city} onValueChange={setCity} disabled={!state || state === 'all'}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('anyCity')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('allCities')}</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('priceUSD')} ({tSearch('min')})</Label>
            <Input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="50000"
              className="mt-1 bg-white"
            />
          </div>

          <div>
            <Label>{tSearch('priceUSD')} ({tSearch('max')})</Label>
            <Input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="200000"
              className="mt-1 bg-white"
            />
          </div>

          <div>
            <Label>{tSearch('areaM2')} ({tSearch('min')})</Label>
            <Input
              type="number"
              value={minArea}
              onChange={(e) => setMinArea(e.target.value)}
              placeholder="50"
              className="mt-1 bg-white"
            />
          </div>

          <div>
            <Label>{tSearch('areaM2')} ({tSearch('max')})</Label>
            <Input
              type="number"
              value={maxArea}
              onChange={(e) => setMaxArea(e.target.value)}
              placeholder="250"
              className="mt-1 bg-white"
            />
          </div>

          <div>
            <Label>{tSearch('bedrooms')}</Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('any')}</SelectItem>
                {['1', '2', '3', '4', '5'].map((n) => (
                  <SelectItem key={n} value={n}>{n}+</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('bathrooms')}</Label>
            <Select value={bathrooms} onValueChange={setBathrooms}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('any')}</SelectItem>
                {['1', '2', '3', '4'].map((n) => (
                  <SelectItem key={n} value={n}>{n}+</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('parkingSpaces')}</Label>
            <Select value={parking} onValueChange={setParking}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('any')}</SelectItem>
                {['1', '2', '3'].map((n) => (
                  <SelectItem key={n} value={n}>{n}+</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tSearch('furnished')}</Label>
            <Select value={furnished} onValueChange={setFurnished}>
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder={tSearch('any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tSearch('any')}</SelectItem>
                <SelectItem value="true">{tSearch('furnishedYes')}</SelectItem>
                <SelectItem value="false">{tSearch('furnishedNo')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <input type="hidden" name="criteria" value="" />

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary hover:bg-primary-700"
      >
        {isPending
          ? (mode === 'create' ? t('saving') : t('updating'))
          : (mode === 'create' ? t('save') : t('update'))}
      </Button>

      {formState.message && !formState.success && (
        <p className="text-sm text-red-500 text-center" role="alert" aria-live="assertive">{formState.message}</p>
      )}
    </form>
  );
}

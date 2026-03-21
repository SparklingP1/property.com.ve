'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { submitBuyerLead, type FormState } from '@/actions/leads';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const initialState: FormState = {
  success: false,
  message: '',
};

const regions = [
  'Caracas',
  'Miranda',
  'Zulia',
  'Carabobo',
  'Lara',
  'Aragua',
  'Nueva Esparta',
  'Anzoategui',
  'Bolivar',
  'Any Region',
];

export function BuyerLeadForm() {
  const [state, formAction, isPending] = useActionState(submitBuyerLead, initialState);
  const t = useTranslations('forms');
  const tListing = useTranslations('listing');

  const propertyTypes = [
    { value: 'apartment', label: tListing('apartment') },
    { value: 'house', label: tListing('house') },
    { value: 'land', label: tListing('land') },
    { value: 'commercial', label: tListing('commercial') },
    { value: 'office', label: tListing('office') },
    { value: 'any', label: t('selectPropertyType') },
  ];

  if (state.success) {
    return (
      <div className="bg-primary-50 text-primary-700 p-6 rounded-lg text-center" role="status" aria-live="polite">
        <h3 className="font-semibold text-lg mb-2">{t('thankYou')}</h3>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="email">{t('emailAddress')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          required
          className="mt-1"
          aria-invalid={!!state.errors?.email}
          aria-describedby={state.errors?.email ? 'email-error' : undefined}
        />
        {state.errors?.email && (
          <p id="email-error" className="text-sm text-red-500 mt-1" role="alert">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="budget_min">{t('buyerMinBudget')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
          <Input
            id="budget_min"
            name="budget_min"
            type="number"
            placeholder={t('buyerMinPlaceholder')}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="budget_max">{t('buyerMaxBudget')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
          <Input
            id="budget_max"
            name="budget_max"
            type="number"
            placeholder={t('buyerMaxPlaceholder')}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="location_preference">{t('preferredLocation')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
        <Select name="location_preference">
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('selectRegion')} />
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="property_type">{t('propertyType')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
        <Select name="property_type">
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('selectPropertyType')} />
          </SelectTrigger>
          <SelectContent>
            {propertyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">{t('additionalNotes')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder={t('notesPlaceholder')}
          className="mt-1 min-h-[100px]"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary hover:bg-primary-700"
      >
        {isPending ? t('submitting') : t('submitRequest')}
      </Button>

      {state.message && !state.success && (
        <p className="text-sm text-red-500 text-center" role="alert" aria-live="assertive">{state.message}</p>
      )}
    </form>
  );
}

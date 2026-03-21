'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { submitTakedownRequest, type FormState } from '@/actions/leads';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const initialState: FormState = {
  success: false,
  message: '',
};

export function TakedownForm() {
  const [state, formAction, isPending] = useActionState(submitTakedownRequest, initialState);
  const t = useTranslations('forms');

  if (state.success) {
    return (
      <div className="bg-primary-50 text-primary-700 p-6 rounded-lg text-center">
        <h3 className="font-semibold text-lg mb-2">{t('requestReceived')}</h3>
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
        />
        {state.errors?.email && (
          <p className="text-sm text-red-500 mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="listing_url">{t('takedownListingUrl')}</Label>
        <Input
          id="listing_url"
          name="listing_url"
          type="url"
          placeholder={t('takedownUrlPlaceholder')}
          required
          className="mt-1"
        />
        {state.errors?.listing_url && (
          <p className="text-sm text-red-500 mt-1">{state.errors.listing_url[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="reason">{t('takedownReason')}</Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder={t('takedownReasonPlaceholder')}
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
        <p className="text-sm text-red-500 text-center">{state.message}</p>
      )}
    </form>
  );
}

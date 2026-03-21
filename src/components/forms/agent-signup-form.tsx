'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { submitAgentSignup, type FormState } from '@/actions/leads';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const initialState: FormState = {
  success: false,
  message: '',
};

export function AgentSignupForm() {
  const [state, formAction, isPending] = useActionState(submitAgentSignup, initialState);
  const t = useTranslations('forms');

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
        <Label htmlFor="name">{t('fullName')}</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder={t('namePlaceholder')}
          required
          className="mt-1"
          aria-invalid={!!state.errors?.name}
          aria-describedby={state.errors?.name ? 'name-error' : undefined}
        />
        {state.errors?.name && (
          <p id="name-error" className="text-sm text-red-500 mt-1" role="alert">{state.errors.name[0]}</p>
        )}
      </div>

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

      <div>
        <Label htmlFor="phone">{t('phoneNumber')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder={t('phonePlaceholder')}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="agency">{t('agency')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
        <Input
          id="agency"
          name="agency"
          type="text"
          placeholder={t('agencyPlaceholder')}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="message">{t('message')} <span className="text-muted-foreground font-normal">{t('optional')}</span></Label>
        <Textarea
          id="message"
          name="message"
          placeholder={t('messagePlaceholder')}
          className="mt-1 min-h-[100px]"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary hover:bg-primary-700"
      >
        {isPending ? t('submitting') : t('submitApplication')}
      </Button>

      {state.message && !state.success && (
        <p className="text-sm text-red-500 text-center" role="alert" aria-live="assertive">{state.message}</p>
      )}
    </form>
  );
}

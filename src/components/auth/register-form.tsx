'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { signUp, type FormState } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';

const initialState: FormState = {
  success: false,
  message: '',
};

export function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const [state, formAction, isPending] = useActionState(signUp, initialState);

  if (state.success) {
    return (
      <div className="bg-primary-50 text-primary-700 p-6 rounded-lg text-center" role="status" aria-live="polite">
        <h3 className="font-semibold text-lg mb-2">{t('checkEmail')}</h3>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="email">{t('email')}</Label>
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
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t('passwordPlaceholder')}
          required
          minLength={8}
          className="mt-1"
          aria-invalid={!!state.errors?.password}
          aria-describedby={state.errors?.password ? 'password-error' : undefined}
        />
        {state.errors?.password && (
          <p id="password-error" className="text-sm text-red-500 mt-1" role="alert">{state.errors.password[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder={t('confirmPasswordPlaceholder')}
          required
          minLength={8}
          className="mt-1"
          aria-invalid={!!state.errors?.confirmPassword}
          aria-describedby={state.errors?.confirmPassword ? 'confirm-password-error' : undefined}
        />
        {state.errors?.confirmPassword && (
          <p id="confirm-password-error" className="text-sm text-red-500 mt-1" role="alert">{state.errors.confirmPassword[0]}</p>
        )}
      </div>

      <input type="hidden" name="locale" value={locale} />

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary hover:bg-primary-700"
      >
        {isPending ? t('registering') : t('register')}
      </Button>

      {state.message && !state.success && (
        <p className="text-sm text-red-500 text-center" role="alert" aria-live="assertive">{state.message}</p>
      )}

      <p className="text-sm text-center text-muted-foreground">
        {t('haveAccount')}{' '}
        <Link
          href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
          className="text-primary font-medium hover:underline"
        >
          {t('logInHere')}
        </Link>
      </p>
    </form>
  );
}

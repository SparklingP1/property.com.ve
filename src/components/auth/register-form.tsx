'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { signUp, type FormState } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { Mail, CheckCircle2 } from 'lucide-react';

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
      <div className="text-center py-4" role="status" aria-live="polite">
        <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Mail className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
        <h3 className="font-bold text-lg text-foreground mb-2">{t('checkEmail')}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{state.message}</p>
        <div className="mt-6 flex items-center gap-2 justify-center text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>{t('checkSpam')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="email" className="text-sm font-medium">{t('email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            required
            className="mt-1.5 h-11 rounded-xl"
            aria-invalid={!!state.errors?.email}
            aria-describedby={state.errors?.email ? 'email-error' : undefined}
          />
          {state.errors?.email && (
            <p id="email-error" className="text-sm text-red-500 mt-1" role="alert">{state.errors.email[0]}</p>
          )}
        </div>

        <div>
          <Label htmlFor="password" className="text-sm font-medium">{t('password')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t('passwordPlaceholder')}
            required
            minLength={8}
            className="mt-1.5 h-11 rounded-xl"
            aria-invalid={!!state.errors?.password}
            aria-describedby={state.errors?.password ? 'password-error' : undefined}
          />
          {state.errors?.password && (
            <p id="password-error" className="text-sm text-red-500 mt-1" role="alert">{state.errors.password[0]}</p>
          )}
        </div>

        <input type="hidden" name="confirmPassword" value="" />
        <input type="hidden" name="locale" value={locale} />

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary-700 font-semibold text-sm mt-2"
        >
          {isPending ? t('registering') : t('register')}
        </Button>

        {state.message && !state.success && (
          <p className="text-sm text-red-500 text-center" role="alert" aria-live="assertive">{state.message}</p>
        )}

        <p className="text-sm text-center text-muted-foreground pt-1">
          {t('haveAccount')}{' '}
          <Link
            href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
            className="text-primary font-semibold hover:underline"
          >
            {t('logInHere')}
          </Link>
        </p>
      </form>
    </div>
  );
}

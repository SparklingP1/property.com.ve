'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { signUp, type FormState } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { Separator } from '@/components/ui/separator';
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

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    const redirectUrl = redirectTo
      ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}&locale=${locale}`
      : `${window.location.origin}/auth/callback?locale=${locale}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all text-sm font-medium text-foreground cursor-pointer"
      >
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {t('continueWithGoogle')}
      </button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-stone-400 uppercase tracking-wider">{t('or')}</span>
        <Separator className="flex-1" />
      </div>

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

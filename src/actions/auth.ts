'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from '@/i18n/navigation';
import { z } from 'zod';

export type FormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  locale: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function signUp(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    locale: formData.get('locale') as string || 'es',
  };

  const validatedData = signUpSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: validatedData.data.email,
    password: validatedData.data.password,
    options: {
      data: {
        preferred_locale: validatedData.data.locale,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve'}/auth/callback?locale=${validatedData.data.locale}`,
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return {
        success: false,
        message: 'An account with this email already exists. Please log in instead.',
      };
    }
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: true,
    message: 'Check your email to confirm your account.',
  };
}

export async function signIn(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const validatedData = signInSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: validatedData.data.email,
    password: validatedData.data.password,
  });

  if (error) {
    return {
      success: false,
      message: 'Invalid email or password.',
    };
  }

  return {
    success: true,
    message: 'Logged in successfully.',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: '/', locale: 'es' });
}

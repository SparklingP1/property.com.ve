'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');

export async function subscribeToNewsletter(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  const validatedEmail = emailSchema.safeParse(email);

  if (!validatedEmail.success) {
    return {
      success: false,
      message: 'Please enter a valid email address',
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('subscribers')
    .insert([{ email: validatedEmail.data }]);

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        message: 'This email is already subscribed',
      };
    }
    return {
      success: false,
      message: 'Failed to subscribe. Please try again.',
    };
  }

  return {
    success: true,
    message: 'Thank you for subscribing! You will receive weekly property updates.',
  };
}

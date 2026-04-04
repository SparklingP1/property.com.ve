'use server';

import { createClient, getUser } from '@/lib/supabase/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

export type FormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const alertSchema = z.object({
  name: z.string().min(1, 'Alert name is required').max(100),
  criteria: z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Criteria must be a valid JSON object',
        });
        return z.NEVER;
      }
      return parsed;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid JSON in alert criteria',
      });
      return z.NEVER;
    }
  }),
});

export async function createAlert(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getUser();
  if (!user) {
    return { success: false, message: 'You must be logged in.' };
  }

  const rawData = {
    name: formData.get('name') as string,
    criteria: formData.get('criteria') as string,
  };

  const validatedData = alertSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('property_alerts')
    .insert([{
      user_id: user.id,
      name: validatedData.data.name,
      criteria: validatedData.data.criteria,
    }]);

  if (error) {
    return { success: false, message: 'Failed to create alert. Please try again.' };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Alert created successfully.' };
}

export async function updateAlert(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getUser();
  if (!user) {
    return { success: false, message: 'You must be logged in.' };
  }

  const alertId = formData.get('alertId') as string;
  const rawData = {
    name: formData.get('name') as string,
    criteria: formData.get('criteria') as string,
  };

  const validatedData = alertSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('property_alerts')
    .update({
      name: validatedData.data.name,
      criteria: validatedData.data.criteria,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, message: 'Failed to update alert. Please try again.' };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Alert updated successfully.' };
}

export async function deleteAlert(alertId: string): Promise<FormState> {
  const user = await getUser();
  if (!user) {
    return { success: false, message: 'You must be logged in.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('property_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, message: 'Failed to delete alert.' };
  }

  revalidatePath('/dashboard');
  return { success: true, message: 'Alert deleted.' };
}

export async function toggleAlert(alertId: string, isActive: boolean): Promise<FormState> {
  const user = await getUser();
  if (!user) {
    return { success: false, message: 'You must be logged in.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('property_alerts')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, message: 'Failed to update alert.' };
  }

  revalidatePath('/dashboard');
  return { success: true, message: isActive ? 'Alert resumed.' : 'Alert paused.' };
}

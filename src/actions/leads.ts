'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const buyerLeadSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  location_preference: z.string().optional(),
  property_type: z.string().optional(),
  notes: z.string().optional(),
});

const agentSignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  agency: z.string().optional(),
  message: z.string().optional(),
});

const takedownSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  listing_url: z.string().url('Please enter a valid URL'),
  reason: z.string().optional(),
});

export type FormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export async function submitBuyerLead(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawData = {
    email: formData.get('email') as string,
    budget_min: formData.get('budget_min') ? Number(formData.get('budget_min')) : undefined,
    budget_max: formData.get('budget_max') ? Number(formData.get('budget_max')) : undefined,
    location_preference: formData.get('location_preference') as string || undefined,
    property_type: formData.get('property_type') as string || undefined,
    notes: formData.get('notes') as string || undefined,
  };

  const validatedData = buyerLeadSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('buyer_leads')
    .insert([validatedData.data]);

  if (error) {
    return {
      success: false,
      message: 'Failed to submit. Please try again.',
    };
  }

  return {
    success: true,
    message: 'Thank you! We will connect you with properties matching your criteria.',
  };
}

export async function submitAgentSignup(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string || undefined,
    agency: formData.get('agency') as string || undefined,
    message: formData.get('message') as string || undefined,
  };

  const validatedData = agentSignupSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('agent_signups')
    .insert([validatedData.data]);

  if (error) {
    return {
      success: false,
      message: 'Failed to submit. Please try again.',
    };
  }

  return {
    success: true,
    message: 'Thank you for signing up! We will be in touch soon.',
  };
}

export async function submitTakedownRequest(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const rawData = {
    email: formData.get('email') as string,
    listing_url: formData.get('listing_url') as string,
    reason: formData.get('reason') as string || undefined,
  };

  const validatedData = takedownSchema.safeParse(rawData);

  if (!validatedData.success) {
    return {
      success: false,
      message: 'Please fix the errors below',
      errors: validatedData.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('takedown_requests')
    .insert([validatedData.data]);

  if (error) {
    return {
      success: false,
      message: 'Failed to submit. Please try again.',
    };
  }

  return {
    success: true,
    message: 'Your request has been received. We will remove the listing within 48 hours.',
  };
}

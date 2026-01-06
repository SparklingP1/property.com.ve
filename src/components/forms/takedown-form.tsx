'use client';

import { useActionState } from 'react';
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

  if (state.success) {
    return (
      <div className="bg-primary-50 text-primary-700 p-6 rounded-lg text-center">
        <h3 className="font-semibold text-lg mb-2">Request Received</h3>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="email">Your Email Address *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          required
          className="mt-1"
        />
        {state.errors?.email && (
          <p className="text-sm text-red-500 mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="listing_url">Listing URL *</Label>
        <Input
          id="listing_url"
          name="listing_url"
          type="url"
          placeholder="https://property.com.ve/listing/..."
          required
          className="mt-1"
        />
        {state.errors?.listing_url && (
          <p className="text-sm text-red-500 mt-1">{state.errors.listing_url[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="reason">Reason for Takedown Request</Label>
        <Textarea
          id="reason"
          name="reason"
          placeholder="Please explain why you are requesting this listing be removed..."
          className="mt-1 min-h-[100px]"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary hover:bg-primary-700"
      >
        {isPending ? 'Submitting...' : 'Submit Request'}
      </Button>

      {state.message && !state.success && (
        <p className="text-sm text-red-500 text-center">{state.message}</p>
      )}
    </form>
  );
}

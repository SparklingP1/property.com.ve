'use client';

import { useActionState } from 'react';
import { submitBuyerLead, type FormState } from '@/actions/leads';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const initialState: FormState = {
  success: false,
  message: '',
};

const propertyTypes = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'office', label: 'Office' },
  { value: 'any', label: 'Any Type' },
];

const regions = [
  'Caracas',
  'Miranda',
  'Zulia',
  'Carabobo',
  'Lara',
  'Aragua',
  'Nueva Esparta',
  'Anzoategui',
  'Bolivar',
  'Any Region',
];

export function BuyerLeadForm() {
  const [state, formAction, isPending] = useActionState(submitBuyerLead, initialState);

  if (state.success) {
    return (
      <div className="bg-primary-50 text-primary-700 p-6 rounded-lg text-center">
        <h3 className="font-semibold text-lg mb-2">Thank You!</h3>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="email">Email Address *</Label>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="budget_min">Minimum Budget (USD)</Label>
          <Input
            id="budget_min"
            name="budget_min"
            type="number"
            placeholder="50000"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="budget_max">Maximum Budget (USD)</Label>
          <Input
            id="budget_max"
            name="budget_max"
            type="number"
            placeholder="200000"
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="location_preference">Preferred Location</Label>
        <Select name="location_preference">
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="property_type">Property Type</Label>
        <Select name="property_type">
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select property type" />
          </SelectTrigger>
          <SelectContent>
            {propertyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Tell us more about what you're looking for..."
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

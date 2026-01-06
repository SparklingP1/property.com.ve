import { Metadata } from 'next';
import { BuyerLeadForm } from '@/components/forms/buyer-lead-form';

export const metadata: Metadata = {
  title: 'Find Your Property',
  description:
    'Tell us what you are looking for and we will connect you with properties matching your criteria in Venezuela.',
};

export default function FindPropertyPage() {
  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Find Your Perfect Property
          </h1>
          <p className="text-muted-foreground text-lg">
            Tell us what you&apos;re looking for and we&apos;ll connect you with
            properties that match your criteria.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border p-6 md:p-8">
          <BuyerLeadForm />
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Your information is secure and will only be used to help you find
            the right property.
          </p>
        </div>
      </div>
    </div>
  );
}

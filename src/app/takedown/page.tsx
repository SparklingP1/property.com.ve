import { Metadata } from 'next';
import { TakedownForm } from '@/components/forms/takedown-form';

export const metadata: Metadata = {
  title: 'Takedown Request',
  description:
    'Request removal of a property listing from Property.com.ve. We process all requests within 48 hours.',
};

export default function TakedownPage() {
  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Takedown Request
          </h1>
          <p className="text-muted-foreground text-lg">
            If you are the owner of a listing and wish to have it removed from
            our platform, please submit a request below.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border p-6 md:p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-amber-800 mb-2">
              Before You Submit
            </h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>
                We aggregate listings from third-party sources. We do not create
                listings.
              </li>
              <li>
                To permanently remove a listing, contact the original source
                directly.
              </li>
              <li>
                Listings may reappear if they remain active on the source
                website.
              </li>
            </ul>
          </div>

          <TakedownForm />
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            We aim to process all takedown requests within 48 hours. You will
            receive a confirmation email once your request has been processed.
          </p>
        </div>
      </div>
    </div>
  );
}

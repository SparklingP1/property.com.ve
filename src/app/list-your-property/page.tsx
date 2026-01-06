import { Metadata } from 'next';
import { AgentSignupForm } from '@/components/forms/agent-signup-form';
import { CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'List Your Property',
  description:
    'Real estate agents and property owners: List your Venezuelan properties on our platform and reach thousands of potential buyers.',
};

const benefits = [
  'Reach thousands of potential buyers',
  'Your listings aggregated from your source',
  'Increased visibility across Venezuela',
  'Weekly traffic reports',
];

export default function ListPropertyPage() {
  return (
    <div className="container py-12">
      <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
        {/* Left Column - Info */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            List Your Property With Us
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Are you a real estate agent or property owner in Venezuela? Partner
            with us to reach more potential buyers.
          </p>

          <div className="space-y-4 mb-8">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="bg-primary-50 rounded-xl p-6">
            <h3 className="font-semibold mb-2">How It Works</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground text-sm">
              <li>Submit your information using the form</li>
              <li>Our team will review your application</li>
              <li>We&apos;ll add your listings source to our aggregator</li>
              <li>Your properties appear on our platform</li>
            </ol>
          </div>
        </div>

        {/* Right Column - Form */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-border p-6 md:p-8">
            <h2 className="text-xl font-semibold mb-6">Agent Signup</h2>
            <AgentSignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description:
    'Legal disclaimer and terms of use for Property.com.ve property listings aggregator.',
};

export default function DisclaimerPage() {
  return (
    <div className="container py-12">
      <div className="max-w-3xl mx-auto prose prose-neutral">
        <h1>Disclaimer</h1>
        <p className="lead">
          Please read this disclaimer carefully before using Property.com.ve.
        </p>

        <h2>Not a Real Estate Agency</h2>
        <p>
          Property.com.ve is a property listing aggregator, not a real estate
          agency. We do not buy, sell, rent, or manage properties. We simply
          aggregate listings from third-party sources to help users search for
          properties in Venezuela.
        </p>

        <h2>Third-Party Listings</h2>
        <p>
          All property listings displayed on this website are sourced from
          third-party real estate platforms. We do not create, verify, or
          endorse any of the listings. The information displayed is provided by
          the original listing sources.
        </p>

        <h2>Accuracy of Information</h2>
        <p>
          While we strive to display accurate and up-to-date information, we
          cannot guarantee the accuracy, completeness, or reliability of any
          listing information. Property details, prices, availability, and other
          information may change without notice. Always verify information
          directly with the listing agent or property owner.
        </p>

        <h2>Investment Risks</h2>
        <p>
          Real estate investment carries inherent risks. Property values may
          fluctuate, and past performance is not indicative of future results.
          We strongly recommend consulting with qualified professionals,
          including real estate agents, lawyers, and financial advisors, before
          making any property investment decisions.
        </p>

        <h2>No Professional Advice</h2>
        <p>
          Nothing on this website constitutes legal, financial, or investment
          advice. Any decisions made based on information found on this website
          are made at your own risk.
        </p>

        <h2>External Links</h2>
        <p>
          Our website contains links to external websites operated by third
          parties. We have no control over the content or availability of these
          websites and accept no responsibility for them.
        </p>

        <h2>Contact Original Listing</h2>
        <p>
          For accurate, current information about any property, please contact
          the original listing agent or property owner directly through the
          source website. Links to the original listings are provided on each
          property detail page.
        </p>

        <h2>Takedown Requests</h2>
        <p>
          If you are the owner of a listing and wish to have it removed from our
          platform, please submit a{' '}
          <Link href="/takedown" className="text-primary hover:underline">
            takedown request
          </Link>
          . We will process your request within 48 hours.
        </p>

        <h2>Changes to This Disclaimer</h2>
        <p>
          We reserve the right to modify this disclaimer at any time. Changes
          will be effective immediately upon posting to this website.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have any questions about this disclaimer, please contact us
          through our website.
        </p>

        <p className="text-sm text-muted-foreground mt-8">
          Last updated: January 2026
        </p>
      </div>
    </div>
  );
}

import { Metadata } from 'next';
import { Building2, Search, Globe, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Property.com.ve aggregates real estate listings from across Venezuela, making it easy to find your perfect property.',
};

const features = [
  {
    icon: Search,
    title: 'One Search, Every Listing',
    description:
      'Search across multiple real estate platforms in one place. No more jumping between websites.',
  },
  {
    icon: Globe,
    title: 'Nationwide Coverage',
    description:
      'From Caracas to Maracaibo, from the beaches of Margarita to the Andes. We cover all of Venezuela.',
  },
  {
    icon: Building2,
    title: 'All Property Types',
    description:
      'Apartments, houses, land, commercial spaces, and more. Find exactly what you need.',
  },
  {
    icon: Shield,
    title: 'Verified Sources',
    description:
      'We only aggregate from reputable real estate platforms to ensure listing quality.',
  },
];

const sources = [
  { name: 'Green-Acres Venezuela', url: 'https://ve.green-acres.com' },
  { name: 'BienesOnline', url: 'https://venezuela.bienesonline.com' },
];

export default function AboutPage() {
  return (
    <div className="container py-12">
      {/* Hero */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          About Property.com.ve
        </h1>
        <p className="text-muted-foreground text-lg">
          We aggregate real estate listings from across Venezuela, making it
          easier than ever to find your perfect property. One search, every
          listing.
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-white rounded-xl p-6 shadow-sm border border-border"
          >
            <feature.icon className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
            <p className="text-muted-foreground text-sm">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Our Sources */}
      <div className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Our Sources</h2>
        <p className="text-muted-foreground text-center mb-8">
          We currently aggregate listings from the following reputable real
          estate platforms:
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {sources.map((source) => (
            <a
              key={source.name}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl p-6 shadow-sm border border-border hover:border-primary transition-colors text-center"
            >
              <h3 className="font-semibold">{source.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{source.url}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Mission */}
      <div className="max-w-3xl mx-auto bg-primary-50 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
        <p className="text-muted-foreground">
          To make property search in Venezuela simple and accessible. We believe
          everyone deserves easy access to comprehensive real estate information,
          whether you&apos;re looking for your first home, an investment
          property, or commercial space.
        </p>
      </div>
    </div>
  );
}

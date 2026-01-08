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
    title: 'Trusted Quality',
    description:
      'We aggregate from reputable real estate platforms to ensure listing quality and accuracy.',
  },
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

      {/* How It Works */}
      <div className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold mb-2">We Aggregate</h3>
            <p className="text-sm text-muted-foreground">
              Our platform collects listings from multiple sources across Venezuela
            </p>
          </div>
          <div>
            <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold mb-2">You Search</h3>
            <p className="text-sm text-muted-foreground">
              Use our advanced filters to find properties that match your criteria
            </p>
          </div>
          <div>
            <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold mb-2">Connect Directly</h3>
            <p className="text-sm text-muted-foreground">
              Click through to view full details and contact the listing agent
            </p>
          </div>
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

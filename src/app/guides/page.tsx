import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { guides } from '@/lib/guides';

export const metadata: Metadata = {
  title: 'Property Guides',
  description:
    'Expert guides on buying, selling, and investing in Venezuelan real estate. Learn about property laws, neighborhoods, and market trends.',
};

export default function GuidesPage() {
  // Group guides by category
  const categories = [...new Set(guides.map((g) => g.category))];

  return (
    <div className="container py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Property Guides</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Expert advice and comprehensive guides to help you navigate the
          Venezuelan property market.
        </p>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map((category) => (
          <Badge
            key={category}
            variant="outline"
            className="text-sm py-1 px-3 cursor-pointer hover:bg-primary hover:text-white transition-colors"
          >
            {category}
          </Badge>
        ))}
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guides.map((guide) => (
          <Link key={guide.slug} href={`/guides/${guide.slug}`}>
            <Card className="h-full card-hover">
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">
                  {guide.category}
                </Badge>
                <CardTitle className="text-xl leading-tight">
                  {guide.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  {guide.description}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Published: {new Date(guide.publishedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { guides, getGuideBySlug } from '@/lib/guides';

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return guides.map((guide) => ({
    slug: guide.slug,
  }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    return { title: 'Guide Not Found' };
  }

  return {
    title: guide.title,
    description: guide.description,
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: 'article',
      publishedTime: guide.publishedAt,
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  return (
    <div className="container py-12">
      <div className="max-w-3xl mx-auto">
        {/* Back Link */}
        <Button variant="ghost" asChild className="mb-6 -ml-4">
          <Link href="/guides">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Guides
          </Link>
        </Button>

        {/* Header */}
        <header className="mb-8">
          <Badge variant="outline" className="mb-4">
            {guide.category}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{guide.title}</h1>
          <p className="text-muted-foreground text-lg">{guide.description}</p>
          <p className="text-sm text-muted-foreground mt-4">
            Published: {new Date(guide.publishedAt).toLocaleDateString()}
          </p>
        </header>

        {/* Content */}
        <article className="prose prose-neutral max-w-none">
          {guide.content.split('\n').map((paragraph, index) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return null;

            if (trimmed.startsWith('## ')) {
              return (
                <h2 key={index} className="text-2xl font-bold mt-8 mb-4">
                  {trimmed.replace('## ', '')}
                </h2>
              );
            }
            if (trimmed.startsWith('### ')) {
              return (
                <h3 key={index} className="text-xl font-semibold mt-6 mb-3">
                  {trimmed.replace('### ', '')}
                </h3>
              );
            }
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
              return (
                <p key={index} className="font-semibold mt-4">
                  {trimmed.replace(/\*\*/g, '')}
                </p>
              );
            }
            if (trimmed.startsWith('- ')) {
              return (
                <li key={index} className="ml-4">
                  {trimmed.replace('- ', '')}
                </li>
              );
            }
            if (/^\d+\./.test(trimmed)) {
              return (
                <li key={index} className="ml-4 list-decimal">
                  {trimmed.replace(/^\d+\.\s*/, '')}
                </li>
              );
            }
            return (
              <p key={index} className="my-4 text-muted-foreground leading-relaxed">
                {trimmed}
              </p>
            );
          })}
        </article>

        {/* CTA */}
        <div className="mt-12 p-6 bg-primary-50 rounded-xl">
          <h3 className="font-semibold text-lg mb-2">Ready to Find Your Property?</h3>
          <p className="text-muted-foreground mb-4">
            Search thousands of Venezuelan properties from multiple sources.
          </p>
          <Button asChild className="bg-primary hover:bg-primary-700">
            <Link href="/">Browse Properties</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

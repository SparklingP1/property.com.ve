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

function parseMarkdownContent(content: string) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let listKey = 0;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`list-${listKey++}`} className="ml-6 my-4 list-disc space-y-2">
            {currentList.items.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${listKey++}`} className="ml-6 my-4 list-decimal space-y-2">
            {currentList.items.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    // Handle headings
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={index} className="text-2xl font-bold mt-8 mb-4">
          {trimmed.replace('## ', '')}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={index} className="text-xl font-semibold mt-6 mb-3">
          {trimmed.replace('### ', '')}
        </h3>
      );
      return;
    }

    // Handle bullet lists
    if (trimmed.startsWith('- ')) {
      const item = formatInlineMarkdown(trimmed.replace('- ', ''));
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(item);
      return;
    }

    // Handle numbered lists
    if (/^\d+\.\s/.test(trimmed)) {
      const item = formatInlineMarkdown(trimmed.replace(/^\d+\.\s*/, ''));
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(item);
      return;
    }

    // Handle standalone bold text
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      flushList();
      elements.push(
        <p key={index} className="font-semibold mt-4">
          {trimmed.replace(/\*\*/g, '')}
        </p>
      );
      return;
    }

    // Handle regular paragraphs
    flushList();
    elements.push(
      <p
        key={index}
        className="my-4 text-muted-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }}
      />
    );
  });

  flushList();
  return elements;
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
          {parseMarkdownContent(guide.content)}
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

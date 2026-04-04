import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createClient, getUser } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { AlertForm } from '@/components/dashboard/alert-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'alerts' });

  return {
    title: t('editAlert'),
    robots: { index: false, follow: false },
  };
}

interface EditAlertPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditAlertPage({ params }: EditAlertPageProps) {
  const { id } = await params;
  const t = await getTranslations('alerts');
  const user = await getUser();
  const supabase = await createClient();

  const { data: alert } = await supabase
    .from('property_alerts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single();

  if (!alert) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{t('editAlert')}</h1>
      <div className="bg-white rounded-2xl border border-stone-200 p-8">
        <AlertForm
          mode="edit"
          alertId={alert.id}
          initialName={alert.name}
          initialCriteria={alert.criteria as Record<string, string>}
        />
      </div>
    </div>
  );
}

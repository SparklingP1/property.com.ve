import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const revalidate = 604800; // 7 days

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const isEs = locale === 'es';

  const esPath = '/precios-de-casas-en-venezuela/metodologia';
  const enPath = '/en/property-prices-in-venezuela/methodology';

  return {
    title: isEs
      ? 'Metodología del Índice de Precios — Property.com.ve'
      : 'Price Index Methodology �� Property.com.ve',
    description: isEs
      ? 'Cómo calculamos los precios de inmuebles en Venezuela. Fuentes de datos, método de cálculo, limitaciones y frecuencia de actualización.'
      : 'How we calculate property prices in Venezuela. Data sources, calculation method, limitations, and update frequency.',
    alternates: {
      canonical: isEs ? `${baseUrl}${esPath}` : `${baseUrl}${enPath}`,
      languages: {
        es: `${baseUrl}${esPath}`,
        en: `${baseUrl}${enPath}`,
      },
    },
  };
}

export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketData' });
  const isEs = locale === 'es';
  const hubUrl = isEs ? '/precios-de-casas-en-venezuela/' : '/en/property-prices-in-venezuela/';

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <a href={isEs ? '/' : '/en'} className="hover:text-stone-200">{t('breadcrumbHome')}</a>
            <span>/</span>
            <a href={hubUrl} className="hover:text-stone-200">{t('breadcrumbPrices')}</a>
            <span>/</span>
            <span className="text-stone-200">{t('methodology')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {t('methodologyTitle')}
          </h1>
        </div>
      </div>

      <div className="container py-12">
        <div className="max-w-3xl mx-auto prose prose-stone prose-lg">
          {isEs ? <SpanishContent /> : <EnglishContent />}
        </div>
      </div>
    </div>
  );
}

function SpanishContent() {
  return (
    <>
      <h2>Fuente de Datos</h2>
      <p>
        Nuestro índice de precios se basa en datos recopilados semanalmente de listados de propiedades
        activos en Venezuela. Actualmente rastreamos aproximadamente <strong>11,600 inmuebles activos</strong> de
        fuentes públicas de listados inmobiliarios, cubriendo apartamentos, casas y terrenos en 24 estados.
      </p>
      <p>
        Los datos se recopilan mediante web scraping automatizado que se ejecuta semanalmente (escaneo completo)
        y diariamente (listados más recientes). Solo los escaneos semanales completos se utilizan para el cálculo
        de estadísticas, asegurando que cada propiedad se cuente una sola vez por período.
      </p>

      <h2>Método de Cálculo</h2>
      <p>
        Utilizamos una <strong>mediana estratificada del precio por metro cuadrado</strong> como métrica principal.
        Este enfoque es similar al utilizado por Rightmove en el Reino Unido para su Índice de Precios.
      </p>
      <h3>Pasos del proceso:</h3>
      <ol>
        <li><strong>Deduplicación:</strong> Si una propiedad aparece en múltiples escaneos dentro de un mes, solo se utiliza la instantánea más reciente.</li>
        <li><strong>Filtrado de valores atípicos:</strong> Se excluyen los precios por debajo del percentil 2 y por encima del percentil 98 para eliminar errores de datos.</li>
        <li><strong>Estratificación:</strong> Las estadísticas se calculan por ciudad, tipo de propiedad (apartamento, casa) y número de habitaciones (1, 2, 3, 4+).</li>
        <li><strong>Nivel de confianza:</strong> Solo publicamos datos con al menos 20 listados en cada segmento (&quot;confianza media&quot;). Los segmentos con 50+ listados se marcan como &quot;confianza alta&quot;.</li>
      </ol>

      <h2>Limitaciones</h2>
      <ul>
        <li><strong>Precios de oferta, no de venta:</strong> Rastreamos precios publicados (lo que piden los vendedores), no precios de transacción reales. Los precios de venta suelen ser menores.</li>
        <li><strong>Solo USD:</strong> Solo incluimos propiedades listadas en dólares estadounidenses. Las propiedades en bolívares (VES) o euros se excluyen.</li>
        <li><strong>Fuente única:</strong> Los datos provienen principalmente de una fuente de listados. Esto puede no representar la totalidad del mercado.</li>
        <li><strong>Sin ajuste hedónico:</strong> No controlamos por calidad, estado o ubicación exacta dentro de una ciudad. La mediana por m² controla parcialmente por tamaño.</li>
      </ul>

      <h2>Frecuencia de Actualizaci��n</h2>
      <ul>
        <li><strong>Recopilación de datos:</strong> Semanal (escaneo completo cada domingo)</li>
        <li><strong>Cálculo de estadísticas:</strong> Mensual (primer día de cada mes)</li>
        <li><strong>Actualización de páginas:</strong> Automática tras el cálculo mensual</li>
      </ul>

      <h2>Contacto</h2>
      <p>
        Para consultas sobre los datos o solicitudes de colaboración, contáctenos a través de
        la página <Link href="/about">Nosotros</Link>.
      </p>
    </>
  );
}

function EnglishContent() {
  return (
    <>
      <h2>Data Source</h2>
      <p>
        Our price index is based on data collected weekly from active property listings
        in Venezuela. We currently track approximately <strong>11,600 active listings</strong> from
        public real estate listing sources, covering apartments, houses, and land across 24 states.
      </p>
      <p>
        Data is collected via automated web scraping that runs weekly (full scan)
        and daily (newest listings). Only weekly full scans are used for statistics
        calculation, ensuring each property is counted once per period.
      </p>

      <h2>Calculation Method</h2>
      <p>
        We use a <strong>stratified median price per square meter</strong> as the primary metric.
        This approach is similar to the one used by Rightmove in the UK for their House Price Index.
      </p>
      <h3>Process steps:</h3>
      <ol>
        <li><strong>Deduplication:</strong> If a property appears in multiple scans within a month, only the most recent snapshot is used.</li>
        <li><strong>Outlier filtering:</strong> Prices below the 2nd percentile and above the 98th percentile are excluded to remove data errors.</li>
        <li><strong>Stratification:</strong> Statistics are computed by city, property type (apartment, house), and bedroom count (1, 2, 3, 4+).</li>
        <li><strong>Confidence level:</strong> We only publish data with at least 20 listings per segment (&quot;medium confidence&quot;). Segments with 50+ listings are marked &quot;high confidence.&quot;</li>
      </ol>

      <h2>Limitations</h2>
      <ul>
        <li><strong>Asking prices, not sale prices:</strong> We track listed prices (what sellers ask), not actual transaction prices. Sale prices are typically lower.</li>
        <li><strong>USD only:</strong> We only include properties listed in US dollars. Properties in bolívares (VES) or euros are excluded.</li>
        <li><strong>Single source:</strong> Data comes primarily from one listing source. This may not represent the entire market.</li>
        <li><strong>No hedonic adjustment:</strong> We don&apos;t control for quality, condition, or exact location within a city. The $/sqm metric partially controls for size.</li>
      </ul>

      <h2>Update Frequency</h2>
      <ul>
        <li><strong>Data collection:</strong> Weekly (full scan every Sunday)</li>
        <li><strong>Statistics calculation:</strong> Monthly (1st of each month)</li>
        <li><strong>Page updates:</strong> Automatic after monthly calculation</li>
      </ul>

      <h2>Contact</h2>
      <p>
        For data inquiries or collaboration requests, reach out via
        our <Link href="/about">About</Link> page.
      </p>
    </>
  );
}

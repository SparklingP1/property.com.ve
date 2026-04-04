interface DatasetSchemaProps {
  name: string;
  description: string;
  url: string;
  spatialCoverage: string;
  temporalCoverage: string;
  listingCount: number;
}

export function DatasetSchema({ name, description, url, spatialCoverage, temporalCoverage, listingCount }: DatasetSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name,
    description,
    url,
    temporalCoverage,
    spatialCoverage: {
      '@type': 'Place',
      name: spatialCoverage,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Property.com.ve',
      url: 'https://property.com.ve',
    },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'text/html',
      contentUrl: url,
    },
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Median Price per Square Meter (USD)', unitCode: 'USD' },
      { '@type': 'PropertyValue', name: 'Median Asking Price (USD)', unitCode: 'USD' },
      { '@type': 'PropertyValue', name: 'Number of Active Listings', unitCode: 'C62' },
    ],
    measurementTechnique: 'Stratified median of asking prices from weekly web scraping, filtered to 2nd-98th percentile, USD-denominated properties only.',
    size: `${listingCount} property listings`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

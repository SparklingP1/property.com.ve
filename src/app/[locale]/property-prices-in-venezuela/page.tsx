import type { Metadata } from 'next';
import MarketDataHub, {
  generateMetadata as generateMarketDataMetadata,
} from '../precios-de-casas-en-venezuela/page';

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return generateMarketDataMetadata(props);
}

export default MarketDataHub;

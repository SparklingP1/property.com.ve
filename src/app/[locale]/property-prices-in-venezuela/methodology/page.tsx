import type { Metadata } from 'next';
import MethodologyPage, {
  generateMetadata as generateMethodologyMetadata,
} from '../../precios-de-casas-en-venezuela/metodologia/page';

export const revalidate = 604800;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return generateMethodologyMetadata(props);
}

export default MethodologyPage;

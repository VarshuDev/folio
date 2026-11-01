import { PortfolioStudio } from '@/components/portfolio-studio';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Studio — folio',
  description: 'Design, edit, and publish your portfolio in one place.',
};

export default function StudioPage() {
  return <PortfolioStudio initialScreen="builder" />;
}

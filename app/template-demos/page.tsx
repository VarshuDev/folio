import type { Metadata } from 'next';
import { TemplateDemos } from '@/components/template-demos';

export const metadata: Metadata = {
  title: 'Portfolio style QA — folio',
  description: 'Compare all 22 single-page portfolio styles using shared deterministic QA fixtures and the current renderer.'
};

export default function TemplateDemosPage() {
  return <TemplateDemos />;
}

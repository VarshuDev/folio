import { getPublishingRepository } from '@/lib/publishing/repository';
import { PortfolioRenderer } from '@/components/portfolio-renderer';
import { AnalyticsTracker } from '@/components/analytics-tracker';
import { ContactForm } from '@/components/contact-form';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const repository = getPublishingRepository();
  const publication = await repository.getPublicationBySlug(slug);

  if (!publication || !publication.isPublic || (publication as unknown as { mode?: string }).mode === 'advanced') {
    return {
      title: 'Portfolio Not Found — folio',
      robots: { index: false },
    };
  }

  const name = publication.profile.basics.name || 'Portfolio';
  const role = publication.profile.basics.role;
  const about = publication.profile.basics.about;
  const description = role ? `${name} — ${role}` : (about ? about.slice(0, 160) : `${name}'s portfolio`);

  return {
    title: `${name} — folio`,
    description,
    openGraph: {
      title: `${name} — folio`,
      description,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} — folio`,
      description,
    },
  };
}

export default async function PublishedPortfolioPage({ params }: PageProps) {
  const { slug } = await params;
  const repository = getPublishingRepository();
  const publication = await repository.getPublicationBySlug(slug);

  if (!publication || !publication.isPublic || (publication as unknown as { mode?: string }).mode === 'advanced') {
    notFound();
  }

  const showContactForm = publication.design.visibleSections.contact;

  return (
    <main className="published-portfolio-view" role="main">
      <AnalyticsTracker slug={slug} />
      <PortfolioRenderer profile={publication.profile} design={publication.design} />
      {showContactForm && (
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '0 20px 60px' }}>
          <ContactForm slug={slug} creatorName={publication.profile.basics.name || 'Creator'} />
        </div>
      )}
    </main>
  );
}

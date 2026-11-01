import { ImageResponse } from 'next/og';
import { getPublishingRepository } from '@/lib/publishing/repository';

export const runtime = 'nodejs';
export const revalidate = 60;
export const alt = 'Portfolio preview — folio';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OpenGraphImage({ params }: Props) {
  const { slug } = await params;
  const repository = getPublishingRepository();
  const publication = await repository.getPublicationBySlug(slug);

  const isAvailable = publication && publication.isPublic;
  const name = isAvailable ? publication.profile.basics.name || 'Portfolio' : 'Portfolio';
  const role = isAvailable ? publication.profile.basics.role || 'Creator & Builder' : 'Created with Folio';
  const location = isAvailable ? publication.profile.basics.location || '' : '';
  const skills = isAvailable && publication.profile.skills ? publication.profile.skills.slice(0, 4) : [];

  // Generate initials monogram
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FO';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#f7f6f1',
          padding: '54px 64px',
          border: '18px solid #ebf1e9',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#365d4a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 700,
              }}
            >
              f
            </div>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 750,
                color: '#252d29',
                letterSpacing: '-0.03em',
              }}
            >
              folio
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: '#e8efe9',
              borderRadius: '99px',
              border: '1px solid #c9d8cb',
              color: '#284a39',
              fontSize: '15px',
              fontWeight: 650,
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#365d4a',
              }}
            />
            <span>PORTFOLIO SHOWCASE</span>
          </div>
        </div>

        {/* Center Creator Bio & Avatar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '36px',
            marginTop: '20px',
            marginBottom: '20px',
          }}
        >
          {/* Avatar Monogram */}
          <div
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              backgroundColor: '#365d4a',
              border: '4px solid #ffffff',
              boxShadow: '0 8px 24px rgba(40, 55, 46, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '44px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxWidth: '880px',
            }}
          >
            <div
              style={{
                fontSize: '56px',
                fontWeight: 800,
                color: '#252d29',
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>

            <div
              style={{
                fontSize: '26px',
                fontWeight: 500,
                color: '#536257',
                lineHeight: 1.3,
              }}
            >
              {role}
            </div>

            {location ? (
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#6e7d73',
                  marginTop: '4px',
                }}
              >
                📍 {location}
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom Skills & Live URL Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid #e1e7de',
            paddingTop: '24px',
            width: '100%',
          }}
        >
          {/* Skill Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {skills.map((skill, index) => (
              <div
                key={index}
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d4ded2',
                  borderRadius: '99px',
                  color: '#334337',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(40, 55, 46, 0.04)',
                }}
              >
                {skill}
              </div>
            ))}
          </div>

          {/* Live Link Monospace Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              backgroundColor: '#edf4ed',
              borderRadius: '8px',
              border: '1px solid #c8d8c7',
              color: '#284a39',
              fontFamily: 'monospace',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            <span>nive.app/p/{slug}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

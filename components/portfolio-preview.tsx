import { Icon } from '@/components/icon';
import { CorePortfolio, CORE_TEMPLATE_IDS } from '@/components/core-portfolio';
import { PortfolioRenderer } from '@/components/portfolio-renderer';
import type { DesignConfig, ProfileDocument } from '@/lib/profile-schema';

export function PortfolioPreview({
  profile,
  design,
  viewport,
  onViewportChange,
}: {
  profile: ProfileDocument;
  design: DesignConfig;
  viewport: 'desktop' | 'mobile';
  onViewportChange: (viewport: 'desktop' | 'mobile') => void;
}) {
  const slug = profile.basics.name
    ? profile.basics.name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    : 'yourname';
  const isCore = CORE_TEMPLATE_IDS.includes(design.templateId);

  return (
    <aside className="preview-column" aria-label="Live portfolio preview">
      <div className="preview-toolbar">
        <div className="preview-label">
          <span className="preview-live-dot" /> LIVE PREVIEW
        </div>
        <div className="viewport-switch" role="group" aria-label="Portfolio preview size">
          <button
            className={viewport === 'desktop' ? 'active' : ''}
            aria-pressed={viewport === 'desktop'}
            aria-label="Desktop preview"
            type="button"
            onClick={() => onViewportChange('desktop')}
          >
            <Icon name="monitor" size={16} />
          </button>
          <button
            className={viewport === 'mobile' ? 'active' : ''}
            aria-pressed={viewport === 'mobile'}
            aria-label="Mobile preview"
            type="button"
            onClick={() => onViewportChange('mobile')}
          >
            <Icon name="phone" size={16} />
          </button>
        </div>
      </div>
      <div className={`preview-frame ${viewport === 'mobile' ? 'is-mobile' : ''}`}>
        <div className="preview-browserbar">
          <div className="preview-browser-dots" aria-hidden="true">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="preview-browser-url">
            <Icon name="lock" size={11} />
            <span>{slug}.folio.site</span>
          </div>
          <div className="preview-browser-spacer" aria-hidden="true" />
        </div>
        <div className="preview-content">
          {isCore ? (
            <CorePortfolio profile={profile} design={design} />
          ) : (
            <PortfolioRenderer profile={profile} design={design} />
          )}
        </div>
      </div>
      <div className="preview-tip">
        <span aria-hidden="true">◉</span> This is how your site will look on the web.
      </div>
    </aside>
  );
}

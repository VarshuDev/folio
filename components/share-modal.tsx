'use client';

import { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/icon';
import { generateQrSvg } from '@/lib/qr';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  name?: string;
  role?: string;
  isAdvanced?: boolean;
}

export function ShareModal({
  isOpen,
  onClose,
  slug,
  name = 'My Portfolio',
  role = 'Creator & Builder',
  isAdvanced = false,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  // Compute live absolute URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nive.app';
  const liveUrl = `${origin}/p/${slug}`;

  // Generate SVG QR Code
  const qrSvg = useMemo(() => {
    return generateQrSvg(liveUrl, {
      size: 180,
      fgColor: '#365d4a',
      bgColor: '#ffffff',
    });
  }, [liveUrl]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadQr = () => {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: 'html' | 'zip' | 'resume') => {
    setExportingFormat(format);
    const exportUrl = `/api/portfolio/export?slug=${encodeURIComponent(slug)}&format=${format}`;
    if (format === 'resume') {
      window.open(exportUrl, '_blank');
    } else {
      window.location.href = exportUrl;
    }
    setTimeout(() => setExportingFormat(null), 1500);
  };

  // Social share intent URLs
  const shareText = encodeURIComponent(`Check out my portfolio: ${name}${role ? ` — ${role}` : ''}`);
  const encodedUrl = encodeURIComponent(liveUrl);
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}`;

  return (
    <div
      className="adv-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="share-modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#fffefa',
          borderRadius: '16px',
          border: '1px solid var(--line-dark, #d6d9cf)',
          boxShadow: '0 24px 64px rgba(32, 48, 38, 0.2)',
          padding: '24px 28px',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            borderBottom: '1px solid var(--line, #e4e5dc)',
            paddingBottom: '14px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--green, #365d4a)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              DISTRIBUTION &amp; SHARING
            </span>
            <h2
              id="share-modal-title"
              style={{
                fontSize: '20px',
                fontWeight: 750,
                color: 'var(--ink, #252d29)',
                margin: '2px 0 0 0',
              }}
            >
              Share Your Portfolio
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: 'var(--muted, #69736d)',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 1. Live Link Row */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 650,
              color: 'var(--ink)',
              marginBottom: '6px',
            }}
          >
            Public Portfolio Address
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: 'var(--paper, #f7f6f1)',
              borderRadius: '8px',
              border: '1px solid var(--line-dark, #d6d9cf)',
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#284a39',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {liveUrl}
            </span>
            <button
              type="button"
              className="button small"
              onClick={handleCopy}
              style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
            >
              {copied ? 'Copied! ✓' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* 2. One-Click Social Sharing */}
        <div style={{ marginBottom: '22px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 650,
              color: 'var(--ink)',
              marginBottom: '8px',
            }}
          >
            Share Directly to Social Platforms
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '10px',
            }}
          >
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary small"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                textAlign: 'center',
                textDecoration: 'none',
                minHeight: '40px',
                fontWeight: 600,
              }}
            >
              LinkedIn
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary small"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                textAlign: 'center',
                textDecoration: 'none',
                minHeight: '40px',
                fontWeight: 600,
              }}
            >
              Twitter / X
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary small"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                textAlign: 'center',
                textDecoration: 'none',
                minHeight: '40px',
                fontWeight: 600,
              }}
            >
              WhatsApp
            </a>
          </div>
        </div>

        {/* 3. QR Code Section */}
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--paper, #f7f6f1)',
            borderRadius: '10px',
            border: '1px solid var(--line, #e4e5dc)',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            marginBottom: '22px',
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            style={{
              width: '100px',
              height: '100px',
              flexShrink: 0,
              backgroundColor: '#ffffff',
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid var(--line, #e4e5dc)',
            }}
          />
          <div style={{ flex: 1 }}>
            <h4
              style={{
                margin: '0 0 4px 0',
                fontSize: '14px',
                fontWeight: 650,
                color: 'var(--ink)',
              }}
            >
              Vector QR Code
            </h4>
            <p
              style={{
                margin: '0 0 10px 0',
                fontSize: '12px',
                color: 'var(--muted)',
                lineHeight: 1.4,
              }}
            >
              High-resolution QR code linking straight to your live portfolio. Ideal for printed resumes and business cards.
            </p>
            <button
              type="button"
              className="button secondary small"
              onClick={handleDownloadQr}
              style={{ minHeight: '32px', fontSize: '11px', padding: '0 10px' }}
            >
              Download QR (.svg)
            </button>
          </div>
        </div>

        {/* 4. Zero Lock-In Code Export Section */}
        <div
          style={{
            paddingTop: '16px',
            borderTop: '1px solid var(--line, #e4e5dc)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 650,
                  color: 'var(--ink)',
                }}
              >
                Zero Lock-In Code Export
              </h4>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                }}
              >
                Own your work forever. Download clean standalone code ready to host anywhere.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="button secondary small"
              onClick={() => handleExport('resume')}
              disabled={Boolean(exportingFormat)}
              style={{ justifyContent: 'center', fontSize: '11.5px', padding: '8px 6px' }}
            >
              {exportingFormat === 'resume' ? 'Opening…' : 'ATS Resume (PDF)'}
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => handleExport('html')}
              disabled={Boolean(exportingFormat)}
              style={{ justifyContent: 'center', fontSize: '11.5px', padding: '8px 6px' }}
            >
              {exportingFormat === 'html' ? 'Exporting…' : 'HTML (.html)'}
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => handleExport('zip')}
              disabled={Boolean(exportingFormat)}
              style={{ justifyContent: 'center', fontSize: '11.5px', padding: '8px 6px' }}
            >
              {exportingFormat === 'zip' ? 'Exporting…' : 'ZIP Bundle (.zip)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

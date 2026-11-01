'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';

interface ContactFormProps {
  slug: string;
  creatorName?: string;
  className?: string;
}

export function ContactForm({ slug, creatorName = 'Creator', className = '' }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic client validation
    if (!name.trim()) {
      setErrorMessage('Please provide your name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    if (message.trim().length < 5) {
      setErrorMessage('Message must be at least 5 characters long.');
      return;
    }

    setStatus('submitting');

    try {
      const res = await fetch('/api/portfolio/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          honeypot: honeypot.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to deliver message. Please try again later.');
        return;
      }

      setStatus('success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setHoneypot('');
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please verify your internet connection and try again.');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setErrorMessage(null);
  };

  return (
    <div className={`folio-contact-card ${className}`}>
      <div className="folio-contact-header">
        <div className="folio-contact-badge">
          <span className="contact-dot" />
          <span>Direct Inquiry</span>
        </div>
        <h3 className="folio-contact-title">Send a Message to {creatorName}</h3>
        <p className="folio-contact-subtitle">
          Have an opportunity, collaboration idea, or question? Send a note directly below.
        </p>
      </div>

      {status === 'success' ? (
        <div className="folio-contact-success">
          <div className="folio-contact-success-icon">✓</div>
          <h4>Message Delivered!</h4>
          <p>Your note was delivered directly to {creatorName}. They will reply to your email shortly.</p>
          <button type="button" className="folio-contact-btn secondary" onClick={handleReset}>
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="folio-contact-form" noValidate>
          {/* Honeypot anti-spam field: invisible to human users, traps bots */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <label htmlFor={`hp_${slug}`}>Company</label>
            <input
              id={`hp_${slug}`}
              type="text"
              name="hp_company"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="folio-contact-row">
            <div className="folio-contact-field">
              <label htmlFor={`cf_name_${slug}`}>Your Name *</label>
              <input
                id={`cf_name_${slug}`}
                type="text"
                required
                maxLength={100}
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={status === 'submitting'}
              />
            </div>
            <div className="folio-contact-field">
              <label htmlFor={`cf_email_${slug}`}>Your Email *</label>
              <input
                id={`cf_email_${slug}`}
                type="email"
                required
                maxLength={254}
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'submitting'}
              />
            </div>
          </div>

          <div className="folio-contact-field">
            <label htmlFor={`cf_subj_${slug}`}>Subject (optional)</label>
            <input
              id={`cf_subj_${slug}`}
              type="text"
              maxLength={150}
              placeholder="Project collaboration / Freelance opportunity"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={status === 'submitting'}
            />
          </div>

          <div className="folio-contact-field">
            <div className="folio-contact-field-header">
              <label htmlFor={`cf_msg_${slug}`}>Message *</label>
              <span className="folio-char-counter">{message.length}/3000</span>
            </div>
            <textarea
              id={`cf_msg_${slug}`}
              required
              rows={4}
              maxLength={3000}
              placeholder={`Hi ${creatorName}, I came across your portfolio and would love to talk about...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={status === 'submitting'}
            />
          </div>

          {errorMessage && (
            <div className="folio-contact-error" role="alert">
              <Icon name="close" size={14} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="folio-contact-footer">
            <button
              type="submit"
              className="folio-contact-submit-btn"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Sending Message...' : 'Send Message ↗'}
            </button>
            <span className="folio-contact-privacy-note">
              🔒 Spam protected. Never shared with third parties.
            </span>
          </div>
        </form>
      )}

      <style jsx>{`
        .folio-contact-card {
          margin-top: 40px;
          padding: 28px;
          background: var(--surface, #ffffff);
          border: 1px solid var(--line, #e2e8f0);
          border-radius: 12px;
          box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.05);
          font-family: inherit;
        }
        .folio-contact-header {
          margin-bottom: 22px;
        }
        .folio-contact-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent, #365d4a);
          background: rgba(54, 93, 74, 0.1);
          padding: 4px 10px;
          border-radius: 99px;
          margin-bottom: 10px;
        }
        .contact-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent, #365d4a);
        }
        .folio-contact-title {
          font-size: 20px;
          font-weight: 750;
          color: var(--ink, #1a202c);
          margin-bottom: 4px;
        }
        .folio-contact-subtitle {
          font-size: 14px;
          color: var(--muted, #64748b);
          line-height: 1.5;
        }
        .folio-contact-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .folio-contact-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .folio-contact-row {
            grid-template-columns: 1fr;
          }
        }
        .folio-contact-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .folio-contact-field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .folio-contact-field label {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink, #334155);
        }
        .folio-char-counter {
          font-size: 11px;
          color: var(--muted, #94a3b8);
        }
        .folio-contact-field input,
        .folio-contact-field textarea {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--line, #cbd5e1);
          background: var(--bg, #f8fafc);
          color: var(--ink, #0f172a);
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .folio-contact-field input:focus,
        .folio-contact-field textarea:focus {
          outline: none;
          border-color: var(--accent, #365d4a);
          box-shadow: 0 0 0 3px rgba(54, 93, 74, 0.15);
        }
        .folio-contact-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 13px;
        }
        .folio-contact-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }
        .folio-contact-submit-btn {
          padding: 10px 22px;
          background: var(--accent, #365d4a);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 650;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .folio-contact-submit-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        .folio-contact-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .folio-contact-privacy-note {
          font-size: 12px;
          color: var(--muted, #94a3b8);
        }
        .folio-contact-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 32px 16px;
        }
        .folio-contact-success-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #dcfce7;
          color: #15803d;
          font-size: 22px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .folio-contact-success h4 {
          font-size: 18px;
          font-weight: 750;
          color: var(--ink, #1a202c);
          margin-bottom: 6px;
        }
        .folio-contact-success p {
          font-size: 14px;
          color: var(--muted, #64748b);
          max-width: 400px;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .folio-contact-btn.secondary {
          padding: 8px 18px;
          background: var(--bg, #f1f5f9);
          border: 1px solid var(--line, #cbd5e1);
          border-radius: 8px;
          color: var(--ink, #334155);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

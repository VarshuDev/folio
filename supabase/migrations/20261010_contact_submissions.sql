-- Migration: Contact Submissions & Lead Capture
-- Enables visitors to submit inquiries/messages on published portfolios.
-- Protected with RLS and indexed for creator inbox retrieval.

CREATE TABLE IF NOT EXISTS portfolio_contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_slug TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT NOT NULL
);

-- Indexes for performant filtering in creator inbox and rate limiting
CREATE INDEX IF NOT EXISTS idx_contact_submissions_creator ON portfolio_contact_submissions (creator_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_slug ON portfolio_contact_submissions (portfolio_slug);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_rate_limit ON portfolio_contact_submissions (ip_hash, portfolio_slug, created_at DESC);

-- Enable Row Level Security
ALTER TABLE portfolio_contact_submissions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role manages all contact submissions"
  ON portfolio_contact_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

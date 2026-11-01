import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ContactSubmission, ContactSubmissionStatus } from './types';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export interface IContactRepository {
  createSubmission(
    submission: Omit<ContactSubmission, 'id' | 'createdAt' | 'status'>
  ): Promise<ContactSubmission>;
  getSubmissionsByCreator(
    creatorUserId: string,
    statusFilter?: ContactSubmissionStatus | 'all'
  ): Promise<ContactSubmission[]>;
  getUnreadCount(creatorUserId: string): Promise<number>;
  updateSubmissionStatus(
    submissionId: string,
    creatorUserId: string,
    status: ContactSubmissionStatus
  ): Promise<boolean>;
  deleteSubmission(submissionId: string, creatorUserId: string): Promise<boolean>;
  checkRateLimit(
    ipHash: string,
    portfolioSlug: string,
    maxPerHour?: number
  ): Promise<RateLimitResult>;
}

/**
 * In-memory implementation of IContactRepository for testing and offline/local development.
 */
export class InMemoryContactRepository implements IContactRepository {
  private submissions = new Map<string, ContactSubmission>();
  private rateLimits: Array<{ key: string; timestamp: number }> = [];

  clear(): void {
    this.submissions.clear();
    this.rateLimits = [];
  }

  async checkRateLimit(
    ipHash: string,
    portfolioSlug: string,
    maxPerHour = 3
  ): Promise<RateLimitResult> {
    const oneHourAgo = Date.now() - 3600 * 1000;
    // Prune stale rate limits
    this.rateLimits = this.rateLimits.filter((r) => r.timestamp > oneHourAgo);

    const key = `${ipHash}:${portfolioSlug.toLowerCase()}`;
    const recentCount = this.rateLimits.filter((r) => r.key === key).length;

    if (recentCount >= maxPerHour) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: maxPerHour - recentCount };
  }

  async createSubmission(
    input: Omit<ContactSubmission, 'id' | 'createdAt' | 'status'>
  ): Promise<ContactSubmission> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const submission: ContactSubmission = {
      ...input,
      id,
      status: 'unread',
      createdAt: new Date().toISOString(),
    };

    this.submissions.set(id, submission);

    // Track rate limit timestamp
    const key = `${input.ipHash}:${input.portfolioSlug.toLowerCase()}`;
    this.rateLimits.push({ key, timestamp: Date.now() });

    return submission;
  }

  async getSubmissionsByCreator(
    creatorUserId: string,
    statusFilter: ContactSubmissionStatus | 'all' = 'all'
  ): Promise<ContactSubmission[]> {
    const all = Array.from(this.submissions.values()).filter(
      (s) => s.creatorUserId === creatorUserId
    );

    const filtered =
      statusFilter === 'all'
        ? all
        : all.filter((s) => s.status === statusFilter);

    // Sort newest first
    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getUnreadCount(creatorUserId: string): Promise<number> {
    return Array.from(this.submissions.values()).filter(
      (s) => s.creatorUserId === creatorUserId && s.status === 'unread'
    ).length;
  }

  async updateSubmissionStatus(
    submissionId: string,
    creatorUserId: string,
    status: ContactSubmissionStatus
  ): Promise<boolean> {
    const existing = this.submissions.get(submissionId);
    if (!existing || existing.creatorUserId !== creatorUserId) {
      return false;
    }

    existing.status = status;
    this.submissions.set(submissionId, existing);
    return true;
  }

  async deleteSubmission(submissionId: string, creatorUserId: string): Promise<boolean> {
    const existing = this.submissions.get(submissionId);
    if (!existing || existing.creatorUserId !== creatorUserId) {
      return false;
    }

    return this.submissions.delete(submissionId);
  }
}

/**
 * Production Supabase PostgreSQL contact repository.
 */
export class SupabaseContactRepository implements IContactRepository {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async checkRateLimit(
    ipHash: string,
    portfolioSlug: string,
    maxPerHour = 3
  ): Promise<RateLimitResult> {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();

    const { count, error } = await this.client
      .from('portfolio_contact_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('portfolio_slug', portfolioSlug.toLowerCase())
      .gte('created_at', oneHourAgo);

    if (error) {
      // In case of database error, fail safely with generous limit
      return { allowed: true, remaining: 1 };
    }

    const currentCount = count || 0;
    if (currentCount >= maxPerHour) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: maxPerHour - currentCount };
  }

  async createSubmission(
    input: Omit<ContactSubmission, 'id' | 'createdAt' | 'status'>
  ): Promise<ContactSubmission> {
    const { data, error } = await this.client
      .from('portfolio_contact_submissions')
      .insert({
        portfolio_slug: input.portfolioSlug.toLowerCase(),
        creator_user_id: input.creatorUserId,
        sender_name: input.senderName,
        sender_email: input.senderEmail,
        subject: input.subject || '',
        message: input.message,
        status: 'unread',
        ip_hash: input.ipHash,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to save contact submission: ${error?.message || 'Database error'}`);
    }

    return {
      id: data.id,
      portfolioSlug: data.portfolio_slug,
      creatorUserId: data.creator_user_id,
      senderName: data.sender_name,
      senderEmail: data.sender_email,
      subject: data.subject,
      message: data.message,
      status: data.status,
      createdAt: data.created_at,
      ipHash: data.ip_hash,
    };
  }

  async getSubmissionsByCreator(
    creatorUserId: string,
    statusFilter: ContactSubmissionStatus | 'all' = 'all'
  ): Promise<ContactSubmission[]> {
    let query = this.client
      .from('portfolio_contact_submissions')
      .select('*')
      .eq('creator_user_id', creatorUserId)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map((d) => ({
      id: d.id,
      portfolioSlug: d.portfolio_slug,
      creatorUserId: d.creator_user_id,
      senderName: d.sender_name,
      senderEmail: d.sender_email,
      subject: d.subject,
      message: d.message,
      status: d.status,
      createdAt: d.created_at,
      ipHash: d.ip_hash,
    }));
  }

  async getUnreadCount(creatorUserId: string): Promise<number> {
    const { count, error } = await this.client
      .from('portfolio_contact_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('creator_user_id', creatorUserId)
      .eq('status', 'unread');

    if (error) return 0;
    return count || 0;
  }

  async updateSubmissionStatus(
    submissionId: string,
    creatorUserId: string,
    status: ContactSubmissionStatus
  ): Promise<boolean> {
    const { error, count } = await this.client
      .from('portfolio_contact_submissions')
      .update({ status })
      .eq('id', submissionId)
      .eq('creator_user_id', creatorUserId);

    if (error) return false;
    return (count ?? 1) > 0;
  }

  async deleteSubmission(submissionId: string, creatorUserId: string): Promise<boolean> {
    const { error } = await this.client
      .from('portfolio_contact_submissions')
      .delete()
      .eq('id', submissionId)
      .eq('creator_user_id', creatorUserId);

    return !error;
  }
}

// Global singleton instance
let contactRepoInstance: IContactRepository | null = null;

export function getContactRepository(): IContactRepository {
  if (contactRepoInstance) {
    return contactRepoInstance;
  }

  const persistence = process.env.FOLIO_PERSISTENCE;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (persistence === 'memory' || !supabaseUrl || !serviceRoleKey) {
    contactRepoInstance = new InMemoryContactRepository();
    return contactRepoInstance;
  }

  contactRepoInstance = new SupabaseContactRepository(supabaseUrl, serviceRoleKey);
  return contactRepoInstance;
}

export function setContactRepository(repo: IContactRepository | null): void {
  contactRepoInstance = repo;
}

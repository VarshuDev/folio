import { z } from 'zod';

export type ContactSubmissionStatus = 'unread' | 'read' | 'archived';

export interface ContactSubmission {
  id: string;
  portfolioSlug: string;
  creatorUserId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  status: ContactSubmissionStatus;
  createdAt: string;
  ipHash: string;
}

export const ContactFormInputSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  email: z.string().trim().email('Please enter a valid email address').max(254),
  subject: z.string().trim().max(150, 'Subject must be under 150 characters').optional().default(''),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(3000, 'Message must be under 3000 characters'),
  honeypot: z.string().optional().default(''),
});

export type ContactFormInput = z.infer<typeof ContactFormInputSchema>;

export interface ContactInboxSummary {
  submissions: ContactSubmission[];
  unreadCount: number;
  totalCount: number;
}

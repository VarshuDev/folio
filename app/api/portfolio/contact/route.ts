import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getPublishingRepository } from '@/lib/publishing/repository';
import { getContactRepository } from '@/lib/contact/repository';
import { ContactFormInputSchema, type ContactSubmissionStatus } from '@/lib/contact/types';

export const dynamic = 'force-dynamic';

function sanitizeText(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Public POST: Submit a new contact message for a published portfolio.
 * Protected by honeypot anti-spam and sliding-window IP rate limiting.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parseResult = ContactFormInputSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parseResult.error.issues[0]?.message || 'Invalid form submission',
          code: 'validation_error',
        },
        { status: 400 }
      );
    }

    const { slug, name, email, subject, message, honeypot } = parseResult.data;

    // 1. Honeypot check: If bot filled the hidden honeypot input, silently drop
    if (honeypot && honeypot.trim().length > 0) {
      return NextResponse.json({
        ok: true,
        message: 'Your message has been sent successfully!',
      });
    }

    // 2. Extract visitor IP and calculate anonymized hash for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const ipHash = crypto
      .createHash('sha256')
      .update(`${ip}:folio-contact-salt`)
      .digest('hex')
      .slice(0, 32);

    const cleanSlug = slug.toLowerCase().trim();
    const contactRepo = getContactRepository();

    // 3. Sliding-window rate limit check (max 3 messages per hour per IP per portfolio)
    const rateCheck = await contactRepo.checkRateLimit(ipHash, cleanSlug, 3);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Too many messages sent. Please wait an hour before submitting another message.',
          code: 'rate_limit_exceeded',
        },
        { status: 429 }
      );
    }

    // 4. Resolve portfolio owner
    const publishingRepo = getPublishingRepository();
    const publication = await publishingRepo.getPublicationBySlug(cleanSlug);

    if (!publication || !publication.isPublic) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Portfolio not found or is currently private.',
          code: 'not_found',
        },
        { status: 404 }
      );
    }

    // 5. Sanitize text fields
    const sanitizedName = sanitizeText(name);
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedSubject = sanitizeText(subject || '');
    const sanitizedMessage = sanitizeText(message);

    // 6. Save submission
    const submission = await contactRepo.createSubmission({
      portfolioSlug: cleanSlug,
      creatorUserId: publication.ownerId,
      senderName: sanitizedName,
      senderEmail: sanitizedEmail,
      subject: sanitizedSubject,
      message: sanitizedMessage,
      ipHash,
    });

    return NextResponse.json({
      ok: true,
      message: 'Your message has been sent successfully!',
      submissionId: submission.id,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to submit contact message',
        code: 'server_error',
      },
      { status: 500 }
    );
  }
}

/**
 * Authenticated GET: Retrieve inquiries and messages for creator's portfolio.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error, code: 'unauthenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get('status') || 'all') as ContactSubmissionStatus | 'all';

    const contactRepo = getContactRepository();
    const submissions = await contactRepo.getSubmissionsByCreator(auth.userId, statusParam);
    const unreadCount = await contactRepo.getUnreadCount(auth.userId);

    return NextResponse.json({
      ok: true,
      submissions,
      unreadCount,
      totalCount: submissions.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve inquiries',
        code: 'server_error',
      },
      { status: 500 }
    );
  }
}

/**
 * Authenticated PATCH: Update submission status (read, unread, archived).
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error, code: 'unauthenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status } = body as { id: string; status: ContactSubmissionStatus };

    if (!id || !status || !['unread', 'read', 'archived'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid id or status parameter', code: 'bad_request' },
        { status: 400 }
      );
    }

    const contactRepo = getContactRepository();
    const success = await contactRepo.updateSubmissionStatus(id, auth.userId, status);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Submission not found or unauthorized', code: 'not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to update submission status',
        code: 'server_error',
      },
      { status: 500 }
    );
  }
}

/**
 * Authenticated DELETE: Delete a submission.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error, code: 'unauthenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing submission id parameter', code: 'bad_request' },
        { status: 400 }
      );
    }

    const contactRepo = getContactRepository();
    const success = await contactRepo.deleteSubmission(id, auth.userId);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Submission not found or unauthorized', code: 'not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to delete submission',
        code: 'server_error',
      },
      { status: 500 }
    );
  }
}

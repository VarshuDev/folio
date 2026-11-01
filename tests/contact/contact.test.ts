import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  ContactFormInputSchema,
  InMemoryContactRepository,
  setContactRepository,
} from '@/lib/contact';
import { getPublishingRepository } from '@/lib/publishing/repository';
import { createEmptyProfile, createDefaultDesign } from '@/lib/profile-schema';
import { POST, GET, PATCH, DELETE } from '@/app/api/portfolio/contact/route';

test('ContactFormInputSchema: validates required fields, email formatting, and size boundaries', () => {
  // 1. Valid payload
  const valid = ContactFormInputSchema.safeParse({
    slug: 'alex-rivera',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    subject: 'Project inquiry',
    message: 'Hello Alex, I love your portfolio and would like to hire you for a project.',
  });
  assert.equal(valid.success, true);

  // 2. Missing/empty name
  const missingName = ContactFormInputSchema.safeParse({
    slug: 'alex-rivera',
    name: '   ',
    email: 'sarah@example.com',
    message: 'Hello there!',
  });
  assert.equal(missingName.success, false);

  // 3. Malformed email
  const badEmail = ContactFormInputSchema.safeParse({
    slug: 'alex-rivera',
    name: 'Sarah Connor',
    email: 'invalid-email-address',
    message: 'Hello there!',
  });
  assert.equal(badEmail.success, false);

  // 4. Message too short (< 5 chars)
  const shortMsg = ContactFormInputSchema.safeParse({
    slug: 'alex-rivera',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    message: 'Hi',
  });
  assert.equal(shortMsg.success, false);

  // 5. Message too long (> 3000 chars)
  const longMsg = ContactFormInputSchema.safeParse({
    slug: 'alex-rivera',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    message: 'a'.repeat(3001),
  });
  assert.equal(longMsg.success, false);
});

test('InMemoryContactRepository: CRUD operations, unread counting, and creator isolation', async () => {
  const repo = new InMemoryContactRepository();
  const creatorA = `creator-a-${Date.now()}`;
  const creatorB = `creator-b-${Date.now()}`;

  // 1. Create submissions for creator A
  const sub1 = await repo.createSubmission({
    portfolioSlug: 'creator-a-portfolio',
    creatorUserId: creatorA,
    senderName: 'Alice',
    senderEmail: 'alice@example.com',
    subject: 'Freelance gig',
    message: 'We want to hire you!',
    ipHash: 'ip-hash-1',
  });
  assert.ok(sub1.id);
  assert.equal(sub1.status, 'unread');
  assert.ok(sub1.createdAt);

  const sub2 = await repo.createSubmission({
    portfolioSlug: 'creator-a-portfolio',
    creatorUserId: creatorA,
    senderName: 'Bob',
    senderEmail: 'bob@example.com',
    subject: 'Mentorship',
    message: 'Can we chat?',
    ipHash: 'ip-hash-2',
  });

  // 2. Create submission for creator B
  const subB = await repo.createSubmission({
    portfolioSlug: 'creator-b-portfolio',
    creatorUserId: creatorB,
    senderName: 'Charlie',
    senderEmail: 'charlie@example.com',
    subject: 'Speaking invitation',
    message: 'Keynote invitation for our conference.',
    ipHash: 'ip-hash-3',
  });

  // 3. Unread count checks
  assert.equal(await repo.getUnreadCount(creatorA), 2);
  assert.equal(await repo.getUnreadCount(creatorB), 1);

  // 4. Creator isolation in getSubmissionsByCreator
  const creatorASubs = await repo.getSubmissionsByCreator(creatorA);
  assert.equal(creatorASubs.length, 2);
  assert.equal(creatorASubs.every((s) => s.creatorUserId === creatorA), true);

  const creatorBSubs = await repo.getSubmissionsByCreator(creatorB);
  assert.equal(creatorBSubs.length, 1);
  assert.equal(creatorBSubs[0].id, subB.id);

  // 5. Update status
  const markRead = await repo.updateSubmissionStatus(sub1.id, creatorA, 'read');
  assert.equal(markRead, true);
  assert.equal(await repo.getUnreadCount(creatorA), 1);

  // Cross-user update isolation: creator B cannot modify creator A's message
  const foreignUpdate = await repo.updateSubmissionStatus(sub1.id, creatorB, 'archived');
  assert.equal(foreignUpdate, false);

  // 6. Delete submission
  const foreignDelete = await repo.deleteSubmission(sub1.id, creatorB);
  assert.equal(foreignDelete, false); // Creator B cannot delete

  const ownerDelete = await repo.deleteSubmission(sub1.id, creatorA);
  assert.equal(ownerDelete, true);
  assert.equal((await repo.getSubmissionsByCreator(creatorA)).length, 1);
});

test('InMemoryContactRepository: sliding-window rate limit enforces max submissions per hour', async () => {
  const repo = new InMemoryContactRepository();
  const ipHash = 'rate-limited-ip-hash';
  const slug = 'security-portfolio';

  // 1st submission
  const check1 = await repo.checkRateLimit(ipHash, slug, 3);
  assert.equal(check1.allowed, true);
  await repo.createSubmission({
    portfolioSlug: slug,
    creatorUserId: 'owner-1',
    senderName: 'User 1',
    senderEmail: 'u1@test.com',
    subject: 'Hi 1',
    message: 'Testing rate limit 1',
    ipHash,
  });

  // 2nd submission
  const check2 = await repo.checkRateLimit(ipHash, slug, 3);
  assert.equal(check2.allowed, true);
  await repo.createSubmission({
    portfolioSlug: slug,
    creatorUserId: 'owner-1',
    senderName: 'User 2',
    senderEmail: 'u2@test.com',
    subject: 'Hi 2',
    message: 'Testing rate limit 2',
    ipHash,
  });

  // 3rd submission
  const check3 = await repo.checkRateLimit(ipHash, slug, 3);
  assert.equal(check3.allowed, true);
  await repo.createSubmission({
    portfolioSlug: slug,
    creatorUserId: 'owner-1',
    senderName: 'User 3',
    senderEmail: 'u3@test.com',
    subject: 'Hi 3',
    message: 'Testing rate limit 3',
    ipHash,
  });

  // 4th submission should be rejected
  const check4 = await repo.checkRateLimit(ipHash, slug, 3);
  assert.equal(check4.allowed, false);
  assert.equal(check4.remaining, 0);
});

test('API POST /api/portfolio/contact: successfully delivers message for public portfolio', async () => {
  const contactRepo = new InMemoryContactRepository();
  setContactRepository(contactRepo);

  // Publish a test portfolio
  const publishingRepo = getPublishingRepository();
  const ownerId = `creator-api-${Date.now()}`;
  const slug = `portfolio-${Date.now()}`;
  const profile = createEmptyProfile();
  profile.basics.name = 'Elena Rostova';
  const design = createDefaultDesign();
  await publishingRepo.publishPortfolio(ownerId, slug, profile, design);

  const req = new NextRequest('http://localhost:3000/api/portfolio/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.195' },
    body: JSON.stringify({
      slug,
      name: 'David Kim',
      email: 'david@company.com',
      subject: 'Frontend Role Opening',
      message: 'Hi Elena, we would love to invite you for an interview.',
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.submissionId);

  // Verify in repository
  const stored = await contactRepo.getSubmissionsByCreator(ownerId);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].senderName, 'David Kim');
  assert.equal(stored[0].senderEmail, 'david@company.com');
  assert.equal(stored[0].subject, 'Frontend Role Opening');
});

test('API POST /api/portfolio/contact: honeypot silently drops bot submissions without storing', async () => {
  const contactRepo = new InMemoryContactRepository();
  setContactRepository(contactRepo);

  const publishingRepo = getPublishingRepository();
  const ownerId = `bot-target-${Date.now()}`;
  const slug = `bot-target-${Date.now()}`;
  await publishingRepo.publishPortfolio(ownerId, slug, createEmptyProfile(), createDefaultDesign());

  const req = new NextRequest('http://localhost:3000/api/portfolio/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug,
      name: 'Spam Bot 3000',
      email: 'spammer@darkweb.io',
      subject: 'Buy crypto now',
      message: 'Cheap crypto tokens available at spam link!',
      honeypot: 'Acme Spammer Corp', // BOT FILLED THIS HIDDEN FIELD
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);

  // Invariant: ZERO messages stored in repository!
  const stored = await contactRepo.getSubmissionsByCreator(ownerId);
  assert.equal(stored.length, 0);
});

test('API POST /api/portfolio/contact: rejects submissions for unpublished/private portfolios with 404', async () => {
  const contactRepo = new InMemoryContactRepository();
  setContactRepository(contactRepo);

  const req = new NextRequest('http://localhost:3000/api/portfolio/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: 'nonexistent-secret-slug',
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'Hello anyone there?',
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'not_found');
});

test('API GET, PATCH, and DELETE /api/portfolio/contact: enforces authentication and creator lifecycle', async () => {
  const contactRepo = new InMemoryContactRepository();
  setContactRepository(contactRepo);

  const creatorId = `auth-creator-${Date.now()}`;

  // 1. Unauthenticated requests are rejected with 401
  const unauthGet = new NextRequest('http://localhost:3000/api/portfolio/contact');
  assert.equal((await GET(unauthGet)).status, 401);

  const unauthPatch = new NextRequest('http://localhost:3000/api/portfolio/contact', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'sub-1', status: 'read' }),
  });
  assert.equal((await PATCH(unauthPatch)).status, 401);

  const unauthDelete = new NextRequest('http://localhost:3000/api/portfolio/contact?id=sub-1', {
    method: 'DELETE',
  });
  assert.equal((await DELETE(unauthDelete)).status, 401);

  // 2. Create seed submission
  const sub = await contactRepo.createSubmission({
    portfolioSlug: 'my-portfolio',
    creatorUserId: creatorId,
    senderName: 'Recruiter Jane',
    senderEmail: 'jane@techcorp.com',
    subject: 'Staff Engineer Opportunity',
    message: 'We are expanding our core team and saw your work.',
    ipHash: 'ip-hash',
  });

  // 3. Authenticated GET
  const authHeaders = {
    Authorization: `Bearer test-${creatorId}`,
    'x-folio-test-user-id': creatorId,
  };

  const authGetReq = new NextRequest('http://localhost:3000/api/portfolio/contact', {
    headers: authHeaders,
  });
  const getRes = await GET(authGetReq);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.ok, true);
  assert.equal(getData.submissions.length, 1);
  assert.equal(getData.unreadCount, 1);

  // 4. Authenticated PATCH (Mark as Read)
  const patchReq = new NextRequest('http://localhost:3000/api/portfolio/contact', {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sub.id, status: 'read' }),
  });
  const patchRes = await PATCH(patchReq);
  assert.equal(patchRes.status, 200);
  assert.equal((await contactRepo.getUnreadCount(creatorId)), 0);

  // 5. Authenticated DELETE
  const deleteReq = new NextRequest(`http://localhost:3000/api/portfolio/contact?id=${sub.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const deleteRes = await DELETE(deleteReq);
  assert.equal(deleteRes.status, 200);
  assert.equal((await contactRepo.getSubmissionsByCreator(creatorId)).length, 0);
});

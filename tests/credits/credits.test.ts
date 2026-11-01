import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INITIAL_DEV_CREDITS,
  InMemoryCreditsRepository,
  getInMemoryCreditsStoreForTests,
} from '@/lib/credits';
import { GET, POST, PUT } from '@/app/api/credits/route';

test('Dev Credits: initial grant is created on first lookup', async () => {
  const repo = new InMemoryCreditsRepository();
  const userId = `test-user-${Date.now()}`;

  const { account, transactions } = await repo.getAccount(userId);
  assert.equal(account.userId, userId);
  assert.equal(account.balance, DEFAULT_INITIAL_DEV_CREDITS);
  assert.equal(account.lifetimeGranted, DEFAULT_INITIAL_DEV_CREDITS);
  assert.equal(account.lifetimeUsed, 0);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].type, 'grant');
  assert.equal(transactions[0].amount, DEFAULT_INITIAL_DEV_CREDITS);
  assert.equal(transactions[0].reason, 'Initial dev credits grant');
});

test('Dev Credits: grant is idempotent and repeated calls do not duplicate balance', async () => {
  const repo = new InMemoryCreditsRepository();
  const userId = `test-user-idempotent-${Date.now()}`;

  const first = await repo.getAccount(userId);
  assert.equal(first.account.balance, DEFAULT_INITIAL_DEV_CREDITS);

  const second = await repo.getAccount(userId);
  assert.equal(second.account.balance, DEFAULT_INITIAL_DEV_CREDITS);
  assert.equal(second.transactions.length, 1);
});

test('Dev Credits: grantCredits increments balance and records ledger transaction', async () => {
  const repo = new InMemoryCreditsRepository();
  const userId = `test-user-grant-${Date.now()}`;

  const res = await repo.grantCredits(userId, 10, 'Bonus exploration credits');
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.balance, DEFAULT_INITIAL_DEV_CREDITS + 10);
    assert.equal(res.account.lifetimeGranted, DEFAULT_INITIAL_DEV_CREDITS + 10);
    assert.equal(res.transaction?.type, 'grant');
    assert.equal(res.transaction?.amount, 10);
    assert.equal(res.transaction?.reason, 'Bonus exploration credits');
  }

  const { account, transactions } = await repo.getAccount(userId);
  assert.equal(account.balance, DEFAULT_INITIAL_DEV_CREDITS + 10);
  assert.equal(transactions.length, 2);
});

test('Dev Credits: consumeCredits decreases balance and prevents negative balance', async () => {
  const repo = new InMemoryCreditsRepository();
  const userId = `test-user-consume-${Date.now()}`;

  // Consume 5 credits
  const consumeRes = await repo.consumeCredits(userId, 5, 'Feature usage test');
  assert.equal(consumeRes.ok, true);
  if (consumeRes.ok) {
    assert.equal(consumeRes.balance, DEFAULT_INITIAL_DEV_CREDITS - 5);
    assert.equal(consumeRes.account.lifetimeUsed, 5);
  }

  // Attempt to consume more than remaining balance
  const excessiveAmount = DEFAULT_INITIAL_DEV_CREDITS * 2;
  const overdrawRes = await repo.consumeCredits(userId, excessiveAmount, 'Illegal overdraw');
  assert.equal(overdrawRes.ok, false);
  if (!overdrawRes.ok) {
    assert.equal(overdrawRes.code, 'insufficient_credits');
  }

  // Verify balance remained unchanged after failed overdraw
  const { account } = await repo.getAccount(userId);
  assert.equal(account.balance, DEFAULT_INITIAL_DEV_CREDITS - 5);
});

test('Dev Credits: non-positive amounts are rejected', async () => {
  const repo = new InMemoryCreditsRepository();
  const userId = `test-user-amounts-${Date.now()}`;

  const resZeroGrant = await repo.grantCredits(userId, 0, 'Zero grant');
  assert.equal(resZeroGrant.ok, false);
  if (!resZeroGrant.ok) assert.equal(resZeroGrant.code, 'invalid_amount');

  const resNegGrant = await repo.grantCredits(userId, -5, 'Negative grant');
  assert.equal(resNegGrant.ok, false);
  if (!resNegGrant.ok) assert.equal(resNegGrant.code, 'invalid_amount');

  const resZeroConsume = await repo.consumeCredits(userId, 0, 'Zero consume');
  assert.equal(resZeroConsume.ok, false);
  if (!resZeroConsume.ok) assert.equal(resZeroConsume.code, 'invalid_amount');
});

test('Dev Credits: refundCredits restores balance cleanly', async () => {
  const repo = new InMemoryCreditsRepository();
  const userId = `test-user-refund-${Date.now()}`;

  await repo.consumeCredits(userId, 4, 'Test usage');
  const refundRes = await repo.refundCredits(userId, 2, 'Usage rollback');
  assert.equal(refundRes.ok, true);
  if (refundRes.ok) {
    assert.equal(refundRes.balance, DEFAULT_INITIAL_DEV_CREDITS - 2);
    assert.equal(refundRes.account.lifetimeUsed, 2);
    assert.equal(refundRes.transaction?.type, 'refund');
  }
});

test('Dev Credits API: anonymous access to GET /api/credits is rejected with 401', async () => {
  const req = new Request('http://localhost:3000/api/credits');
  const res = await GET(req);
  assert.equal(res.status, 401);

  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'unauthenticated');
});

test('Dev Credits API: authenticated user can retrieve own balance and transactions', async () => {
  const userId = `api-user-${Date.now()}`;
  const req = new Request('http://localhost:3000/api/credits', {
    headers: {
      Authorization: `Bearer test-${userId}`,
      'x-folio-test-user-id': userId,
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.account.balance, DEFAULT_INITIAL_DEV_CREDITS);
  assert.equal(Array.isArray(data.transactions), true);
  assert.equal(data.transactions.length >= 1, true);
  assert.equal(data.transactions[0].reason, 'Initial dev credits grant');
});

test('Dev Credits API: cross-user access with mismatched query param is rejected with 403', async () => {
  const authenticatedUserId = `real-user-${Date.now()}`;
  const victimUserId = `victim-user-${Date.now()}`;

  const req = new Request(`http://localhost:3000/api/credits?userId=${victimUserId}`, {
    headers: {
      Authorization: `Bearer test-${authenticatedUserId}`,
      'x-folio-test-user-id': authenticatedUserId,
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 403);

  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.code, 'forbidden');
});

test('Dev Credits API: POST and PUT balance mutation attempts are rejected with 405 Method Not Allowed', async () => {
  const postRes = await POST();
  assert.equal(postRes.status, 405);

  const putRes = await PUT();
  assert.equal(putRes.status, 405);
});

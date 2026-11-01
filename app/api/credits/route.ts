import { authenticateServerRequest } from '@/lib/publishing/auth';
import { getCreditsService } from '@/lib/credits/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  Pragma: 'no-cache',
};

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateServerRequest(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error, code: 'unauthenticated' },
      { status: 401, headers: responseHeaders },
    );
  }

  const url = new URL(request.url);
  const queryOwnerId = url.searchParams.get('ownerId') || url.searchParams.get('userId');
  if (queryOwnerId && queryOwnerId.trim() && queryOwnerId.trim() !== auth.userId) {
    return Response.json(
      { ok: false, error: 'Forbidden: You cannot access credits for another user.', code: 'forbidden' },
      { status: 403, headers: responseHeaders },
    );
  }

  const creditsService = getCreditsService();
  try {
    const { account, transactions } = await creditsService.getAccount(auth.userId);

    return Response.json(
      {
        ok: true,
        account: {
          balance: account.balance,
          lifetimeGranted: account.lifetimeGranted,
          lifetimeUsed: account.lifetimeUsed,
        },
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          reason: t.reason,
          createdAt: t.createdAt,
        })),
      },
      { status: 200, headers: responseHeaders },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve credit account.';
    return Response.json(
      { ok: false, error: message, code: 'server_error' },
      { status: 500, headers: responseHeaders },
    );
  }
}

export async function POST(): Promise<Response> {
  return Response.json(
    { ok: false, error: 'Method not allowed: Dev credit balances are server-authoritative and cannot be directly modified.', code: 'forbidden' },
    { status: 405, headers: responseHeaders },
  );
}

export async function PUT(): Promise<Response> {
  return Response.json(
    { ok: false, error: 'Method not allowed: Dev credit balances are server-authoritative and cannot be directly modified.', code: 'forbidden' },
    { status: 405, headers: responseHeaders },
  );
}

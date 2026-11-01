import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_INITIAL_DEV_CREDITS,
  type CreditAccount,
  type CreditOperationResult,
  type CreditTransaction,
  type CreditTransactionType,
} from './types';

export interface ICreditsRepository {
  getAccount(userId: string): Promise<{ account: CreditAccount; transactions: CreditTransaction[] }>;
  grantCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult>;
  consumeCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult>;
  refundCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult>;
}

export class InMemoryCreditsRepository implements ICreditsRepository {
  private accounts = new Map<string, CreditAccount>(); // userId -> CreditAccount
  private transactions = new Map<string, CreditTransaction[]>(); // userId -> CreditTransaction[]

  clear(): void {
    this.accounts.clear();
    this.transactions.clear();
  }

  async getAccount(userId: string): Promise<{ account: CreditAccount; transactions: CreditTransaction[] }> {
    const existing = this.accounts.get(userId);
    if (existing) {
      return {
        account: { ...existing },
        transactions: (this.transactions.get(userId) || []).map((t) => ({ ...t })),
      };
    }

    // Idempotent initial grant on first lookup
    const now = new Date().toISOString();
    const newAccount: CreditAccount = {
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      balance: DEFAULT_INITIAL_DEV_CREDITS,
      lifetimeGranted: DEFAULT_INITIAL_DEV_CREDITS,
      lifetimeUsed: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(userId, newAccount);

    const initialTx: CreditTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      type: 'grant',
      amount: DEFAULT_INITIAL_DEV_CREDITS,
      reason: 'Initial dev credits grant',
      reference: 'welcome_grant',
      createdAt: now,
    };
    this.transactions.set(userId, [initialTx]);

    return {
      account: { ...newAccount },
      transactions: [{ ...initialTx }],
    };
  }

  async grantCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, error: 'Grant amount must be a positive integer.', code: 'invalid_amount' };
    }

    const { account } = await this.getAccount(userId);
    const now = new Date().toISOString();

    account.balance += amount;
    account.lifetimeGranted += amount;
    account.updatedAt = now;
    this.accounts.set(userId, account);

    const tx: CreditTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      type: 'grant',
      amount,
      reason,
      reference: reference || null,
      createdAt: now,
    };

    const userTxs = this.transactions.get(userId) || [];
    userTxs.unshift(tx);
    this.transactions.set(userId, userTxs);

    return {
      ok: true,
      balance: account.balance,
      account: { ...account },
      transaction: { ...tx },
    };
  }

  async consumeCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, error: 'Consumption amount must be a positive integer.', code: 'invalid_amount' };
    }

    const { account } = await this.getAccount(userId);
    if (account.balance < amount) {
      return {
        ok: false,
        error: `Insufficient dev credits (requested: ${amount}, available: ${account.balance}).`,
        code: 'insufficient_credits',
      };
    }

    const now = new Date().toISOString();
    account.balance -= amount;
    account.lifetimeUsed += amount;
    account.updatedAt = now;
    this.accounts.set(userId, account);

    const tx: CreditTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      type: 'consume',
      amount,
      reason,
      reference: reference || null,
      createdAt: now,
    };

    const userTxs = this.transactions.get(userId) || [];
    userTxs.unshift(tx);
    this.transactions.set(userId, userTxs);

    return {
      ok: true,
      balance: account.balance,
      account: { ...account },
      transaction: { ...tx },
    };
  }

  async refundCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult> {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, error: 'Refund amount must be a positive integer.', code: 'invalid_amount' };
    }

    const { account } = await this.getAccount(userId);
    const now = new Date().toISOString();

    account.balance += amount;
    account.lifetimeUsed = Math.max(0, account.lifetimeUsed - amount);
    account.updatedAt = now;
    this.accounts.set(userId, account);

    const tx: CreditTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId,
      type: 'refund',
      amount,
      reason,
      reference: reference || null,
      createdAt: now,
    };

    const userTxs = this.transactions.get(userId) || [];
    userTxs.unshift(tx);
    this.transactions.set(userId, userTxs);

    return {
      ok: true,
      balance: account.balance,
      account: { ...account },
      transaction: { ...tx },
    };
  }
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export class SupabaseCreditsRepository implements ICreditsRepository {
  constructor(private client: SupabaseClient) {}

  async getAccount(userId: string): Promise<{ account: CreditAccount; transactions: CreditTransaction[] }> {
    if (!isValidUuid(userId)) {
      return inMemoryCreditsStore.getAccount(userId);
    }

    // Check existing account
    const { data: existing, error } = await this.client
      .from('credit_accounts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV !== 'production' && (error.code === '22P02' || error.code === '23503')) {
        return inMemoryCreditsStore.getAccount(userId);
      }
      throw new Error(`Failed to read credit account: ${error.message}`);
    }

    let account: CreditAccount;

    if (existing) {
      account = {
        id: existing.id,
        userId: existing.user_id,
        balance: existing.balance,
        lifetimeGranted: existing.lifetime_granted,
        lifetimeUsed: existing.lifetime_used,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    } else {
      // Idempotently create account with initial grant
      const now = new Date().toISOString();
      const { data: created, error: insertError } = await this.client
        .from('credit_accounts')
        .insert({
          user_id: userId,
          balance: DEFAULT_INITIAL_DEV_CREDITS,
          lifetime_granted: DEFAULT_INITIAL_DEV_CREDITS,
          lifetime_used: 0,
        })
        .select()
        .single();

      if (insertError) {
        // If race condition where row was inserted concurrently, re-read
        const { data: retryData } = await this.client
          .from('credit_accounts')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (!retryData) throw new Error(`Failed to create credit account: ${insertError.message}`);
        account = {
          id: retryData.id,
          userId: retryData.user_id,
          balance: retryData.balance,
          lifetimeGranted: retryData.lifetime_granted,
          lifetimeUsed: retryData.lifetime_used,
          createdAt: retryData.created_at,
          updatedAt: retryData.updated_at,
        };
      } else {
        account = {
          id: created.id,
          userId: created.user_id,
          balance: created.balance,
          lifetimeGranted: created.lifetime_granted,
          lifetimeUsed: created.lifetime_used,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };

        // Record initial grant transaction
        await this.client.from('credit_transactions').insert({
          user_id: userId,
          type: 'grant',
          amount: DEFAULT_INITIAL_DEV_CREDITS,
          reason: 'Initial dev credits grant',
          reference: 'welcome_grant',
        });
      }
    }

    // Fetch transactions
    const { data: txsData, error: txsError } = await this.client
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (txsError) {
      throw new Error(`Failed to read credit transactions: ${txsError.message}`);
    }

    const transactions: CreditTransaction[] = (txsData || []).map((t) => ({
      id: t.id,
      userId: t.user_id,
      type: t.type as CreditTransactionType,
      amount: t.amount,
      reason: t.reason,
      reference: t.reference,
      createdAt: t.created_at,
    }));

    return { account, transactions };
  }

  async grantCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult> {
    if (!isValidUuid(userId)) {
      return inMemoryCreditsStore.grantCredits(userId, amount, reason, reference);
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, error: 'Grant amount must be a positive integer.', code: 'invalid_amount' };
    }

    const { account } = await this.getAccount(userId);
    const newBalance = account.balance + amount;
    const newLifetimeGranted = account.lifetimeGranted + amount;
    const now = new Date().toISOString();

    const { error: updateError } = await this.client
      .from('credit_accounts')
      .update({
        balance: newBalance,
        lifetime_granted: newLifetimeGranted,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (updateError) {
      return { ok: false, error: updateError.message, code: 'server_error' };
    }

    const { data: txData, error: txError } = await this.client
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'grant',
        amount,
        reason,
        reference: reference || null,
      })
      .select()
      .single();

    if (txError) {
      return { ok: false, error: txError.message, code: 'server_error' };
    }

    account.balance = newBalance;
    account.lifetimeGranted = newLifetimeGranted;
    account.updatedAt = now;

    return {
      ok: true,
      balance: newBalance,
      account,
      transaction: {
        id: txData.id,
        userId: txData.user_id,
        type: txData.type,
        amount: txData.amount,
        reason: txData.reason,
        reference: txData.reference,
        createdAt: txData.created_at,
      },
    };
  }

  async consumeCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult> {
    if (!isValidUuid(userId)) {
      return inMemoryCreditsStore.consumeCredits(userId, amount, reason, reference);
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, error: 'Consumption amount must be a positive integer.', code: 'invalid_amount' };
    }

    const { account } = await this.getAccount(userId);
    if (account.balance < amount) {
      return {
        ok: false,
        error: `Insufficient dev credits (requested: ${amount}, available: ${account.balance}).`,
        code: 'insufficient_credits',
      };
    }

    const newBalance = account.balance - amount;
    const newLifetimeUsed = account.lifetimeUsed + amount;
    const now = new Date().toISOString();

    const { error: updateError } = await this.client
      .from('credit_accounts')
      .update({
        balance: newBalance,
        lifetime_used: newLifetimeUsed,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (updateError) {
      return { ok: false, error: updateError.message, code: 'server_error' };
    }

    const { data: txData, error: txError } = await this.client
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'consume',
        amount,
        reason,
        reference: reference || null,
      })
      .select()
      .single();

    if (txError) {
      return { ok: false, error: txError.message, code: 'server_error' };
    }

    account.balance = newBalance;
    account.lifetimeUsed = newLifetimeUsed;
    account.updatedAt = now;

    return {
      ok: true,
      balance: newBalance,
      account,
      transaction: {
        id: txData.id,
        userId: txData.user_id,
        type: txData.type,
        amount: txData.amount,
        reason: txData.reason,
        reference: txData.reference,
        createdAt: txData.created_at,
      },
    };
  }

  async refundCredits(
    userId: string,
    amount: number,
    reason: string,
    reference?: string | null,
  ): Promise<CreditOperationResult> {
    if (!isValidUuid(userId)) {
      return inMemoryCreditsStore.refundCredits(userId, amount, reason, reference);
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, error: 'Refund amount must be a positive integer.', code: 'invalid_amount' };
    }

    const { account } = await this.getAccount(userId);
    const newBalance = account.balance + amount;
    const newLifetimeUsed = Math.max(0, account.lifetimeUsed - amount);
    const now = new Date().toISOString();

    const { error: updateError } = await this.client
      .from('credit_accounts')
      .update({
        balance: newBalance,
        lifetime_used: newLifetimeUsed,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (updateError) {
      return { ok: false, error: updateError.message, code: 'server_error' };
    }

    const { data: txData, error: txError } = await this.client
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'refund',
        amount,
        reason,
        reference: reference || null,
      })
      .select()
      .single();

    if (txError) {
      return { ok: false, error: txError.message, code: 'server_error' };
    }

    account.balance = newBalance;
    account.lifetimeUsed = newLifetimeUsed;
    account.updatedAt = now;

    return {
      ok: true,
      balance: newBalance,
      account,
      transaction: {
        id: txData.id,
        userId: txData.user_id,
        type: txData.type,
        amount: txData.amount,
        reason: txData.reason,
        reference: txData.reference,
        createdAt: txData.created_at,
      },
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __folioInMemoryCreditsStore: InMemoryCreditsRepository | undefined;
}

const inMemoryCreditsStore =
  globalThis.__folioInMemoryCreditsStore && typeof globalThis.__folioInMemoryCreditsStore.getAccount === 'function'
    ? globalThis.__folioInMemoryCreditsStore
    : new InMemoryCreditsRepository();
globalThis.__folioInMemoryCreditsStore = inMemoryCreditsStore;

export function getInMemoryCreditsStoreForTests(): InMemoryCreditsRepository {
  return inMemoryCreditsStore;
}

let testCreditsOverride: ICreditsRepository | null = null;

export function setCreditsRepositoryForTests(repo: ICreditsRepository | null): void {
  testCreditsOverride = repo;
}

/**
 * Returns the authoritative server-side credits repository.
 */
export function getCreditsService(): ICreditsRepository {
  if (testCreditsOverride) {
    return testCreditsOverride;
  }

  if (process.env.FOLIO_PERSISTENCE === 'memory') {
    return inMemoryCreditsStore;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceRoleKey) {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseCreditsRepository(client);
  }

  return inMemoryCreditsStore;
}

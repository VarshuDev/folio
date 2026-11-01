/**
 * Dev Credits Data Contracts & Configuration
 *
 * Dev Credits are internal, server-authoritative tokens with NO monetary value.
 * They cannot be purchased, traded, or withdrawn, and are not required for
 * ordinary portfolio editing or publishing.
 */

export const DEFAULT_INITIAL_DEV_CREDITS = 12;

export type CreditTransactionType = 'grant' | 'consume' | 'refund';

export interface CreditAccount {
  id: string;
  userId: string;
  balance: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  reason: string;
  reference?: string | null;
  createdAt: string;
}

export interface CreditAccountSummary {
  balance: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  initialGrantAmount: number;
}

export type CreditErrorCode =
  | 'insufficient_credits'
  | 'invalid_amount'
  | 'negative_balance_not_allowed'
  | 'account_not_found'
  | 'forbidden'
  | 'unauthenticated'
  | 'server_error';

export type CreditOperationResult =
  | { ok: true; balance: number; account: CreditAccount; transaction?: CreditTransaction }
  | { ok: false; error: string; code: CreditErrorCode };

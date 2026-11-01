import type { Metadata } from 'next';
import { AccountView } from '@/components/account-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'My Account — folio',
  description: 'Manage your folio portfolio, account settings, and live publication.',
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountView />;
}

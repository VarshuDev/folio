import type { Metadata } from 'next';
import './globals.css';
import './template-integration.css';
import './template-picker-overrides.css';
import './studio-ui.css';
import './ai-ui.css';
import './ai-copy-ui.css';

export const metadata: Metadata = {
  title: 'folio — your first portfolio, made simple',
  description: 'Turn coursework, small builds, and the things you are learning into a polished portfolio. No code or perfect-project requirement.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

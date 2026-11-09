import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FixMyStreet — A better way to care for our streets',
  description: 'Report local issues, follow their progress, and help make Jalandhar a better place to live.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

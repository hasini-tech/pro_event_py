import { Metadata } from 'next';
import DiscoverPageClient from '@/components/DiscoverPageClient';

export const metadata: Metadata = {
  title: 'Discover Events | Evently',
  description: 'Explore startup, business, and tech events with featured calendars and local recommendations.',
};

export const dynamic = 'force-dynamic';

export default function DiscoverPage() {
  return <DiscoverPageClient />;
}

import { Metadata } from 'next';
import EventsPageClient from '@/components/EventsPageClient';

export const metadata: Metadata = {
  title: 'Events | Evently',
  description: 'View your upcoming and past events in one place.',
};

export const dynamic = 'force-dynamic';

export default function EventsPage() {
  return <EventsPageClient />;
}

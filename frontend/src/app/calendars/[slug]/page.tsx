import CalendarDetailPageClient from '@/components/CalendarDetailPageClient';

export default function CalendarDetailPage({ params }: { params: { slug: string } }) {
  return <CalendarDetailPageClient slug={params.slug} />;
}

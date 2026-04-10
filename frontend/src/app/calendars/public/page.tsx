import { redirect } from 'next/navigation';

export default function PublicCalendarRedirectPage() {
  redirect('/calendars/create');
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  Globe2,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Tag,
  Ticket,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { DEFAULT_EVENT_COVER } from '@/lib/defaults';
import {
  isLocalFallbackResponse,
  mergeUniqueTimelineItems,
  readStoredTimelineIdentity,
} from '@/lib/personalTimelineCache';
import {
  getOwnerCalendarDetailCacheKey,
  getOwnerCalendarsCacheKey,
  readOwnerCalendarDetailCache,
  readOwnerCalendarsCache,
  writeOwnerCalendarDetailCache,
  writeOwnerCalendarsCache,
} from '@/lib/ownerCalendarCache';

type OwnerCalendar = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  tint_color: string;
  location_scope: 'city' | 'global';
  city: string;
  cover_image?: string;
  subscriber_count: number;
  is_default: boolean;
  event_count: number;
  upcoming_event_count: number;
  created_at?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  slug: string;
  date: string;
  time: string;
  location: string;
  is_online: boolean;
  attendee_count: number;
  confirmed_count: number;
  waitlisted_count: number;
  checked_in_count: number;
  ticket_sales: number;
  conversion_rate?: number;
  is_paid?: boolean;
  ticket_price?: number;
  cover_image?: string;
  created_at?: string;
};

type DetailTab =
  | 'events'
  | 'people'
  | 'newsletters'
  | 'payment'
  | 'insights'
  | 'settings';

type PersonKind = 'owner' | 'invitee';
type PeopleFilter = 'all' | 'owner' | 'invitee';
type PeopleSort = 'recent' | 'name';
type CouponKind = 'percent' | 'flat';
type NewsletterStatus = 'draft' | 'published';

type CalendarPerson = {
  id: string;
  name: string;
  email: string;
  joined_at: string;
  kind: PersonKind;
};

type NewsletterItem = {
  id: string;
  subject: string;
  content: string;
  status: NewsletterStatus;
  updated_at: string;
};

type CouponItem = {
  id: string;
  code: string;
  kind: CouponKind;
  amount: number;
  active: boolean;
  created_at: string;
};

type CalendarSettingsForm = {
  name: string;
  description: string;
  slug: string;
  tint_color: string;
  location_scope: 'city' | 'global';
  city: string;
};

type SettingsSection =
  | 'display'
  | 'options'
  | 'admins'
  | 'tags'
  | 'embed'
  | 'developer'
  | 'send-limit'
  | 'calendar-plus';

const SETTINGS_SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: 'display', label: 'Display' },
  { id: 'options', label: 'Options' },
  { id: 'admins', label: 'Admins' },
  { id: 'tags', label: 'Tags' },
  { id: 'embed', label: 'Embed' },
  { id: 'developer', label: 'Developer' },
  { id: 'send-limit', label: 'Send Limit' },
  { id: 'calendar-plus', label: 'Calendar Plus' },
];

const TINT_OPTIONS = [
  '#9ca3af',
  '#ec4899',
  '#8b5cf6',
  '#6366f1',
  '#2563eb',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#0e7678',
];

function buildCalendarGradient(color: string) {
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 44%, white))`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatShortDate(value?: string) {
  if (!value) return 'Just now';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  return parsed.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function formatDayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const key = date.toDateString();
  if (key === today.toDateString()) return 'Today';
  if (key === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString('en-IN', { weekday: 'long' });
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function isPastEvent(value: string) {
  return new Date(value).getTime() < Date.now();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function readStoredItems<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStoredItems<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function calendarStorageKey(calendarId: string, suffix: string) {
  return `evently:calendar:${calendarId}:${suffix}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  if (typeof window === 'undefined') return;

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default function CalendarDetailPageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [calendar, setCalendar] = useState<OwnerCalendar | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('events');
  const [timelineFilter, setTimelineFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('all');
  const [peopleSort, setPeopleSort] = useState<PeopleSort>('recent');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [manualPeople, setManualPeople] = useState<CalendarPerson[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterItem[]>([]);
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterContent, setNewsletterContent] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponAmount, setCouponAmount] = useState('');
  const [couponKind, setCouponKind] = useState<CouponKind>('percent');
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [settingsForm, setSettingsForm] = useState<CalendarSettingsForm>({
    name: '',
    description: '',
    slug: '',
    tint_color: '#0e7678',
    location_scope: 'global',
    city: '',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    let isActive = true;

    async function fetchCalendarDetail() {
      setLoading(true);
      const identity = user ?? readStoredTimelineIdentity();
      const detailCacheKey = getOwnerCalendarDetailCacheKey(identity, slug);
      const listCacheKey = getOwnerCalendarsCacheKey(identity);
      const cachedDetail = readOwnerCalendarDetailCache<{
        calendar: OwnerCalendar;
        events: CalendarEvent[];
      }>(detailCacheKey);

      if (cachedDetail?.calendar) {
        setCalendar(cachedDetail.calendar);
        setEvents(Array.isArray(cachedDetail.events) ? cachedDetail.events : []);
        setError('');
        setLoading(false);
      }

      try {
        const safeSlug = encodeURIComponent(slug);
        const [calendarResponse, eventsResponse] = await Promise.all([
          api.get(`/events/calendars/${safeSlug}`),
          api.get(`/events/calendars/${safeSlug}/events`),
        ]);
        if (!isActive) return;

        const calendarFallback = isLocalFallbackResponse(calendarResponse.headers);
        const eventsFallback = isLocalFallbackResponse(eventsResponse.headers);
        const fetchedCalendar = calendarResponse.data as OwnerCalendar;
        const fetchedEvents = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];
        const nextCalendar =
          calendarFallback && cachedDetail?.calendar ? cachedDetail.calendar : fetchedCalendar;
        const nextEvents =
          eventsFallback && cachedDetail?.events ? cachedDetail.events : fetchedEvents;

        setCalendar(nextCalendar);
        setEvents(nextEvents);
        setError('');

        if ((!calendarFallback || !eventsFallback) && nextCalendar) {
          writeOwnerCalendarDetailCache(detailCacheKey, {
            calendar: nextCalendar,
            events: nextEvents,
          });
        }

        if (!calendarFallback && fetchedCalendar) {
          const cachedCalendars = readOwnerCalendarsCache<OwnerCalendar>(listCacheKey).filter(
            (calendar): calendar is OwnerCalendar => Boolean(calendar) && typeof calendar === 'object',
          );
          writeOwnerCalendarsCache(
            listCacheKey,
            mergeUniqueTimelineItems([fetchedCalendar], cachedCalendars),
          );
        }
      } catch (err: any) {
        if (!isActive) return;
        if (cachedDetail?.calendar) {
          setCalendar(cachedDetail.calendar);
          setEvents(Array.isArray(cachedDetail.events) ? cachedDetail.events : []);
          setError('');
        } else {
          setError(err?.response?.data?.detail || 'Could not load this calendar.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchCalendarDetail();

    return () => {
      isActive = false;
    };
  }, [authLoading, router, slug, user]);

  useEffect(() => {
    if (!calendar) return;

    setSettingsForm({
      name: calendar.name || '',
      description: calendar.description || '',
      slug: calendar.slug || '',
      tint_color: calendar.tint_color || '#0e7678',
      location_scope: calendar.location_scope || 'global',
      city: calendar.city || '',
    });

    setManualPeople(readStoredItems(calendarStorageKey(calendar.id, 'people'), [] as CalendarPerson[]));
    setNewsletters(readStoredItems(calendarStorageKey(calendar.id, 'newsletters'), [] as NewsletterItem[]));
    setCoupons(readStoredItems(calendarStorageKey(calendar.id, 'coupons'), [] as CouponItem[]));
  }, [calendar]);

  useEffect(() => {
    if (!calendar) return;
    writeStoredItems(calendarStorageKey(calendar.id, 'people'), manualPeople);
  }, [calendar, manualPeople]);

  useEffect(() => {
    if (!calendar) return;
    writeStoredItems(calendarStorageKey(calendar.id, 'newsletters'), newsletters);
  }, [calendar, newsletters]);

  useEffect(() => {
    if (!calendar) return;
    writeStoredItems(calendarStorageKey(calendar.id, 'coupons'), coupons);
  }, [calendar, coupons]);

  const filteredEvents = useMemo(() => {
    const matchesFilter = events.filter((event) =>
      timelineFilter === 'upcoming' ? !isPastEvent(event.date) : isPastEvent(event.date),
    );
    return matchesFilter.sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
    );
  }, [events, timelineFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();

    filteredEvents.forEach((event) => {
      const date = new Date(event.date);
      const key = date.toDateString();
      const current = groups.get(key) || [];
      current.push(event);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([key, value]) => ({
      date: new Date(key),
      events: value,
    }));
  }, [filteredEvents]);

  const ownerPerson = useMemo<CalendarPerson | null>(() => {
    if (!calendar || !user) return null;
    return {
      id: `owner-${calendar.id}`,
      name: user.name || calendar.name,
      email: user.email || 'owner@evently.local',
      joined_at: calendar.created_at || new Date().toISOString(),
      kind: 'owner',
    };
  }, [calendar, user]);

  const allPeople = useMemo(() => {
    const people = ownerPerson ? [ownerPerson, ...manualPeople] : [...manualPeople];
    const query = peopleSearch.trim().toLowerCase();

    return people
      .filter((person) => {
        if (peopleFilter !== 'all' && person.kind !== peopleFilter) {
          return false;
        }

        if (!query) return true;
        return (
          person.name.toLowerCase().includes(query) ||
          person.email.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        if (peopleSort === 'name') {
          return left.name.localeCompare(right.name);
        }
        return new Date(right.joined_at).getTime() - new Date(left.joined_at).getTime();
      });
  }, [manualPeople, ownerPerson, peopleFilter, peopleSearch, peopleSort]);

  const newsletterDrafts = useMemo(
    () => newsletters.filter((item) => item.status === 'draft').sort(sortByUpdatedDesc),
    [newsletters],
  );
  const publishedNewsletters = useMemo(
    () => newsletters.filter((item) => item.status === 'published').sort(sortByUpdatedDesc),
    [newsletters],
  );

  const paymentSummary = useMemo(() => {
    const paidEvents = events.filter((event) => event.is_paid);
    const grossSales = events.reduce((sum, event) => sum + Number(event.ticket_sales || 0), 0);
    const confirmedTickets = events.reduce(
      (sum, event) => sum + Number(event.confirmed_count || 0),
      0,
    );
    return {
      paidEvents: paidEvents.length,
      grossSales,
      confirmedTickets,
    };
  }, [events]);

  const insightMetrics = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const lastWeekEvents = events.filter(
      (event) => new Date(event.created_at || event.date).getTime() >= weekAgo,
    );
    const totalTickets = events.reduce((sum, event) => sum + Number(event.confirmed_count || 0), 0);
    const lastWeekTickets = lastWeekEvents.reduce(
      (sum, event) => sum + Number(event.confirmed_count || 0),
      0,
    );
    const totalSales = events.reduce((sum, event) => sum + Number(event.ticket_sales || 0), 0);
    const lastWeekSales = lastWeekEvents.reduce(
      (sum, event) => sum + Number(event.ticket_sales || 0),
      0,
    );

    return {
      totalEvents: events.length,
      lastWeekEvents: lastWeekEvents.length,
      totalTickets,
      lastWeekTickets,
      totalSubscribers: (ownerPerson ? 1 : 0) + manualPeople.length,
      lastWeekSubscribers: manualPeople.filter(
        (person) => new Date(person.joined_at).getTime() >= weekAgo,
      ).length,
      totalSales,
      lastWeekSales,
    };
  }, [events, manualPeople, ownerPerson]);

  const verifiedForNewsletter = Boolean(
    settingsForm.description.trim() &&
      settingsForm.slug.trim() &&
      (settingsForm.location_scope === 'global' || settingsForm.city.trim()),
  );

  const tabs: Array<{ id: DetailTab; label: string; icon: JSX.Element }> = [
    { id: 'events', label: 'Events', icon: <CalendarDays size={15} /> },
    { id: 'people', label: 'People', icon: <Users size={15} /> },
    { id: 'newsletters', label: 'Newsletters', icon: <Megaphone size={15} /> },
    { id: 'payment', label: 'Payment', icon: <CreditCard size={15} /> },
    { id: 'insights', label: 'Insights', icon: <BarChart3 size={15} /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 size={15} /> },
  ];

  async function handleSaveSettings() {
    if (!calendar) return;

    setSavingSettings(true);
    setSettingsMessage('');
    try {
      const response = await api.put(`/events/calendars/${calendar.slug}`, {
        name: settingsForm.name,
        description: settingsForm.description,
        slug: settingsForm.slug,
        tint_color: settingsForm.tint_color,
        location_scope: settingsForm.location_scope,
        city: settingsForm.location_scope === 'city' ? settingsForm.city : '',
      });
      const updatedCalendar = response.data as OwnerCalendar;
      setCalendar(updatedCalendar);
      const identity = user ?? readStoredTimelineIdentity();
      const detailCacheKey = getOwnerCalendarDetailCacheKey(identity, updatedCalendar.slug);
      const listCacheKey = getOwnerCalendarsCacheKey(identity);
      const cachedCalendars = readOwnerCalendarsCache<OwnerCalendar>(listCacheKey).filter(
        (item): item is OwnerCalendar => Boolean(item) && typeof item === 'object',
      );
      writeOwnerCalendarDetailCache(detailCacheKey, {
        calendar: updatedCalendar,
        events,
      });
      writeOwnerCalendarsCache(
        listCacheKey,
        mergeUniqueTimelineItems([updatedCalendar], cachedCalendars),
      );
      setSettingsMessage('Calendar settings saved.');
      if (updatedCalendar.slug !== slug) {
        router.replace(`/calendars/${updatedCalendar.slug}`);
      }
    } catch (err: any) {
      setSettingsMessage(err?.response?.data?.detail || 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  function handleAddPerson() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    setManualPeople((current) => [
      {
        id: `invite-${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        joined_at: new Date().toISOString(),
        kind: 'invitee',
      },
      ...current,
    ]);
    setInviteName('');
    setInviteEmail('');
    setShowInviteForm(false);
  }

  function handleCreateNewsletter(status: NewsletterStatus) {
    if (!newsletterSubject.trim() || !newsletterContent.trim()) return;

    setNewsletters((current) => [
      {
        id: `newsletter-${Date.now()}`,
        subject: newsletterSubject.trim(),
        content: newsletterContent.trim(),
        status,
        updated_at: new Date().toISOString(),
      },
      ...current,
    ]);
    setNewsletterSubject('');
    setNewsletterContent('');
  }

  function handleCreateCoupon() {
    if (!couponCode.trim() || !couponAmount.trim()) return;

    setCoupons((current) => [
      {
        id: `coupon-${Date.now()}`,
        code: couponCode.trim().toUpperCase(),
        kind: couponKind,
        amount: Number(couponAmount),
        active: true,
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);
    setCouponCode('');
    setCouponAmount('');
    setCouponKind('percent');
    setShowCouponForm(false);
  }

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <Loader2 className="animate-spin" size={34} color="var(--primary-color)" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error || !calendar) {
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '44px 20px 80px' }}>
        <ErrorState message={error || 'This calendar could not be loaded.'} />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1140, margin: '0 auto', padding: '34px 20px 80px' }}>
      <CalendarHeader calendar={calendar} />

      <section style={{ borderBottom: '1px solid rgba(148,163,184,0.22)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '10px 0 12px',
                  color: isActive ? '#111827' : '#9ca3af',
                  fontWeight: isActive ? 800 : 600,
                  borderBottom: isActive ? '2px solid #111827' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === 'events' && (
        <EventsTab
          calendar={calendar}
          groupedEvents={groupedEvents}
          timelineFilter={timelineFilter}
          onTimelineFilterChange={setTimelineFilter}
        />
      )}

      {activeTab === 'people' && (
        <PeopleTab
          people={allPeople}
          peopleCount={(ownerPerson ? 1 : 0) + manualPeople.length}
          peopleSearch={peopleSearch}
          peopleFilter={peopleFilter}
          peopleSort={peopleSort}
          inviteName={inviteName}
          inviteEmail={inviteEmail}
          showInviteForm={showInviteForm}
          onPeopleSearchChange={setPeopleSearch}
          onPeopleFilterChange={setPeopleFilter}
          onPeopleSortChange={setPeopleSort}
          onInviteNameChange={setInviteName}
          onInviteEmailChange={setInviteEmail}
          onToggleInviteForm={() => setShowInviteForm((current) => !current)}
          onAddPerson={handleAddPerson}
          onDownload={() =>
            downloadCsv(
              `${calendar.slug}-people.csv`,
              [['Name', 'Email', 'Type', 'Joined'], ...allPeople.map((person) => [person.name, person.email, person.kind, formatShortDate(person.joined_at)])],
            )
          }
        />
      )}

      {activeTab === 'newsletters' && (
        <NewslettersTab
          drafts={newsletterDrafts}
          published={publishedNewsletters}
          verified={verifiedForNewsletter}
          subject={newsletterSubject}
          content={newsletterContent}
          onSubjectChange={setNewsletterSubject}
          onContentChange={setNewsletterContent}
          onVerify={() => setActiveTab('settings')}
          onSaveDraft={() => handleCreateNewsletter('draft')}
          onPublish={() => handleCreateNewsletter('published')}
        />
      )}

      {activeTab === 'payment' && (
        <PaymentTab
          calendar={calendar}
          summary={paymentSummary}
          coupons={coupons}
          couponCode={couponCode}
          couponAmount={couponAmount}
          couponKind={couponKind}
          showCouponForm={showCouponForm}
          onToggleCouponForm={() => setShowCouponForm((current) => !current)}
          onCouponCodeChange={setCouponCode}
          onCouponAmountChange={setCouponAmount}
          onCouponKindChange={setCouponKind}
          onCreateCoupon={handleCreateCoupon}
          onToggleCoupon={(couponId) =>
            setCoupons((current) =>
              current.map((coupon) =>
                coupon.id === couponId ? { ...coupon, active: !coupon.active } : coupon,
              ),
            )
          }
          onDeleteCoupon={(couponId) =>
            setCoupons((current) => current.filter((coupon) => coupon.id !== couponId))
          }
        />
      )}

      {activeTab === 'insights' && (
        <InsightsTab
          metrics={insightMetrics}
          events={events}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          settingsForm={settingsForm}
          saving={savingSettings}
          message={settingsMessage}
          onChange={(field, value) =>
            setSettingsForm((current) => ({ ...current, [field]: value }))
          }
          onOpenCreateCalendar={() => router.push('/calendars/create')}
          onSave={handleSaveSettings}
        />
      )}
    </main>
  );
}

function sortByUpdatedDesc<T extends { updated_at: string }>(left: T, right: T) {
  return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 28,
        borderRadius: 24,
        background: '#fff',
        border: '1px solid rgba(255,101,132,0.12)',
        boxShadow: '0 18px 42px rgba(17,39,45,0.06)',
      }}
    >
      <h1 style={{ fontSize: '2rem', margin: '0 0 10px', fontWeight: 800 }}>Calendar not available</h1>
      <p style={{ color: '#6b7280', margin: '0 0 18px' }}>{message}</p>
      <Link
        href="/calendars"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 14,
          background: '#111827',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 800,
        }}
      >
        Back to Calendars
      </Link>
    </div>
  );
}

function CalendarHeader({ calendar }: { calendar: OwnerCalendar }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            background: buildCalendarGradient(calendar.tint_color),
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.3rem',
            fontWeight: 800,
            boxShadow: '0 18px 34px rgba(17,39,45,0.1)',
          }}
        >
          {(calendar.name || 'C').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', margin: 0 }}>
            {calendar.name}
          </h1>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              color: '#6b7280',
              flexWrap: 'wrap',
            }}
          >
            <span>lu.ma/{calendar.slug}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Users size={15} color="var(--primary-color)" />
              {calendar.subscriber_count} Subscriber{calendar.subscriber_count === 1 ? '' : 's'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={15} color="var(--primary-color)" />
              {calendar.location_scope === 'city' ? calendar.city || 'City calendar' : 'Global calendar'}
            </span>
          </div>
        </div>
      </div>
      <p style={{ margin: 0, color: '#6b7280', maxWidth: 760, lineHeight: 1.7 }}>
        {calendar.description || 'This calendar collects the events hosted under this owner calendar.'}
      </p>
    </section>
  );
}

function EventsTab({
  calendar,
  groupedEvents,
  timelineFilter,
  onTimelineFilterChange,
}: {
  calendar: OwnerCalendar;
  groupedEvents: Array<{ date: Date; events: CalendarEvent[] }>;
  timelineFilter: 'upcoming' | 'past';
  onTimelineFilterChange: (value: 'upcoming' | 'past') => void;
}) {
  return (
    <section style={{ display: 'grid', gap: 22 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 800 }}>Events</h2>
          <Link
            href={`/create-event?calendar=${calendar.id}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid rgba(148,163,184,0.18)',
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              color: '#6b7280',
              textDecoration: 'none',
            }}
            aria-label="Create event in this calendar"
          >
            <Plus size={16} />
          </Link>
        </div>
        <div
          style={{
            display: 'inline-flex',
            padding: 4,
            borderRadius: 14,
            background: '#f3f4f6',
            border: '1px solid rgba(148,163,184,0.18)',
          }}
        >
          {(['upcoming', 'past'] as const).map((value) => {
            const isActive = timelineFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onTimelineFilterChange(value)}
                style={{
                  border: 'none',
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#111827' : '#9ca3af',
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 8px 18px rgba(17,39,45,0.08)' : 'none',
                  textTransform: 'capitalize',
                }}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      {groupedEvents.length === 0 ? (
        <div
          style={{
            padding: 30,
            borderRadius: 24,
            background: '#fff',
            border: '1px dashed rgba(148,163,184,0.2)',
            color: '#6b7280',
          }}
        >
          No {timelineFilter} events in this calendar yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 26 }}>
          {groupedEvents.map((group) => (
            <div key={group.date.toISOString()} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 18 }}>
                <div style={{ paddingTop: 6 }}>
                  <div
                    style={{
                      fontSize: '1.9rem',
                      fontWeight: 800,
                      color: '#111827',
                      marginBottom: 4,
                    }}
                  >
                    {formatDayLabel(group.date)}
                  </div>
                  <div style={{ color: '#9ca3af', fontWeight: 600 }}>
                    {group.date.toLocaleDateString('en-IN', { weekday: 'long' })}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 16 }}>
                  {group.events.map((event) => (
                    <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr',
                          gap: 14,
                          alignItems: 'stretch',
                        }}
                      >
                        <div style={{ display: 'grid', justifyItems: 'center', paddingTop: 12 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'rgba(17,24,39,0.22)',
                            }}
                          />
                          <div
                            style={{
                              width: 1,
                              minHeight: '100%',
                              borderLeft: '1px dashed rgba(148,163,184,0.28)',
                              marginTop: 10,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 128px',
                            gap: 18,
                            padding: 18,
                            borderRadius: 22,
                            background: '#fff',
                            border: '1px solid rgba(148,163,184,0.16)',
                            boxShadow: '0 14px 36px rgba(17,39,45,0.05)',
                          }}
                        >
                          <div>
                            <div style={{ color: '#9ca3af', fontSize: '1.05rem', marginBottom: 8 }}>
                              {event.time ||
                                new Date(event.date).toLocaleTimeString('en-IN', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                            </div>
                            <div
                              style={{
                                fontSize: '1.8rem',
                                fontWeight: 800,
                                color: '#111827',
                                marginBottom: 10,
                              }}
                            >
                              {event.title}
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gap: 8,
                                color: '#9ca3af',
                                fontSize: '0.98rem',
                                marginBottom: 14,
                              }}
                            >
                              <div style={metaRowStyle}>
                                <MapPin size={16} />
                                <span>{event.is_online ? 'Online event' : event.location || 'To Be Announced'}</span>
                              </div>
                              <div style={metaRowStyle}>
                                <Users size={16} />
                                <span>
                                  {event.attendee_count > 0
                                    ? `${event.attendee_count} guest${event.attendee_count === 1 ? '' : 's'}`
                                    : 'No guests'}
                                </span>
                              </div>
                              <div style={metaRowStyle}>
                                <CalendarDays size={16} />
                                <span>{formatMonthDay(new Date(event.date))}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <div style={tagButtonStyle}>+ Add Tag</div>
                              <Link href={`/manage/${event.slug}`} style={manageLinkStyle}>
                                Manage Event
                                <ArrowRight size={15} />
                              </Link>
                            </div>
                          </div>

                          <div
                            style={{
                              alignSelf: 'center',
                              width: 108,
                              height: 108,
                              borderRadius: 16,
                              overflow: 'hidden',
                              background: '#f3f4f6',
                            }}
                          >
                            <img
                              src={event.cover_image || DEFAULT_EVENT_COVER}
                              alt={event.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PeopleTab({
  people,
  peopleCount,
  peopleSearch,
  peopleFilter,
  peopleSort,
  inviteName,
  inviteEmail,
  showInviteForm,
  onPeopleSearchChange,
  onPeopleFilterChange,
  onPeopleSortChange,
  onInviteNameChange,
  onInviteEmailChange,
  onToggleInviteForm,
  onAddPerson,
  onDownload,
}: {
  people: CalendarPerson[];
  peopleCount: number;
  peopleSearch: string;
  peopleFilter: PeopleFilter;
  peopleSort: PeopleSort;
  inviteName: string;
  inviteEmail: string;
  showInviteForm: boolean;
  onPeopleSearchChange: (value: string) => void;
  onPeopleFilterChange: (value: PeopleFilter) => void;
  onPeopleSortChange: (value: PeopleSort) => void;
  onInviteNameChange: (value: string) => void;
  onInviteEmailChange: (value: string) => void;
  onToggleInviteForm: () => void;
  onAddPerson: () => void;
  onDownload: () => void;
}) {
  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>People ({peopleCount})</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" style={smallActionButtonStyle} onClick={onToggleInviteForm}>
            <Plus size={16} />
            Add People
          </button>
          <button type="button" style={iconActionButtonStyle} onClick={onDownload} aria-label="Download people csv">
            <Download size={16} />
          </button>
        </div>
      </div>

      {showInviteForm && (
        <div style={panelStyle}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginBottom: 12 }}>
            Add someone to this calendar
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
            <input
              value={inviteName}
              onChange={(event) => onInviteNameChange(event.target.value)}
              placeholder="Full name"
              style={fieldStyle}
            />
            <input
              value={inviteEmail}
              onChange={(event) => onInviteEmailChange(event.target.value)}
              placeholder="Email address"
              style={fieldStyle}
            />
            <button type="button" className="primary-button" style={{ minHeight: '46px' }} onClick={onAddPerson}>
              Save
            </button>
          </div>
        </div>
      )}

      <div style={searchShellStyle}>
        <Search size={18} color="#9ca3af" />
        <input
          value={peopleSearch}
          onChange={(event) => onPeopleSearchChange(event.target.value)}
          placeholder="Search"
          style={shellInputStyle}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={peopleFilter} onChange={(event) => onPeopleFilterChange(event.target.value as PeopleFilter)} style={selectStyle}>
            <option value="all">Filter</option>
            <option value="owner">Owner</option>
            <option value="invitee">Invited</option>
          </select>
        </div>
        <select value={peopleSort} onChange={(event) => onPeopleSortChange(event.target.value as PeopleSort)} style={selectStyle}>
          <option value="recent">Recently Joined</option>
          <option value="name">Name</option>
        </select>
      </div>

      {people.length === 0 ? (
        <div style={emptyPanelStyle}>No people added to this calendar yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {people.map((person) => (
            <div key={person.id} style={listRowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: person.kind === 'owner' ? 'linear-gradient(135deg, #fda4af, #60a5fa)' : 'linear-gradient(135deg, #99f6e4, #0e7678)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    fontWeight: 800,
                  }}
                >
                  {person.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>
                    {person.name}
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}> {person.email}</span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: 2 }}>
                    {person.kind === 'owner' ? 'Calendar owner' : 'Added to this calendar'}
                  </div>
                </div>
              </div>
              <div style={{ color: '#9ca3af', fontWeight: 600 }}>{formatShortDate(person.joined_at)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NewslettersTab({
  drafts,
  published,
  verified,
  subject,
  content,
  onSubjectChange,
  onContentChange,
  onVerify,
  onSaveDraft,
  onPublish,
}: {
  drafts: NewsletterItem[];
  published: NewsletterItem[];
  verified: boolean;
  subject: string;
  content: string;
  onSubjectChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onVerify: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <section style={{ display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: 800 }}>Drafts</h2>
        <p style={{ margin: 0, color: '#64748b' }}>
          As you write, your drafts will be automatically saved and appear here.
        </p>
      </div>

      {!verified && (
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(245,158,11,0.28)',
            background: 'rgba(255,247,237,0.9)',
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: '#d97706' }}>Please verify your calendar.</div>
            <div style={{ color: '#d97706', marginTop: 2 }}>
              Share information about your calendar to send newsletters.
            </div>
          </div>
          <button type="button" style={verifyButtonStyle} onClick={onVerify}>
            Verify
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginBottom: 12 }}>
          Compose newsletter
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            placeholder="Subject line"
            style={fieldStyle}
          />
          <textarea
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder="Write your update for subscribers..."
            rows={6}
            style={{ ...fieldStyle, resize: 'vertical', paddingTop: 12 }}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="secondary-button" style={smallActionButtonStyle} onClick={onSaveDraft}>
              Save Draft
            </button>
            <button type="button" className="primary-button" style={{ minHeight: '46px' }} onClick={onPublish} disabled={!verified}>
              Publish
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {drafts.length > 0 ? (
          drafts.map((item) => (
            <div key={item.id} style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#111827' }}>{item.subject}</div>
                  <div style={{ color: '#6b7280', marginTop: 4 }}>{item.content}</div>
                </div>
                <div style={{ color: '#94a3b8', fontWeight: 600 }}>{formatShortDate(item.updated_at)}</div>
              </div>
            </div>
          ))
        ) : (
          <div style={emptyPanelStyle}>No newsletter drafts yet.</div>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '1.8rem', fontWeight: 800 }}>Published</h3>
        {published.length > 0 ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {published.map((item) => (
              <div key={item.id} style={panelStyle}>
                <div style={{ fontWeight: 800, color: '#111827' }}>{item.subject}</div>
                <div style={{ color: '#6b7280', marginTop: 6 }}>{item.content}</div>
                <div style={{ color: '#94a3b8', marginTop: 10, fontWeight: 600 }}>
                  Published {formatShortDate(item.updated_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyPanelStyle}>No newsletters published yet.</div>
        )}
      </div>
    </section>
  );
}

function PaymentTab({
  calendar,
  summary,
  coupons,
  couponCode,
  couponAmount,
  couponKind,
  showCouponForm,
  onToggleCouponForm,
  onCouponCodeChange,
  onCouponAmountChange,
  onCouponKindChange,
  onCreateCoupon,
  onToggleCoupon,
  onDeleteCoupon,
}: {
  calendar: OwnerCalendar;
  summary: { paidEvents: number; grossSales: number; confirmedTickets: number };
  coupons: CouponItem[];
  couponCode: string;
  couponAmount: string;
  couponKind: CouponKind;
  showCouponForm: boolean;
  onToggleCouponForm: () => void;
  onCouponCodeChange: (value: string) => void;
  onCouponAmountChange: (value: string) => void;
  onCouponKindChange: (value: CouponKind) => void;
  onCreateCoupon: () => void;
  onToggleCoupon: (couponId: string) => void;
  onDeleteCoupon: (couponId: string) => void;
}) {
  return (
    <section style={{ display: 'grid', gap: 28 }}>
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: '2rem', fontWeight: 800 }}>Ticket Sales</h2>
        <div style={panelStyle}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#111827', fontWeight: 800, fontSize: '1.8rem' }}>
              <CreditCard size={24} color="var(--primary-color)" />
              Start Selling Tickets
            </div>
            <div style={{ color: '#64748b', maxWidth: 700 }}>
              Start selling tickets to your events by creating paid events under this calendar. It usually takes less than 5 minutes to set up.
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href={`/create-event/form?calendar=${calendar.id}`} className="primary-button">
                Get Started
              </Link>
              <div style={metricPillStyle}>{summary.paidEvents} paid events</div>
              <div style={metricPillStyle}>{summary.confirmedTickets} confirmed tickets</div>
              <div style={metricPillStyle}>{formatMoney(summary.grossSales)} gross sales</div>
            </div>
          </div>
        </div>
        <p style={{ color: '#64748b', margin: '16px 0 0' }}>
          Payment tools are managed per event. Coupons below can be reused across the events in this calendar.
        </p>
      </div>

      <div style={{ borderTop: '1px solid rgba(148,163,184,0.18)', paddingTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Coupons</h3>
            <p style={{ margin: '6px 0 0', color: '#64748b' }}>
              Create coupons that can be applied to any event managed by your calendar.
            </p>
          </div>
          <button type="button" className="secondary-button" style={smallActionButtonStyle} onClick={onToggleCouponForm}>
            <Plus size={16} />
            Create
          </button>
        </div>

        {showCouponForm && (
          <div style={{ ...panelStyle, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px auto', gap: 12 }}>
              <input
                value={couponCode}
                onChange={(event) => onCouponCodeChange(event.target.value)}
                placeholder="WELCOME20"
                style={fieldStyle}
              />
              <select value={couponKind} onChange={(event) => onCouponKindChange(event.target.value as CouponKind)} style={selectStyle}>
                <option value="percent">Percent</option>
                <option value="flat">Flat amount</option>
              </select>
              <input
                value={couponAmount}
                onChange={(event) => onCouponAmountChange(event.target.value)}
                placeholder="20"
                style={fieldStyle}
              />
              <button type="button" className="primary-button" style={{ minHeight: '46px' }} onClick={onCreateCoupon}>
                Save
              </button>
            </div>
          </div>
        )}

        {coupons.length === 0 ? (
          <div style={emptyPanelStyle}>No Coupons. You have not set up any coupons.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {coupons.map((coupon) => (
              <div key={coupon.id} style={listRowStyle}>
                <div>
                  <div style={{ fontWeight: 800, color: '#111827' }}>
                    {coupon.code} - {coupon.kind === 'percent' ? `${coupon.amount}% off` : `${formatMoney(coupon.amount)} off`}
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 4 }}>{formatShortDate(coupon.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" style={statusToggleStyle(coupon.active)} onClick={() => onToggleCoupon(coupon.id)}>
                    {coupon.active ? 'Active' : 'Inactive'}
                  </button>
                  <button type="button" style={ghostButtonStyle} onClick={() => onDeleteCoupon(coupon.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InsightsTab({
  metrics,
  events,
}: {
  metrics: {
    totalEvents: number;
    lastWeekEvents: number;
    totalTickets: number;
    lastWeekTickets: number;
    totalSubscribers: number;
    lastWeekSubscribers: number;
    totalSales: number;
    lastWeekSales: number;
  };
  events: CalendarEvent[];
}) {
  const rankedEvents = [...events].sort(
    (left, right) => Number(right.ticket_sales || 0) - Number(left.ticket_sales || 0),
  );

  return (
    <section style={{ display: 'grid', gap: 28 }}>
      <div style={insightsGridStyle}>
        <StatsCard label="Events" value={String(metrics.totalEvents)} helper={`${metrics.lastWeekEvents} last week`} icon={<CalendarDays size={16} />} />
        <StatsCard label="Tickets" value={String(metrics.totalTickets)} helper={`${metrics.lastWeekTickets} last week`} icon={<Ticket size={16} />} />
        <StatsCard label="Subscribers" value={String(metrics.totalSubscribers)} helper={`${metrics.lastWeekSubscribers} last week`} icon={<Users size={16} />} />
        <StatsCard label="Sales" value={formatMoney(metrics.totalSales)} helper={`${formatMoney(metrics.lastWeekSales)} last week`} icon={<CreditCard size={16} />} />
      </div>

      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Event Performance</h3>
          <div style={metricPillStyle}>By Event</div>
        </div>
        {rankedEvents.length === 0 ? (
          <div style={emptyPanelStyle}>No feedback or sales data yet. Create events under this calendar to start seeing insights.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {rankedEvents.slice(0, 5).map((event) => (
              <div key={event.id} style={listRowStyle}>
                <div>
                  <div style={{ fontWeight: 800, color: '#111827' }}>{event.title}</div>
                  <div style={{ color: '#64748b', marginTop: 4 }}>
                    {event.confirmed_count} confirmed - {event.attendee_count} total reservations
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: '#111827' }}>{formatMoney(Number(event.ticket_sales || 0))}</div>
                  <div style={{ color: '#94a3b8', marginTop: 4 }}>{formatShortDate(event.date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SettingsTab({
  settingsForm,
  saving,
  message,
  onChange,
  onOpenCreateCalendar,
  onSave,
}: {
  settingsForm: CalendarSettingsForm;
  saving: boolean;
  message: string;
  onChange: <K extends keyof CalendarSettingsForm>(field: K, value: CalendarSettingsForm[K]) => void;
  onOpenCreateCalendar: () => void;
  onSave: () => void;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('display');
  const [eventVisibility, setEventVisibility] = useState<'public' | 'private'>('public');
  const [publicGuestList, setPublicGuestList] = useState(true);
  const [collectFeedback, setCollectFeedback] = useState(false);
  const [calendarVerified, setCalendarVerified] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const calendarSlug = settingsForm.slug || 'personal';
  const embedCode = `<iframe src="/calendars/${calendarSlug}" width="500" height="450" frameborder="0" style="border: 1px solid #e2e8f0; border-radius: 12px;" allowfullscreen="" aria-hidden="false" tabindex="0"></iframe>`;
  const weeklyQuota = calendarVerified ? 500 : 15;
  const remainingQuota = weeklyQuota;
  const locationLabel =
    settingsForm.location_scope === 'city' ? settingsForm.city || 'City calendar' : 'Global calendar';

  function handleAddTag() {
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    if (tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) return;
    setTags((current) => [...current, nextTag]);
    setTagInput('');
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  }

  function renderPanel() {
    if (activeSection === 'display') {
      return (
        <div style={panelStyle}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 16 }}>Display</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={settingsGridStyle}>
              <div>
                <label style={labelStyle}>Calendar Name</label>
                <input value={settingsForm.name} onChange={(event) => onChange('name', event.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Public URL</label>
                <input value={settingsForm.slug} onChange={(event) => onChange('slug', slugify(event.target.value))} style={fieldStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={settingsForm.description}
                onChange={(event) => onChange('description', event.target.value)}
                rows={4}
                style={{ ...fieldStyle, resize: 'vertical', paddingTop: 12 }}
              />
            </div>

            <div style={settingsGridStyle}>
              <div>
                <label style={labelStyle}>Tint Color</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 8 }}>
                  {TINT_OPTIONS.map((color) => {
                    const active = settingsForm.tint_color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onChange('tint_color', color)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: active ? '3px solid rgba(17,24,39,0.25)' : 'none',
                          background: color,
                          boxShadow: active ? '0 0 0 3px rgba(14,118,120,0.12)' : 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <div style={{ display: 'grid', gap: 10 }}>
                  <select value={settingsForm.location_scope} onChange={(event) => onChange('location_scope', event.target.value as 'city' | 'global')} style={selectStyle}>
                    <option value="global">Global</option>
                    <option value="city">City</option>
                  </select>
                  <input
                    value={settingsForm.city}
                    onChange={(event) => onChange('city', event.target.value)}
                    disabled={settingsForm.location_scope === 'global'}
                    placeholder={settingsForm.location_scope === 'global' ? 'Global calendar' : 'Chennai'}
                    style={{ ...fieldStyle, background: settingsForm.location_scope === 'global' ? '#f8fafc' : '#fff' }}
                  />
                </div>
              </div>
            </div>

            {message && (
              <div
                style={{
                  borderRadius: 14,
                  padding: '12px 14px',
                  background: message.includes('saved') ? 'rgba(34,197,94,0.12)' : 'rgba(255,244,244,0.9)',
                  color: message.includes('saved') ? '#166534' : '#b91c1c',
                  fontWeight: 700,
                }}
              >
                {message}
              </div>
            )}

            <div>
              <button type="button" className="primary-button" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === 'options') {
      return (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>Event Defaults</div>
            <div style={{ color: '#64748b', marginBottom: 18 }}>
              Default settings for new events created on this calendar.
            </div>
            <div style={{ borderRadius: 18, border: '1px solid rgba(148,163,184,0.18)', overflow: 'hidden' }}>
              <div style={settingsRowStyle}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>Event Visibility</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.92rem', marginTop: 4 }}>
                    Whether events are shown on the calendar page.
                  </div>
                </div>
                <select value={eventVisibility} onChange={(event) => setEventVisibility(event.target.value as 'public' | 'private')} style={selectStyle}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div style={settingsRowStyle}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>Public Guest List</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.92rem', marginTop: 4 }}>
                    Whether to show guest list on event pages.
                  </div>
                </div>
                <ToggleChip active={publicGuestList} onToggle={() => setPublicGuestList((current) => !current)} />
              </div>
              <div style={{ ...settingsRowStyle, borderBottom: 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>Collect Feedback</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.92rem', marginTop: 4 }}>
                    Email guests after the event to collect feedback.
                  </div>
                </div>
                <ToggleChip active={collectFeedback} onToggle={() => setCollectFeedback((current) => !current)} />
              </div>
            </div>
            <p style={{ color: '#64748b', margin: '16px 0 0' }}>
              Changing these defaults does not affect existing events.
            </p>
          </div>

          <div style={panelStyle}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>Tracking</div>
            <div style={{ color: '#64748b', marginBottom: 18 }}>
              Track event registrations and conversions from Google or Meta ads.
            </div>
            <div style={{ ...emptyPanelStyle, padding: 16 }}>
              Upgrade to Calendar Plus to integrate with Google or Meta ads.
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === 'admins') {
      return (
        <div style={{ ...panelStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', marginBottom: 10 }}>
            Convert to a Team Calendar
          </div>
          <div style={{ color: '#64748b', maxWidth: 420, margin: '0 auto 18px' }}>
            Your team calendar lets you easily manage, share, and curate your events.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
            <FeatureMini title="Manage with your team" />
            <FeatureMini title="Create a public calendar page" />
            <FeatureMini title="Curate community events" />
          </div>
          <button type="button" className="primary-button" onClick={onOpenCreateCalendar}>
            Get Started
          </button>
        </div>
      );
    }

    if (activeSection === 'tags') {
      return (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>Tags</div>
            <div style={{ color: '#64748b', marginBottom: 18 }}>
              Organize this calendar with tags so people can understand what it is about.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag like Startup, Design, Community"
                style={fieldStyle}
              />
              <button type="button" className="secondary-button" style={{ minHeight: 46 }} onClick={handleAddTag}>
                Add Tag
              </button>
            </div>
            {tags.length === 0 ? (
              <div style={{ ...emptyPanelStyle, marginTop: 16 }}>No tags added yet.</div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {tags.map((tag) => (
                  <button key={tag} type="button" onClick={() => handleRemoveTag(tag)} style={tagPillStyle}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeSection === 'embed') {
      return (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>Embed Events</div>
            <div style={{ color: '#64748b', marginBottom: 18 }}>
              Have your own site? Embed your calendar to easily share a live view of your upcoming events.
            </div>
            <div style={{ borderRadius: 20, border: '1px solid rgba(148,163,184,0.18)', padding: 18, background: '#f8fafc' }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 800, color: '#111827' }}>{settingsForm.name || 'Personal'}</div>
                <div style={{ color: '#64748b' }}>{locationLabel}</div>
                <div style={{ ...panelStyle, padding: 16 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: 10 }}>Preview</div>
                  <div style={{ fontWeight: 700, color: '#111827' }}>Upcoming events will appear here.</div>
                  <div style={{ color: '#64748b', marginTop: 6 }}>Slug: {calendarSlug}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', marginBottom: 12 }}>Code to Copy</div>
            <textarea readOnly value={embedCode} rows={7} style={{ ...fieldStyle, paddingTop: 12, fontFamily: 'monospace', resize: 'vertical' }} />
          </div>
        </div>
      );
    }

    if (activeSection === 'developer') {
      return (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>API Keys</div>
                <div style={{ color: '#64748b', marginTop: 6 }}>
                  Use the calendar API or integrate with automation tools.
                </div>
              </div>
            </div>
            <div style={emptyPanelStyle}>No API keys yet. Upgrade to Calendar Plus to create API keys.</div>
          </div>

          <div style={panelStyle}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>Webhooks</div>
            <div style={{ color: '#64748b', marginBottom: 12 }}>
              Get notified in real time about activity on your calendar.
            </div>
            <div style={emptyPanelStyle}>No webhooks yet. Upgrade to Calendar Plus to create webhooks.</div>
            <div style={{ color: '#94a3b8', marginTop: 16, fontWeight: 600 }}>
              Calendar ID: <span style={{ color: '#64748b' }}>{calendarSlug}</span>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === 'send-limit') {
      return (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>Send Limit</div>
                <div style={{ color: '#64748b', marginTop: 6 }}>
                  Your calendar has a weekly quota for sending invites and newsletters.
                </div>
              </div>
              <button type="button" style={verifyButtonStyle} onClick={() => setCalendarVerified(true)}>
                {calendarVerified ? 'Verified' : 'Verify'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end', marginTop: 24 }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Used</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827' }}>0</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Remaining</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827' }}>
                  {remainingQuota} / {weeklyQuota}
                </div>
              </div>
            </div>

            <div style={{ ...emptyPanelStyle, marginTop: 16 }}>
              No usage this week. You haven&apos;t sent anything that counts towards your quota.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ color: '#ec4899', fontWeight: 700, fontSize: '0.9rem' }}>Upgrade to</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827' }}>Calendar Plus</div>
          </div>
          <div style={{ display: 'inline-flex', borderRadius: 12, background: '#f3f4f6', padding: 4 }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={billingChipStyle(billingCycle === 'monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              style={billingChipStyle(billingCycle === 'annual')}
            >
              Annual
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: '#111827' }}>
            {billingCycle === 'monthly' ? '$69' : '$690'}
          </div>
          <div style={{ color: '#64748b' }}>
            Per {billingCycle === 'monthly' ? 'month' : 'year'}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {['No platform fees', 'Priority support', '5 admins included', 'API + Zapier access'].map((benefit) => (
            <div key={benefit} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#475569', fontWeight: 700 }}>
              <CheckCircle2 size={16} color="#ec4899" />
              {benefit}
            </div>
          ))}
        </div>

        <button type="button" className="primary-button">
          Upgrade to Calendar Plus
        </button>
      </div>
    );
  }

  return (
    <section style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24 }}>
      <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        {SETTINGS_SECTIONS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              style={{
                border: 'none',
                background: isActive ? 'rgba(14,118,120,0.08)' : 'transparent',
                borderRadius: 12,
                padding: '8px 10px',
                textAlign: 'left',
                color: isActive ? '#111827' : '#94a3b8',
                fontWeight: isActive ? 800 : 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </aside>

      <div style={{ display: 'grid', gap: 18 }}>{renderPanel()}</div>
    </section>
  );
}

function StatsCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: JSX.Element;
}) {
  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontWeight: 700 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: '2rem', lineHeight: 1.1, fontWeight: 800, color: '#111827', marginTop: 6 }}>
        {value}
      </div>
      <div style={{ color: '#64748b', marginTop: 4 }}>{helper}</div>
    </div>
  );
}

function FeatureMini({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: '18px 12px',
        borderRadius: 16,
        background: '#f8fafc',
        border: '1px solid rgba(148,163,184,0.16)',
        color: '#475569',
        fontWeight: 700,
        minHeight: 100,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
      }}
    >
      {title}
    </div>
  );
}

function ToggleChip({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        border: 'none',
        background: active ? '#111827' : '#e5e7eb',
        padding: 4,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          display: 'block',
          transform: active ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 160ms ease',
        }}
      />
    </button>
  );
}

const panelStyle: React.CSSProperties = {
  padding: 22,
  borderRadius: 24,
  background: '#fff',
  border: '1px solid rgba(148,163,184,0.18)',
  boxShadow: '0 18px 42px rgba(17,39,45,0.05)',
};

const emptyPanelStyle: React.CSSProperties = {
  ...panelStyle,
  color: '#64748b',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.22)',
  padding: '0 14px',
  fontSize: '0.95rem',
  outline: 'none',
  color: '#111827',
  background: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#64748b',
  fontSize: '0.9rem',
  marginBottom: 8,
  fontWeight: 600,
};

const searchShellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.18)',
  background: '#fff',
  padding: '0 14px',
  minHeight: 46,
};

const shellInputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: '#111827',
  fontSize: '0.95rem',
};

const selectStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.18)',
  background: '#fff',
  color: '#475569',
  padding: '0 12px',
  fontWeight: 600,
  outline: 'none',
};

const listRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '16px 18px',
  borderRadius: 18,
  background: '#fff',
  border: '1px solid rgba(148,163,184,0.18)',
};

const smallActionButtonStyle: React.CSSProperties = {
  minHeight: '42px',
  paddingInline: '16px',
};

const iconActionButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.18)',
  background: '#fff',
  color: '#64748b',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const verifyButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(245,158,11,0.4)',
  background: '#fff',
  color: '#d97706',
  fontWeight: 800,
  borderRadius: 12,
  padding: '10px 14px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
};

const metricPillStyle: React.CSSProperties = {
  borderRadius: 999,
  background: 'rgba(14,118,120,0.08)',
  color: 'var(--primary-color)',
  fontWeight: 700,
  padding: '10px 14px',
  display: 'inline-flex',
  alignItems: 'center',
};

const ghostButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(148,163,184,0.18)',
  background: '#fff',
  color: '#64748b',
  fontWeight: 700,
  padding: '9px 12px',
  cursor: 'pointer',
};

const manageLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  textDecoration: 'none',
  background: '#f9fafb',
  color: '#4b5563',
  padding: '8px 12px',
  borderRadius: 12,
  fontWeight: 700,
};

const tagButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#f3f4f6',
  color: '#9ca3af',
  padding: '8px 12px',
  borderRadius: 12,
  fontWeight: 700,
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const insightsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
};

const settingsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
};

const settingsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '16px 18px',
  borderBottom: '1px solid rgba(148,163,184,0.18)',
};

const tagPillStyle: React.CSSProperties = {
  border: '1px solid rgba(14,118,120,0.16)',
  background: 'rgba(14,118,120,0.08)',
  color: 'var(--primary-color)',
  borderRadius: 999,
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
};

function billingChipStyle(active: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: active ? '#fff' : 'transparent',
    color: active ? '#111827' : '#64748b',
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: active ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
  };
}

function statusToggleStyle(active: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: active ? 'rgba(34,197,94,0.12)' : '#fff',
    color: active ? '#166534' : '#64748b',
    fontWeight: 700,
    padding: '9px 12px',
    cursor: 'pointer',
  };
}

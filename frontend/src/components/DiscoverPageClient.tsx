'use client';

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Cpu,
  Globe2,
  Loader2,
  MapPin,
  Rocket,
  Search,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { DEFAULT_EVENT_COVER } from '@/lib/defaults';

type CategoryId = 'startup' | 'business' | 'tech';

type DiscoverEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date?: string;
  time?: string;
  location?: string;
  is_online: boolean;
  cover_image?: string;
  attendee_count: number;
  confirmed_count: number;
  host_name: string;
  calendar_name?: string | null;
  calendar_slug?: string | null;
  calendar_tint_color?: string | null;
  is_paid: boolean;
  ticket_price: number;
};

type CategoryConfig = {
  id: CategoryId;
  label: string;
  description: string;
  helper: string;
  accent: string;
  icon: LucideIcon;
  keywords: string[];
};

type FeaturedCalendar = {
  key: string;
  name: string;
  color: string;
  hostName: string;
  eventCount: number;
  upcomingCount: number;
  nextEvent?: DiscoverEvent;
  categories: CategoryId[];
  description: string;
};

const LOCAL_CITY_KEY = 'evently_discover_city';
const FOLLOWED_CALENDARS_KEY = 'evently_followed_calendars';

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    id: 'startup',
    label: 'Startup',
    description: 'Pitch nights, founder circles, demo days, and operator meetups.',
    helper: 'Ideal for founders, builders, and early-stage teams.',
    accent: '#ff7b72',
    icon: Rocket,
    keywords: [
      'startup',
      'founder',
      'founders',
      'venture',
      'vc',
      'pitch',
      'accelerator',
      'demo day',
      'seed',
      'incubator',
      'launch',
      'builder',
      'entrepreneur',
    ],
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Leadership, sales, growth, partnerships, and networking events.',
    helper: 'Great for operators, marketers, consultants, and community leaders.',
    accent: '#f59e0b',
    icon: BriefcaseBusiness,
    keywords: [
      'business',
      'growth',
      'sales',
      'marketing',
      'leadership',
      'network',
      'networking',
      'strategy',
      'finance',
      'revenue',
      'brand',
      'partnership',
      'community',
      'summit',
    ],
  },
  {
    id: 'tech',
    label: 'Tech',
    description: 'Engineering, AI, product, developer, cloud, and data gatherings.',
    helper: 'Perfect for builders shipping products and learning fast.',
    accent: '#0e7678',
    icon: Cpu,
    keywords: [
      'tech',
      'developer',
      'engineering',
      'engineer',
      'software',
      'product',
      'design',
      'data',
      'cloud',
      'code',
      'coding',
      'hack',
      'hackathon',
      'ai',
      'ml',
      'saas',
      'web3',
      'api',
    ],
  },
];

function normalizeEvents(payload: unknown): DiscoverEvent[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.reduce<DiscoverEvent[]>((list, item) => {
    const event = item as Partial<DiscoverEvent>;
    if (!event?.id || !event?.slug || !event?.title) {
      return list;
    }

    list.push({
      id: String(event.id),
      slug: String(event.slug),
      title: String(event.title),
      description: typeof event.description === 'string' ? event.description : '',
      date: typeof event.date === 'string' ? event.date : undefined,
      time: typeof event.time === 'string' ? event.time : undefined,
      location: typeof event.location === 'string' ? event.location : undefined,
      is_online: Boolean(event.is_online),
      cover_image: typeof event.cover_image === 'string' ? event.cover_image : undefined,
      attendee_count: Number(event.attendee_count || 0),
      confirmed_count: Number(event.confirmed_count || 0),
      host_name: typeof event.host_name === 'string' ? event.host_name : 'Event Host',
      calendar_name: typeof event.calendar_name === 'string' ? event.calendar_name : null,
      calendar_slug: typeof event.calendar_slug === 'string' ? event.calendar_slug : null,
      calendar_tint_color:
        typeof event.calendar_tint_color === 'string' ? event.calendar_tint_color : null,
      is_paid: Boolean(event.is_paid),
      ticket_price: Number(event.ticket_price || 0),
    });

    return list;
  }, []);
}

function parseEventDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatEventDate(event: DiscoverEvent) {
  const parsed = parseEventDate(event.date);
  if (!parsed) {
    return 'Date TBA';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatEventDateTime(event: DiscoverEvent) {
  const dateLabel = formatEventDate(event);
  return event.time ? `${dateLabel} - ${event.time}` : dateLabel;
}

function formatGuestCount(event: DiscoverEvent) {
  const guests = Number(event.confirmed_count || event.attendee_count || 0);
  if (guests <= 0) {
    return 'Freshly listed';
  }
  if (guests === 1) {
    return '1 guest';
  }
  return `${guests} guests`;
}

function eventSearchBlob(event: DiscoverEvent) {
  return [
    event.title,
    event.description,
    event.location,
    event.host_name,
    event.calendar_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesKeywordGroup(event: DiscoverEvent, keywords: string[]) {
  const blob = eventSearchBlob(event);
  return keywords.some((keyword) => blob.includes(keyword));
}

function deriveEventCategories(event: DiscoverEvent): CategoryId[] {
  const matched = CATEGORY_CONFIG.filter((category) =>
    matchesKeywordGroup(event, category.keywords),
  ).map((category) => category.id);

  if (matched.length > 0) {
    return matched;
  }

  const fallbackBlob = eventSearchBlob(event);
  if (event.is_online || fallbackBlob.includes('developer') || fallbackBlob.includes('product')) {
    return ['tech'];
  }
  if (
    fallbackBlob.includes('network') ||
    fallbackBlob.includes('launch') ||
    fallbackBlob.includes('founder')
  ) {
    return ['startup'];
  }
  return ['business'];
}

function calendarKeyForEvent(event: DiscoverEvent) {
  return event.calendar_slug || `${event.host_name.toLowerCase().replace(/\s+/g, '-')}-collection`;
}

function inferCityFromTimeZone(timeZone?: string) {
  if (!timeZone || !timeZone.includes('/')) {
    return '';
  }

  const rawCity = timeZone.split('/').pop() || '';
  const normalized = rawCity.replace(/_/g, ' ').trim();

  const aliases: Record<string, string> = {
    calcutta: 'Kolkata',
    saigon: 'Ho Chi Minh City',
  };

  return aliases[normalized.toLowerCase()] || normalized;
}

function cityAliases(city: string) {
  const normalized = city.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const aliasMap: Record<string, string[]> = {
    kolkata: ['kolkata', 'calcutta'],
    calcutta: ['calcutta', 'kolkata'],
    bengaluru: ['bengaluru', 'bangalore'],
    bangalore: ['bangalore', 'bengaluru'],
    mumbai: ['mumbai', 'bombay'],
    bombay: ['bombay', 'mumbai'],
    chennai: ['chennai', 'madras'],
    madras: ['madras', 'chennai'],
    'new york': ['new york', 'nyc'],
  };

  return aliasMap[normalized] || [normalized];
}

function isLocalMatch(event: DiscoverEvent, city: string) {
  const aliases = cityAliases(city);
  if (aliases.length === 0) {
    return false;
  }

  const blob = [event.location, event.description, event.title].filter(Boolean).join(' ').toLowerCase();
  return aliases.some((alias) => blob.includes(alias));
}

function buildCalendarDescription(calendar: FeaturedCalendar) {
  if (calendar.categories.length === 0) {
    return 'Curated recurring events from a reliable organizer.';
  }

  const labels = calendar.categories
    .map((categoryId) => CATEGORY_CONFIG.find((category) => category.id === categoryId)?.label)
    .filter(Boolean)
    .join(', ');

  return `${labels} events from ${calendar.hostName}.`;
}

function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (!element) {
    return;
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function DiscoverPageClient() {
  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [activeCalendarKey, setActiveCalendarKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localCity, setLocalCity] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [followedCalendars, setFollowedCalendars] = useState<string[]>([]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/events');
        if (!mounted) {
          return;
        }
        setEvents(normalizeEvents(response.data));
      } catch (err: any) {
        if (!mounted) {
          return;
        }
        setError(err?.response?.data?.detail || 'Could not load discover events right now.');
        setEvents([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const savedCity = window.localStorage.getItem(LOCAL_CITY_KEY) || '';
    const savedFollowedCalendars = window.localStorage.getItem(FOLLOWED_CALENDARS_KEY);

    setTimeZone(detectedTimeZone);
    setLocalCity(savedCity || inferCityFromTimeZone(detectedTimeZone));

    if (savedFollowedCalendars) {
      try {
        const parsed = JSON.parse(savedFollowedCalendars);
        setFollowedCalendars(Array.isArray(parsed) ? parsed : []);
      } catch {
        setFollowedCalendars([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LOCAL_CITY_KEY, localCity);
  }, [localCity]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(FOLLOWED_CALENDARS_KEY, JSON.stringify(followedCalendars));
  }, [followedCalendars]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return [...events]
      .filter((event) => {
        const parsed = parseEventDate(event.date);
        return parsed ? parsed.getTime() >= now - 86_400_000 : true;
      })
      .sort((left, right) => {
        const leftTime = parseEventDate(left.date)?.getTime() || Number.MAX_SAFE_INTEGER;
        const rightTime = parseEventDate(right.date)?.getTime() || Number.MAX_SAFE_INTEGER;
        return leftTime - rightTime;
      });
  }, [events]);

  const categoryCards = useMemo(
    () =>
      CATEGORY_CONFIG.map((category) => ({
        ...category,
        count: upcomingEvents.filter((event) => deriveEventCategories(event).includes(category.id))
          .length,
      })),
    [upcomingEvents],
  );

  const featuredCalendars = useMemo<FeaturedCalendar[]>(() => {
    const grouped = new Map<string, FeaturedCalendar>();

    upcomingEvents.forEach((event) => {
      const key = calendarKeyForEvent(event);
      const existing = grouped.get(key);
      const eventCategories = deriveEventCategories(event);
      const nextEvent = existing?.nextEvent;
      const shouldReplaceNextEvent =
        !nextEvent ||
        (parseEventDate(event.date)?.getTime() || Number.MAX_SAFE_INTEGER) <
          (parseEventDate(nextEvent.date)?.getTime() || Number.MAX_SAFE_INTEGER);

      if (existing) {
        existing.eventCount += 1;
        existing.upcomingCount += 1;
        existing.categories = Array.from(new Set([...existing.categories, ...eventCategories]));
        if (shouldReplaceNextEvent) {
          existing.nextEvent = event;
        }
        return;
      }

      const calendar: FeaturedCalendar = {
        key,
        name: event.calendar_name || `${event.host_name}'s Calendar`,
        color: event.calendar_tint_color || 'var(--primary-color)',
        hostName: event.host_name,
        eventCount: 1,
        upcomingCount: 1,
        nextEvent: event,
        categories: eventCategories,
        description: '',
      };

      calendar.description = buildCalendarDescription(calendar);
      grouped.set(key, calendar);
    });

    return Array.from(grouped.values())
      .map((calendar) => ({
        ...calendar,
        description: buildCalendarDescription(calendar),
      }))
      .sort((left, right) => {
        if (right.upcomingCount !== left.upcomingCount) {
          return right.upcomingCount - left.upcomingCount;
        }

        const leftDate = parseEventDate(left.nextEvent?.date)?.getTime() || Number.MAX_SAFE_INTEGER;
        const rightDate = parseEventDate(right.nextEvent?.date)?.getTime() || Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })
      .slice(0, 6);
  }, [upcomingEvents]);

  const filteredEvents = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return upcomingEvents.filter((event) => {
      if (selectedCategory !== 'all' && !deriveEventCategories(event).includes(selectedCategory)) {
        return false;
      }

      if (activeCalendarKey && calendarKeyForEvent(event) !== activeCalendarKey) {
        return false;
      }

      if (query && !eventSearchBlob(event).includes(query)) {
        return false;
      }

      return true;
    });
  }, [activeCalendarKey, deferredSearchQuery, selectedCategory, upcomingEvents]);

  const localEvents = useMemo(() => {
    const city = localCity.trim();
    if (!city) {
      return upcomingEvents.filter((event) => event.is_online).slice(0, 4);
    }

    const matched = upcomingEvents.filter((event) => isLocalMatch(event, city));
    if (matched.length > 0) {
      return matched.slice(0, 4);
    }

    return upcomingEvents
      .filter((event) => event.is_online || deriveEventCategories(event).includes('business'))
      .slice(0, 4);
  }, [localCity, upcomingEvents]);

  const localLabel = localCity.trim() || inferCityFromTimeZone(timeZone) || 'your city';
  const selectedCategoryLabel =
    selectedCategory === 'all'
      ? 'All upcoming events'
      : CATEGORY_CONFIG.find((category) => category.id === selectedCategory)?.label ||
        'Filtered events';

  function toggleCalendarFollow(key: string) {
    setFollowedCalendars((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 8% 12%, rgba(14,118,120,0.14), transparent 24%), radial-gradient(circle at 92% 8%, rgba(255,193,138,0.18), transparent 22%), linear-gradient(180deg, #ffffff 0%, #f5fbfb 100%)',
      }}
    >
      <section
        id="discover-categories"
        className="page-shell"
        style={{ paddingTop: '36px', paddingBottom: '34px' }}
      >
        <div style={sectionHeadingRowStyle}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <span className="eyebrow" style={{ width: 'fit-content' }}>
              <Sparkles size={16} />
              Browse by Category
            </span>
            <h2 style={sectionTitleStyle}>Find the right room faster</h2>
            <p style={sectionCopyStyle}>
              Every category card narrows the feed instantly so users can jump from curiosity to a
              relevant shortlist.
            </p>
          </div>

          {(selectedCategory !== 'all' || activeCalendarKey || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setActiveCalendarKey(null);
                setSearchQuery('');
              }}
              style={clearButtonStyle}
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="discover-category-grid">
          {categoryCards.map((category) => {
            const Icon = category.icon;
            const active = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                className="discover-category-card surface-panel"
                onClick={() => {
                  setSelectedCategory(category.id);
                  setActiveCalendarKey(null);
                  scrollToSection('discover-events');
                }}
                style={{
                  ...categoryCardStyle,
                  borderColor: active ? category.accent : 'var(--border-color)',
                  boxShadow: active ? `0 24px 40px ${category.accent}24` : 'var(--shadow-card)',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '18px',
                    display: 'grid',
                    placeItems: 'center',
                    background: `${category.accent}16`,
                    color: category.accent,
                  }}
                >
                  <Icon size={28} color={category.accent} />
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: '1.36rem', letterSpacing: '-0.03em' }}>
                      {category.label}
                    </h3>
                    <span style={{ ...categoryCountPillStyle, color: category.accent }}>
                      {category.count} events
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {category.description}
                  </p>
                  <div style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    {category.helper}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section id="discover-events" className="page-shell" style={{ paddingBottom: '34px' }}>
        <div style={sectionHeadingRowStyle}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <span className="eyebrow" style={{ width: 'fit-content' }}>
              <CalendarDays size={16} />
              {selectedCategoryLabel}
            </span>
            <h2 style={sectionTitleStyle}>Browse events with cleaner context</h2>
            <p style={sectionCopyStyle}>
              Cards surface date, host, location, pricing, and guest momentum without making people
              hunt for details.
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginBottom: '18px',
              padding: '14px 16px',
              borderRadius: '18px',
              background: 'rgba(255,244,244,0.96)',
              border: '1px solid rgba(220,38,38,0.14)',
              color: '#b91c1c',
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              minHeight: '300px',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--primary-color)',
            }}
          >
            <Loader2 className="animate-spin" size={38} />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="surface-panel" style={emptyStateStyle}>
            <div style={emptySpotlightIconStyle}>
              <Search size={24} color="var(--primary-color)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
              No events match those filters yet
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '560px' }}>
              Try a broader search, clear the active calendar, or switch categories to bring more
              discover cards back into view.
            </p>
          </div>
        ) : (
          <div className="discover-events-grid">
            {filteredEvents.slice(0, 9).map((event) => {
              const categories = deriveEventCategories(event);
              const primaryCategory = CATEGORY_CONFIG.find(
                (category) => category.id === categories[0],
              );

              return (
                <article key={event.id} className="discover-event-card surface-panel">
                  <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '24px' }}>
                    <img
                      src={event.cover_image || DEFAULT_EVENT_COVER}
                      alt={event.title}
                      style={{ width: '100%', height: '220px', objectFit: 'cover' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, rgba(17,39,45,0) 0%, rgba(17,39,45,0.38) 100%)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: '16px',
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={imageBadgeStyle}>{primaryCategory?.label || 'Discover'}</span>
                      <span style={imageBadgeStyle}>
                        {event.is_paid ? `Rs ${event.ticket_price || 0}` : 'Free'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '14px' }}>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '12px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={hostLabelStyle}>{event.calendar_name || event.host_name}</span>
                        <span style={metaPillStyle}>{formatGuestCount(event)}</span>
                      </div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.38rem',
                          lineHeight: 1.15,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {event.title}
                      </h3>
                      <p style={eventDescriptionStyle}>
                        {event.description ||
                          'A thoughtfully curated event page with enough context to decide quickly.'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gap: '10px', color: 'var(--text-secondary)' }}>
                      <div style={detailRowStyle}>
                        <CalendarDays size={16} color="var(--primary-color)" />
                        <span>{formatEventDateTime(event)}</span>
                      </div>
                      <div style={detailRowStyle}>
                        {event.is_online ? (
                          <Globe2 size={16} color="var(--primary-color)" />
                        ) : (
                          <MapPin size={16} color="var(--primary-color)" />
                        )}
                        <span>
                          {event.is_online
                            ? 'Online event'
                            : event.location || 'Location to be announced'}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>
                        {primaryCategory?.helper || 'Curated event pick'}
                      </div>
                      <Link
                        href={`/events/${event.slug}`}
                        className="secondary-button"
                        style={{ minHeight: '46px' }}
                      >
                        View Event
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="featured-calendars" className="page-shell" style={{ paddingBottom: '34px' }}>
        <div style={sectionHeadingRowStyle}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <span className="eyebrow" style={{ width: 'fit-content' }}>
              <Star size={16} />
              Featured Calendars
            </span>
            <h2 style={sectionTitleStyle}>Highlight recurring organizers and communities</h2>
            <p style={sectionCopyStyle}>
              Calendar cards make it easy to feature popular hosts and let users follow the
              collections they want to see again.
            </p>
          </div>
        </div>

        <div className="discover-calendars-grid">
          {featuredCalendars.map((calendar) => {
            const following = followedCalendars.includes(calendar.key);

            return (
              <article key={calendar.key} className="discover-calendar-card surface-panel">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '14px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: '20px',
                      display: 'grid',
                      placeItems: 'center',
                      background: `linear-gradient(135deg, ${calendar.color}, var(--teal-700))`,
                      color: '#fff',
                      boxShadow: `0 18px 32px ${calendar.color}22`,
                      fontSize: '1.15rem',
                      fontWeight: 800,
                    }}
                  >
                    {calendar.name.slice(0, 1).toUpperCase()}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCalendarFollow(calendar.key)}
                    style={{
                      ...followButtonStyle,
                      background: following ? 'var(--primary-color)' : 'rgba(255,255,255,0.94)',
                      color: following ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {following ? 'Following' : 'Follow'}
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.36rem', letterSpacing: '-0.03em' }}>
                    {calendar.name}
                  </h3>
                  <div style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>
                    Hosted by {calendar.hostName}
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {calendar.description}
                  </p>
                </div>

                <div style={{ display: 'grid', gap: '10px', color: 'var(--text-secondary)' }}>
                  <div style={detailRowStyle}>
                    <CalendarDays size={16} color="var(--primary-color)" />
                    <span>{calendar.upcomingCount} upcoming events</span>
                  </div>
                  <div style={detailRowStyle}>
                    <Clock3 size={16} color="var(--primary-color)" />
                    <span>
                      {calendar.nextEvent
                        ? `Next: ${formatEventDateTime(calendar.nextEvent)}`
                        : 'Next event coming soon'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {calendar.categories.slice(0, 3).map((categoryId) => {
                    const category = CATEGORY_CONFIG.find((item) => item.id === categoryId);
                    return (
                      <span key={categoryId} style={calendarTagStyle}>
                        {category?.label || categoryId}
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCalendarKey(calendar.key);
                    scrollToSection('discover-events');
                  }}
                  style={openCollectionButtonStyle}
                >
                  Open collection
                  <ArrowRight size={16} />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-shell" style={{ paddingBottom: '82px' }}>
        <div style={sectionHeadingRowStyle}>
          <div style={{ display: 'grid', gap: '8px' }}>
            <span className="eyebrow" style={{ width: 'fit-content' }}>
              <MapPin size={16} />
              Explore Local Events
            </span>
            <h2 style={sectionTitleStyle}>Relevant picks around {localLabel}</h2>
            <p style={sectionCopyStyle}>
              This section reacts to the city field and timezone, giving users local suggestions
              first and quality online fallbacks when nearby supply is thin.
            </p>
          </div>
          <div style={localInfoPillStyle}>
            <Globe2 size={16} color="var(--primary-color)" />
            <span>{timeZone || 'Timezone unavailable'}</span>
          </div>
        </div>

        <div className="discover-local-grid">
          {localEvents.map((event) => (
            <article key={event.id} className="discover-local-card surface-panel">
              <div style={{ display: 'grid', gap: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <span style={metaPillStyle}>{event.is_online ? 'Online friendly' : localLabel}</span>
                  <span style={hostLabelStyle}>{event.calendar_name || event.host_name}</span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', letterSpacing: '-0.03em' }}>
                    {event.title}
                  </h3>
                  <p style={eventDescriptionStyle}>
                    {event.description ||
                      'A nearby opportunity to meet peers, learn fast, and keep your week high-signal.'}
                  </p>
                </div>
                <div style={{ display: 'grid', gap: '10px', color: 'var(--text-secondary)' }}>
                  <div style={detailRowStyle}>
                    <CalendarDays size={16} color="var(--primary-color)" />
                    <span>{formatEventDateTime(event)}</span>
                  </div>
                  <div style={detailRowStyle}>
                    {event.is_online ? (
                      <Globe2 size={16} color="var(--primary-color)" />
                    ) : (
                      <MapPin size={16} color="var(--primary-color)" />
                    )}
                    <span>{event.is_online ? 'Online event' : event.location || 'Venue to be announced'}</span>
                  </div>
                </div>
              </div>
              <Link
                href={`/events/${event.slug}`}
                className="secondary-button"
                style={{ minHeight: '46px', width: 'fit-content' }}
              >
                Explore Event
              </Link>
            </article>
          ))}
        </div>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .discover-hero-grid {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
              gap: 28px;
              align-items: stretch;
            }

            .discover-spotlight {
              border-radius: 32px;
              padding: 14px;
              overflow: hidden;
            }

            .discover-search-row {
              display: grid;
              grid-template-columns: minmax(0, 1.3fr) minmax(230px, 0.7fr);
              gap: 14px;
            }

            .discover-stat-grid,
            .discover-category-grid,
            .discover-events-grid,
            .discover-calendars-grid,
            .discover-local-grid,
            .discover-spotlight-meta {
              display: grid;
              gap: 18px;
            }

            .discover-stat-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .discover-category-grid,
            .discover-calendars-grid,
            .discover-events-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .discover-local-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .discover-spotlight-meta {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .discover-category-card,
            .discover-event-card,
            .discover-calendar-card,
            .discover-local-card {
              transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
            }

            .discover-category-card:hover,
            .discover-event-card:hover,
            .discover-calendar-card:hover,
            .discover-local-card:hover {
              transform: translateY(-4px);
              box-shadow: 0 24px 42px rgba(17, 39, 45, 0.11);
              border-color: var(--border-strong);
            }

            .discover-event-card {
              border-radius: 28px;
              padding: 16px;
              display: grid;
              gap: 16px;
            }

            .discover-calendar-card,
            .discover-local-card {
              border-radius: 28px;
              padding: 22px;
              display: grid;
              gap: 18px;
            }

            @media (max-width: 1120px) {
              .discover-hero-grid,
              .discover-category-grid,
              .discover-calendars-grid,
              .discover-events-grid,
              .discover-local-grid {
                grid-template-columns: minmax(0, 1fr) !important;
              }

              .discover-spotlight-meta,
              .discover-stat-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }

            @media (max-width: 780px) {
              .discover-search-row,
              .discover-spotlight-meta,
              .discover-stat-grid {
                grid-template-columns: minmax(0, 1fr) !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}

const topActionButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  padding: '14px 18px',
  background: 'rgba(255,255,255,0.92)',
  color: 'var(--text-primary)',
  fontWeight: 800,
  fontSize: '1rem',
  cursor: 'pointer',
  boxShadow: '0 14px 28px rgba(17,39,45,0.06)',
};

const searchPanelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '0 18px',
  minHeight: '62px',
  borderRadius: '20px',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.94)',
  boxShadow: 'var(--shadow-card)',
};

const locationPanelStyle: React.CSSProperties = {
  ...searchPanelStyle,
};

const searchInputStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  width: '100%',
  outline: 'none',
  fontSize: '1rem',
  color: 'var(--text-primary)',
};

const statCardStyle: React.CSSProperties = {
  borderRadius: '24px',
  padding: '18px 20px',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow-card)',
};

const statValueStyle: React.CSSProperties = {
  fontSize: '2rem',
  lineHeight: 1,
  letterSpacing: '-0.05em',
  fontWeight: 800,
  color: 'var(--text-primary)',
  marginBottom: '8px',
};

const statLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const sectionHeadingRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '18px',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  marginBottom: '22px',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2rem, 4vw, 3.1rem)',
  lineHeight: 0.98,
  letterSpacing: '-0.05em',
};

const sectionCopyStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  maxWidth: '720px',
  lineHeight: 1.7,
};

const clearButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  padding: '12px 16px',
  background: 'rgba(255,255,255,0.9)',
  color: 'var(--text-primary)',
  fontWeight: 800,
  cursor: 'pointer',
};

const categoryCardStyle: React.CSSProperties = {
  borderRadius: '30px',
  padding: '24px',
  display: 'grid',
  gap: '20px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,251,251,0.96))',
  textAlign: 'left',
  cursor: 'pointer',
};

const categoryCountPillStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(14,118,120,0.08)',
  fontSize: '0.85rem',
  fontWeight: 800,
};

const emptySpotlightStyle: React.CSSProperties = {
  minHeight: '420px',
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  padding: '24px',
  gap: '16px',
  background: 'linear-gradient(135deg, rgba(14,118,120,0.08), rgba(255,255,255,0.98))',
  borderRadius: '28px',
};

const emptySpotlightIconStyle: React.CSSProperties = {
  width: '70px',
  height: '70px',
  borderRadius: '24px',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(14,118,120,0.1)',
};

const spotlightBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.16)',
  border: '1px solid rgba(255,255,255,0.18)',
  backdropFilter: 'blur(10px)',
  fontWeight: 700,
};

const spotlightMetaCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 16px',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.12)',
  backdropFilter: 'blur(10px)',
  fontWeight: 600,
};

const spotlightGhostButtonStyle: React.CSSProperties = {
  minHeight: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.2)',
  padding: '0 22px',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 14px 24px rgba(17,39,45,0.14)',
};

const imageBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '9px 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.88)',
  color: 'var(--text-primary)',
  fontWeight: 800,
  fontSize: '0.82rem',
  boxShadow: '0 10px 22px rgba(17,39,45,0.12)',
};

const hostLabelStyle: React.CSSProperties = {
  color: 'var(--primary-color)',
  fontWeight: 800,
  fontSize: '0.9rem',
};

const metaPillStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'var(--primary-soft)',
  color: 'var(--primary-color)',
  fontWeight: 800,
  fontSize: '0.82rem',
};

const eventDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontWeight: 600,
};

const emptyStateStyle: React.CSSProperties = {
  borderRadius: '28px',
  padding: '48px 24px',
  textAlign: 'center',
  display: 'grid',
  placeItems: 'center',
  gap: '16px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,251,251,0.96))',
};

const followButtonStyle: React.CSSProperties = {
  borderRadius: '14px',
  border: '1px solid var(--border-color)',
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
};

const calendarTagStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(14,118,120,0.08)',
  color: 'var(--primary-color)',
  fontWeight: 700,
  fontSize: '0.82rem',
};

const openCollectionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  minHeight: '48px',
  width: 'fit-content',
  padding: '0 18px',
  borderRadius: '14px',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.94)',
  color: 'var(--text-primary)',
  fontWeight: 800,
  cursor: 'pointer',
};

const localInfoPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 16px',
  borderRadius: '999px',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.92)',
  color: 'var(--text-secondary)',
  fontWeight: 700,
};

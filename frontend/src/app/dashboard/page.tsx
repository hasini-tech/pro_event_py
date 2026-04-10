'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import EventCard from '@/components/EventCard';
import {
  getPersonalTimelineCacheKey,
  isLocalFallbackResponse,
  mergeUniqueTimelineItems,
  readPersonalTimelineCacheItems,
  readStoredTimelineIdentity,
  writePersonalTimelineCacheItems,
} from '@/lib/personalTimelineCache';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Clock3,
  DollarSign,
  Loader2,
  type LucideIcon,
  MapPin,
  Ticket,
} from 'lucide-react';

type DashboardTab = 'events' | 'tickets' | 'calendar';

type CalendarItem = {
  id: string;
  title: string;
  kind: 'Hosting' | 'Attending';
  startsAt: Date;
  href: string;
  timeLabel: string;
  locationLabel: string;
  metaLabel: string;
  accent: string;
};

function readCachedEvent(serialized: string | null) {
  if (!serialized) return null;
  try {
    return JSON.parse(serialized);
  } catch {
    return null;
  }
}

function getRequestedTab(search?: string | null): DashboardTab {
  const tab = search ? new URLSearchParams(search).get('tab') : null;
  if (tab === 'events' || tab === 'tickets' || tab === 'calendar') {
    return tab;
  }
  return 'events';
}

function updateUrlTab(tab: DashboardTab) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url.toString());
}

function parseValidDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarItems(myEvents: any[], tickets: any[]) {
  const hostedItems: CalendarItem[] = myEvents.map((event: any) => {
    const startsAt = parseValidDate(event.date) || new Date();
    const confirmedCount = Number(event.confirmed_count || 0);
    const seatsLeft = Number(event.seats_left || 0);
    return {
      id: `host-${event.id}`,
      title: event.title || 'Hosted event',
      kind: 'Hosting',
      startsAt,
      href: `/manage/${event.slug}`,
      timeLabel:
        event.time ||
        startsAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      locationLabel: event.is_online ? 'Online event' : event.location || 'Venue TBA',
      metaLabel:
        confirmedCount > 0
          ? `${confirmedCount} confirmed`
          : event.max_seats === 0
            ? 'Unlimited capacity'
            : `${seatsLeft} seats left`,
      accent: '#0f766e',
    };
  });

  const ticketItems: CalendarItem[] = tickets.map((ticket: any) => {
    const startsAt = parseValidDate(ticket.event_date) || parseValidDate(ticket.created_at) || new Date();
    return {
      id: `ticket-${ticket.id}`,
      title: ticket.event_title || 'Reserved event',
      kind: 'Attending',
      startsAt,
      href: ticket.event_slug ? `/events/${ticket.event_slug}` : '/events',
      timeLabel:
        ticket.event_time ||
        startsAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      locationLabel: ticket.event_location || 'Reservation confirmed',
      metaLabel: ticket.ticket_type === 'paid' ? 'Paid ticket' : 'Free RSVP',
      accent: '#2563eb',
    };
  });

  return [...hostedItems, ...ticketItems].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function buildMonthCells(referenceDate: Date, items: CalendarItem[]) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const itemsByDate = new Map<string, CalendarItem[]>();
  items.forEach((item) => {
    const key = formatDateKey(item.startsAt);
    const nextItems = itemsByDate.get(key) || [];
    nextItems.push(item);
    itemsByDate.set(key, nextItems);
  });

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    return {
      date: cellDate,
      isCurrentMonth: cellDate.getMonth() === referenceDate.getMonth(),
      items: itemsByDate.get(formatDateKey(cellDate)) || [],
    };
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div
      style={{
        padding: '24px',
        borderRadius: '24px',
        background: '#ffffff',
        border: '1px solid #eef2f6',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.2s ease',
      }}
    >
      <div>
        <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#111827' }}>{value}</div>
      </div>
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          background: `${color}08`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}
      >
        <Icon size={26} strokeWidth={1.5} />
      </div>
    </div>
  );
}

function DashboardTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        fontSize: '1rem',
        fontWeight: 700,
        color: active ? '#0e7678' : '#64748b',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        position: 'relative',
        padding: '12px 4px',
        transition: 'color 0.2s ease',
      }}
    >
      <Icon size={20} strokeWidth={2} /> 
      {label}
      {active && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            left: 0,
            right: 0,
            height: '3px',
            background: '#0e7678',
            borderRadius: '999px',
          }}
        />
      )}
    </button>
  );
}

function CalendarView({
  items,
  eventsError,
  ticketsError,
}: {
  items: CalendarItem[];
  eventsError: string;
  ticketsError: string;
}) {
  const today = new Date();
  const monthCells = useMemo(() => buildMonthCells(today, items), [items, today]);
  const upcomingItems = useMemo(() => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const upcoming = items.filter((item) => item.startsAt.getTime() >= todayStart);
    return upcoming.length > 0 ? upcoming : items;
  }, [items, today]);

  const monthLabel = today.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  if (items.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        {eventsError && (
          <div style={{ background: 'rgba(255,101,132,0.1)', color: '#ff6584', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
            {eventsError}
          </div>
        )}
        {ticketsError && (
          <div style={{ background: 'rgba(255,206,86,0.18)', color: '#b45309', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
            {ticketsError}
          </div>
        )}
        <div style={{ padding: '60px', textAlign: 'center', background: 'var(--surface-color)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Your calendar is empty right now.</p>
          <button onClick={() => (window.location.href = '/create-event')} style={{ padding: '12px 24px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Create Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <section
        id="calendar-grid"
        style={{
          background: 'var(--surface-color)',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-soft)',
          padding: '22px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              Calendars
            </div>
            <h2 style={{ fontSize: '1.9rem', margin: 0 }}>{monthLabel}</h2>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: '14px', background: 'rgba(15,115,119,0.08)', color: 'var(--primary-color)', fontWeight: 800 }}>
            {items.length} scheduled items
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', marginBottom: '10px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, padding: '6px 0' }}>
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
          {monthCells.map((cell) => {
            const isToday = formatDateKey(cell.date) === formatDateKey(today);
            return (
              <div
                key={cell.date.toISOString()}
                style={{
                  minHeight: '104px',
                  padding: '10px',
                  borderRadius: '16px',
                  border: `1px solid ${isToday ? 'rgba(15,115,119,0.35)' : 'rgba(148,163,184,0.18)'}`,
                  background: cell.isCurrentMonth ? '#fff' : 'rgba(248,250,252,0.8)',
                  boxShadow: isToday ? '0 12px 24px rgba(15,115,119,0.12)' : 'none',
                  display: 'grid',
                  alignContent: 'start',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isToday ? 'var(--primary-color)' : 'transparent',
                    color: isToday ? '#fff' : cell.isCurrentMonth ? 'var(--text-primary)' : '#94a3b8',
                    fontWeight: 800,
                    fontSize: '13px',
                  }}
                >
                  {cell.date.getDate()}
                </div>

                {cell.items.slice(0, 2).map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '10px',
                      background: `${item.accent}14`,
                      color: item.accent,
                      fontSize: '11px',
                      fontWeight: 800,
                      lineHeight: 1.35,
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.kind} · {item.title}
                  </a>
                ))}

                {cell.items.length > 2 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700 }}>
                    +{cell.items.length - 2} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="calendar-upcoming"
        style={{
          background: 'var(--surface-color)',
          borderRadius: '24px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-soft)',
          padding: '22px',
          display: 'grid',
          gap: '14px',
          alignContent: 'start',
        }}
      >
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Upcoming
          </div>
          <h2 style={{ fontSize: '1.9rem', margin: 0 }}>Your schedule</h2>
        </div>

        {eventsError && (
          <div style={{ background: 'rgba(255,101,132,0.1)', color: '#ff6584', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
            {eventsError}
          </div>
        )}
        {ticketsError && (
          <div style={{ background: 'rgba(255,206,86,0.18)', color: '#b45309', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>
            {ticketsError}
          </div>
        )}

        <div style={{ display: 'grid', gap: '12px' }}>
          {upcomingItems.slice(0, 8).map((item) => (
            <a
              key={item.id}
              href={item.href}
              style={{
                padding: '16px',
                borderRadius: '18px',
                border: '1px solid rgba(148,163,184,0.16)',
                background: '#fff',
                textDecoration: 'none',
                color: 'inherit',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: `${item.accent}14`,
                    color: item.accent,
                    fontWeight: 800,
                    fontSize: '12px',
                  }}
                >
                  {item.kind}
                </span>
                <ArrowRight size={16} color="var(--text-secondary)" />
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{item.title}</div>
              <div style={{ display: 'grid', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={15} />
                  <span>
                    {item.startsAt.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock3 size={15} />
                  <span>{item.timeLabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={15} />
                  <span>{item.locationLabel}</span>
                </div>
              </div>
              <div style={{ color: item.accent, fontWeight: 700, fontSize: '13px' }}>{item.metaLabel}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (typeof window !== 'undefined') {
      return getRequestedTab(window.location.search);
    }
    return 'events';
  });
  const [tickets, setTickets] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [ticketsError, setTicketsError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setActiveTab(getRequestedTab(window.location.search));
    }
  }, []);

  useEffect(() => {
    document.body.classList.add('hide-nav');
    return () => document.body.classList.remove('hide-nav');
  }, []);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const overviewRes = await api.get('/events/analytics/overview');
        setOverview(overviewRes.data);
      } catch {
        setOverview(null);
      } finally {
        setOverviewLoaded(true);
      }
    };

    const fetchEvents = async () => {
      const latestCreatedEvent =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('latest_created_event')
          : null;
      const parsedLatestEvent = readCachedEvent(latestCreatedEvent);
      const identity = user ?? readStoredTimelineIdentity();
      const personalCacheKey = getPersonalTimelineCacheKey(identity);
      const cachedHostedEvents = readPersonalTimelineCacheItems<Record<string, unknown>>(personalCacheKey)
        .filter((event): event is Record<string, unknown> & { id?: unknown } =>
          Boolean(event) && typeof event === 'object'
        )
        .filter((event) => {
          const relationship = typeof event.relationship === 'string' ? event.relationship : 'hosting';
          return relationship === 'hosting';
        });

      try {
        const eventsRes = await api.get('/events/my-events');
        const fetchedEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const mergedHostedEvents = isLocalFallbackResponse(eventsRes.headers)
          ? mergeUniqueTimelineItems(fetchedEvents, cachedHostedEvents)
          : fetchedEvents;

        if (parsedLatestEvent) {
          const mergedEvents = mergedHostedEvents.some((event: any) => event.id === parsedLatestEvent.id)
            ? mergedHostedEvents
            : [parsedLatestEvent, ...mergedHostedEvents];
          setMyEvents(mergedEvents);
          writePersonalTimelineCacheItems(personalCacheKey, mergedEvents);
          sessionStorage.removeItem('latest_created_event');
        } else {
          setMyEvents(mergedHostedEvents);
          writePersonalTimelineCacheItems(personalCacheKey, mergedHostedEvents);
        }
        setEventsError('');
      } catch {
        const fallbackEvents = parsedLatestEvent
          ? mergeUniqueTimelineItems([parsedLatestEvent], cachedHostedEvents)
          : cachedHostedEvents;
        if (fallbackEvents.length > 0) {
          setMyEvents(fallbackEvents);
          sessionStorage.removeItem('latest_created_event');
          setEventsError('');
        } else {
          setEventsError('Could not load your hosted events.');
        }
      } finally {
        setEventsLoaded(true);
      }
    };

    const fetchTickets = async () => {
      try {
        const ticketsRes = await api.get('/tickets/my-tickets');
        setTickets(ticketsRes.data || []);
        setTicketsError('');
      } catch {
        setTicketsError('Ticket service is unavailable right now.');
      } finally {
        setTicketsLoaded(true);
      }
    };

    if (!overviewLoaded) {
      fetchOverview();
    }

    const needsEvents = (activeTab === 'events' || activeTab === 'calendar') && !eventsLoaded;
    const needsTickets = (activeTab === 'tickets' || activeTab === 'calendar') && !ticketsLoaded;

    if (!needsEvents && !needsTickets) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      needsEvents ? fetchEvents() : Promise.resolve(),
      needsTickets ? fetchTickets() : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [activeTab, eventsLoaded, ticketsLoaded, overviewLoaded, user]);

  const firstName = user?.name?.split(' ')?.[0] || 'there';
  const calendarItems = useMemo(() => buildCalendarItems(myEvents, tickets), [myEvents, tickets]);
  const calendarCounts = useMemo(() => {
    const upcomingItems = calendarItems.filter((item) => item.startsAt.getTime() >= Date.now());
    const nextItem = upcomingItems[0] || calendarItems[0] || null;
    return {
      scheduled: calendarItems.length,
      hosting: calendarItems.filter((item) => item.kind === 'Hosting').length,
      attending: calendarItems.filter((item) => item.kind === 'Attending').length,
      nextItem,
    };
  }, [calendarItems]);

  const quickLinks =
    activeTab === 'calendar'
      ? [
          { label: 'Calendar Grid', href: '#calendar-grid' },
          { label: 'Upcoming', href: '#calendar-upcoming' },
          { label: `${calendarCounts.hosting} Hosting`, href: '#calendar-upcoming' },
          { label: `${calendarCounts.attending} Attending`, href: '#calendar-upcoming' },
        ]
      : [];

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    updateUrlTab(tab);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <Loader2 className="animate-spin" size={40} color="var(--primary-color)" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', marginBottom: '8px' }}>Welcome, {firstName}</h1>
        <p style={{ color: '#64748b', fontSize: '1.2rem', fontWeight: 500 }}>
          {activeTab === 'calendar'
            ? 'See everything you are hosting and attending in one calendar.'
            : 'Manage your tickets and hosted events'}
        </p>
        {quickLinks.length > 0 && (
          <div style={{ marginTop: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {quickLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: '1px solid #eef2f6',
                  background: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: '#111827',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0e7678';
                  e.currentTarget.style.color = '#0e7678';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#eef2f6';
                  e.currentTarget.style.color = '#111827';
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'calendar' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '30px' }}>
          <StatCard label="Scheduled" value={calendarCounts.scheduled} icon={CalendarRange} color="var(--primary-color)" />
          <StatCard label="Hosting" value={calendarCounts.hosting} icon={Calendar} color="#0f766e" />
          <StatCard label="Attending" value={calendarCounts.attending} icon={Ticket} color="#2563eb" />
          <StatCard
            label="Next Up"
            value={
              calendarCounts.nextItem
                ? calendarCounts.nextItem.startsAt.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })
                : 'None'
            }
            icon={Clock3}
            color="#1f6a52"
          />
        </div>
      ) : (
        overview && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '30px' }}>
            <StatCard label="Hosted events" value={overview.total_events} icon={Calendar} color="var(--primary-color)" />
            <StatCard label="Confirmed RSVPs" value={overview.confirmed_count} icon={CheckCircle2} color="#4bc0c0" />
            <StatCard label="Waitlist" value={overview.waitlisted_count} icon={AlertCircle} color="#f06f4f" />
            <StatCard label="Revenue" value={`$${Number(overview.ticket_sales || 0).toFixed(2)}`} icon={DollarSign} color="#1f6a52" />
          </div>
        )
      )}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <DashboardTabButton active={activeTab === 'tickets'} icon={Ticket} label="My Tickets" onClick={() => handleTabChange('tickets')} />
        <DashboardTabButton active={activeTab === 'events'} icon={Calendar} label="Hosted Events" onClick={() => handleTabChange('events')} />
        <DashboardTabButton active={activeTab === 'calendar'} icon={CalendarRange} label="Calendars" onClick={() => handleTabChange('calendar')} />
      </div>

      {activeTab === 'calendar' && (
        <CalendarView items={calendarItems} eventsError={eventsError} ticketsError={ticketsError} />
      )}

      {activeTab === 'tickets' && (
        <div>
          {ticketsError && (
            <div style={{ background: 'rgba(255,101,132,0.1)', color: '#ff6584', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              {ticketsError}
            </div>
          )}
          {tickets.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', background: 'var(--surface-color)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>You haven&apos;t bought any tickets yet.</p>
              <button onClick={() => (window.location.href = '/events')} style={{ padding: '12px 24px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Explore Events
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
              {tickets.map((t: any) => (
                <div key={t.id} style={{ background: 'var(--surface-color)', borderRadius: '22px', padding: '20px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>{t.event_title || 'Ticket'}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                        {t.event_date ? new Date(t.event_date).toLocaleDateString() : ''}
                        {t.event_time ? ` · ${t.event_time}` : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: '12px', background: t.status === 'confirmed' ? 'rgba(75, 192, 192, 0.2)' : t.status === 'waitlisted' ? 'rgba(255, 206, 86, 0.2)' : 'rgba(255,101,132,0.15)', color: t.status === 'confirmed' ? '#4bc0c0' : t.status === 'waitlisted' ? '#d19f00' : '#ff6584', padding: '4px 8px', borderRadius: '999px', fontWeight: 'bold' }}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '10px' }}>{t.ticket_type === 'paid' ? 'Paid ticket' : 'Free RSVP'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', background: 'var(--bg-color)', padding: '4px 8px', borderRadius: '999px', color: 'var(--text-secondary)' }}>{t.ticket_ref}</span>
                    <a href={`/events/${t.event_slug}`} style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 700 }}>View event</a>
                  </div>
                  {t.qr_code && (
                    <div style={{ background: 'white', padding: '10px', borderRadius: '12px', display: 'inline-block' }}>
                      <img src={t.qr_code} alt="QR Code" style={{ width: '120px', height: '120px' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div>
          {eventsError && (
            <div style={{ background: 'rgba(255,101,132,0.1)', color: '#ff6584', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              {eventsError}
            </div>
          )}
          {myEvents.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', background: 'var(--surface-color)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>You haven&apos;t hosted any events yet.</p>
              <button onClick={() => (window.location.href = '/create-event')} style={{ padding: '12px 24px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Create Event
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
              {myEvents.map((event: any) => (
                <div key={event.id} onClick={() => (window.location.href = `/manage/${event.slug}`)} style={{ cursor: 'pointer' }}>
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

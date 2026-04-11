import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_EVENT_COVER } from '@/lib/defaults';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    path?: string[];
  };
};

type LocalEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  is_online: boolean;
  cover_image: string;
  slug: string;
  host_id: string;
  host_name: string;
  host_image: string;
  host_bio: string;
  is_paid: boolean;
  ticket_price: number;
  max_seats: number;
  seats_left: number;
  attendee_count: number;
  status: string;
  calendar_id?: string | null;
  calendar_name?: string | null;
  calendar_slug?: string | null;
  calendar_tint_color?: string | null;
  community_enabled: boolean;
  speakers: Array<Record<string, unknown>>;
  agenda: string[];
  integrations: Array<Record<string, unknown>>;
  confirmed_count: number;
  waitlisted_count: number;
  checked_in_count: number;
  ticket_sales: number;
  conversion_rate: number;
  share_url: string;
  created_at: string;
};

type LocalCalendar = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  tint_color: string;
  location_scope: 'city' | 'global';
  city: string;
  cover_image: string;
  subscriber_count: number;
  is_default: boolean;
  created_at: string;
};

type LocalUser = {
  id: string;
  name: string;
  email: string;
  bio: string;
  profile_image: string;
  links: string[];
  role: string;
  created_at: string;
  updated_at: string;
};

type LocalTicket = {
  id: string;
  ticket_ref: string;
  event_id: string;
  user_id: string;
  status: string;
  ticket_type: string;
  payment_status: string;
  stripe_session_id: string;
  qr_code: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  amount: number;
};

type LocalPayment = {
  id: string;
  user_id: string;
  ticket_ref: string;
  event_id: string;
  stripe_session_id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type LocalActor = {
  userId: string;
  name: string;
  email: string;
};

type LocalStore = {
  usersById: Map<string, LocalUser>;
  eventsById: Map<string, LocalEvent>;
  slugToId: Map<string, string>;
  calendarsById: Map<string, LocalCalendar>;
  calendarSlugToId: Map<string, string>;
  ticketsById: Map<string, LocalTicket>;
  ticketsByRef: Map<string, string>;
  paymentsBySessionId: Map<string, LocalPayment>;
};

const globalForEvently = globalThis as typeof globalThis & {
  __eventlyLocalStore?: LocalStore;
};

const localStore: LocalStore =
  globalForEvently.__eventlyLocalStore ?? {
    usersById: new Map<string, LocalUser>(),
    eventsById: new Map<string, LocalEvent>(),
    slugToId: new Map<string, string>(),
    calendarsById: new Map<string, LocalCalendar>(),
    calendarSlugToId: new Map<string, string>(),
    ticketsById: new Map<string, LocalTicket>(),
    ticketsByRef: new Map<string, string>(),
    paymentsBySessionId: new Map<string, LocalPayment>(),
  };

globalForEvently.__eventlyLocalStore = localStore;

// Prefer explicit service URLs. If no API gateway is configured, fall back to
// local dev ports instead of the port-80 gateway (which often isn't running
// during local development).
const API_GATEWAY_BASE =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';
const LOCAL_ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const DEFAULT_SERVICE_BASES: Record<string, string> = {
  users: 'http://127.0.0.1:8001',
  events: 'http://127.0.0.1:8002',
  tickets: 'http://127.0.0.1:8003',
  payments: 'http://127.0.0.1:8004',
  attendees: 'http://127.0.0.1:8005',
  api: 'http://127.0.0.1:80',
};

const SERVICE_BASES: Record<string, string> = {
  users: process.env.NEXT_PUBLIC_USER_API_URL || API_GATEWAY_BASE || DEFAULT_SERVICE_BASES.users,
  events: process.env.NEXT_PUBLIC_EVENT_API_URL || API_GATEWAY_BASE || DEFAULT_SERVICE_BASES.events,
  tickets: process.env.NEXT_PUBLIC_TICKET_API_URL || API_GATEWAY_BASE || DEFAULT_SERVICE_BASES.tickets,
  payments: process.env.NEXT_PUBLIC_PAYMENT_API_URL || API_GATEWAY_BASE || DEFAULT_SERVICE_BASES.payments,
  attendees: process.env.NEXT_PUBLIC_ATTENDEE_API_URL || API_GATEWAY_BASE || DEFAULT_SERVICE_BASES.attendees,
  api: API_GATEWAY_BASE || DEFAULT_SERVICE_BASES.api,
};
const FALLBACK_JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function getFrontendBaseUrl(request?: NextRequest) {
  const configuredBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    process.env.VERCEL_URL;

  if (configuredBase) {
    if (configuredBase.startsWith('http://') || configuredBase.startsWith('https://')) {
      return configuredBase.replace(/\/$/, '');
    }
    return `https://${configuredBase.replace(/\/$/, '')}`;
  }

  return request?.nextUrl.origin.replace(/\/$/, '') || 'http://localhost:3000';
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function createFallbackToken(userId: string, role = 'user') {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      role,
      iat: now,
      exp: now + 60 * 60 * 24,
    }),
  );
  const signature = createHmac('sha256', FALLBACK_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function resolveServiceBases(service?: string) {
  if (!service) {
    return [SERVICE_BASES.api];
  }

  const configured = SERVICE_BASES[service] || SERVICE_BASES.api;
  const fallback = DEFAULT_SERVICE_BASES[service];

  return Array.from(
    new Set([configured, fallback].filter((value): value is string => Boolean(value)))
  );
}

function decodeJwtSubject(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const cookieToken = request.cookies.get('evently_token')?.value || '';
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!rawToken) {
    return null;
  }

  const payloadPart = rawToken.split('.')[1];
  if (!payloadPart) {
    return null;
  }

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function slugify(title: string) {
  const suffix = Math.random().toString(36).slice(2, 7);
  const base = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${base || 'event'}-${suffix}`;
}

function normalizeSlugBase(value: string, fallback = 'calendar') {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return base || fallback;
}

function sortEventsByDateAsc(events: LocalEvent[]) {
  return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function sortEventsByCreatedDesc(events: LocalEvent[]) {
  return [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function listAllLocalEvents() {
  return sortEventsByDateAsc(Array.from(localStore.eventsById.values()));
}

function listPublishedLocalEvents() {
  return sortEventsByDateAsc(
    Array.from(localStore.eventsById.values()).filter((event) => event.status === 'published')
  );
}

function getLocalEventById(eventId: string) {
  return localStore.eventsById.get(eventId) ?? null;
}

function getLocalEventBySlug(slug: string) {
  const eventId = localStore.slugToId.get(slug);
  if (eventId) {
    const event = localStore.eventsById.get(eventId);
    if (event) {
      return event;
    }
  }

  for (const event of Array.from(localStore.eventsById.values())) {
    if (event.slug === slug) {
      return event;
    }
  }

  return null;
}

function getLocalEventByIdOrSlug(value: string) {
  return getLocalEventById(value) ?? getLocalEventBySlug(value);
}

function getLocalCalendarById(calendarId: string) {
  return localStore.calendarsById.get(calendarId) ?? null;
}

function getLocalCalendarBySlug(slug: string) {
  const calendarId = localStore.calendarSlugToId.get(slug);
  if (!calendarId) {
    return null;
  }
  return localStore.calendarsById.get(calendarId) ?? null;
}

function persistLocalEvent(event: LocalEvent) {
  localStore.eventsById.set(event.id, event);
  localStore.slugToId.set(event.slug, event.id);
  return event;
}

function persistLocalCalendar(calendar: LocalCalendar) {
  const previousCalendar = localStore.calendarsById.get(calendar.id);
  if (previousCalendar && previousCalendar.slug !== calendar.slug) {
    localStore.calendarSlugToId.delete(previousCalendar.slug);
  }

  localStore.calendarsById.set(calendar.id, calendar);
  localStore.calendarSlugToId.set(calendar.slug, calendar.id);
  return calendar;
}

function normalizeLocalLinks(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function getLocalUserById(userId: string) {
  return localStore.usersById.get(userId) ?? null;
}

function getLocalUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  for (const user of Array.from(localStore.usersById.values())) {
    if (user.email.trim().toLowerCase() === normalizedEmail) {
      return user;
    }
  }

  return null;
}

function getLocalUserRole(email: string, fallback = 'user') {
  return LOCAL_ADMIN_EMAILS.has(email.trim().toLowerCase()) ? 'admin' : fallback;
}

function displayNameFromEmail(email: string) {
  const localPart = email.split('@', 1)[0] || '';
  const parts = localPart
    .replace(/[_\.]+/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return 'Event Host';
  }

  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function persistLocalUser(user: LocalUser) {
  localStore.usersById.set(user.id, user);
  return user;
}

function buildLocalUserResponse(user: LocalUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    profile_image: user.profile_image,
    links: [...user.links],
    role: user.role,
    created_at: user.created_at,
  };
}

function ensureLocalUser(
  userId: string,
  details: Partial<LocalUser> & { email?: string; name?: string; role?: string } = {}
) {
  const existing = getLocalUserById(userId);
  const now = new Date().toISOString();
  const email = String(details.email || existing?.email || `user-${userId.slice(0, 8)}@evently.local`)
    .trim()
    .toLowerCase();
  const user = persistLocalUser({
    id: userId,
    name: String(details.name || existing?.name || 'Event Host'),
    email,
    bio: String(details.bio ?? existing?.bio ?? ''),
    profile_image: String(details.profile_image ?? existing?.profile_image ?? ''),
    links: normalizeLocalLinks(details.links ?? existing?.links ?? []),
    role: details.role || existing?.role || getLocalUserRole(email, 'user'),
    created_at: existing?.created_at || now,
    updated_at: now,
  });

  return user;
}

function getLocalTicketById(ticketId: string) {
  return localStore.ticketsById.get(ticketId) ?? null;
}

function getLocalTicketByRef(ticketRef: string) {
  const ticketId = localStore.ticketsByRef.get(ticketRef);
  if (ticketId) {
    const ticket = localStore.ticketsById.get(ticketId);
    if (ticket) {
      return ticket;
    }
  }

  for (const ticket of Array.from(localStore.ticketsById.values())) {
    if (ticket.ticket_ref === ticketRef) {
      return ticket;
    }
  }

  return null;
}

function getLocalEventTickets(eventId: string) {
  return Array.from(localStore.ticketsById.values()).filter((ticket) => ticket.event_id === eventId);
}

function persistLocalTicket(ticket: LocalTicket) {
  localStore.ticketsById.set(ticket.id, ticket);
  localStore.ticketsByRef.set(ticket.ticket_ref, ticket.id);
  return ticket;
}

function persistLocalPayment(payment: LocalPayment) {
  localStore.paymentsBySessionId.set(payment.stripe_session_id, payment);
  return payment;
}

function buildLocalQrCode(ticketRef: string, eventId: string, userId: string) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">',
    '<rect width="240" height="240" rx="28" fill="#ffffff"/>',
    '<rect x="20" y="20" width="200" height="200" rx="22" fill="#0e7678"/>',
    '<text x="120" y="104" text-anchor="middle" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">Evently</text>',
    '<text x="120" y="136" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" fill="#dff7f7">',
    ticketRef,
    '</text>',
    '<text x="120" y="164" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="#dff7f7">',
    `event:${eventId}`,
    '</text>',
    '<text x="120" y="182" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" fill="#dff7f7">',
    `user:${userId}`,
    '</text>',
    '</svg>',
  ].join('');

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function refreshLocalEventMetrics(eventId: string) {
  const event = getLocalEventById(eventId);
  if (!event) {
    return null;
  }

  const tickets = getLocalEventTickets(eventId);
  const activeTickets = tickets.filter((ticket) =>
    ['confirmed', 'pending_payment', 'pending_approval'].includes(ticket.status)
  );
  const confirmedTickets = tickets.filter((ticket) => ticket.status === 'confirmed');
  const waitlistedTickets = tickets.filter((ticket) => ticket.status === 'waitlisted');
  const checkedInTickets = tickets.filter((ticket) => ticket.checked_in);
  const completedPaidTickets = tickets.filter(
    (ticket) =>
      ticket.status === 'confirmed' &&
      ticket.ticket_type === 'paid' &&
      ticket.payment_status === 'completed'
  );

  event.attendee_count = activeTickets.length;
  event.confirmed_count = confirmedTickets.length;
  event.waitlisted_count = waitlistedTickets.length;
  event.checked_in_count = checkedInTickets.length;
  event.ticket_sales = completedPaidTickets.length * Number(event.ticket_price || 0);
  event.conversion_rate = tickets.length
    ? Number(((confirmedTickets.length / tickets.length) * 100).toFixed(2))
    : 0;
  event.seats_left = event.max_seats > 0 ? Math.max(event.max_seats - activeTickets.length, 0) : 0;

  return persistLocalEvent(event);
}

function buildLocalTicketDetail(
  ticket: LocalTicket,
  event?: LocalEvent | null,
  profile?: LocalUser | null,
) {
  return {
    id: ticket.id,
    ticket_ref: ticket.ticket_ref,
    event_id: ticket.event_id,
    user_id: ticket.user_id,
    status: ticket.status,
    ticket_type: ticket.ticket_type,
    payment_status: ticket.payment_status,
    stripe_session_id: ticket.stripe_session_id || null,
    qr_code: ticket.qr_code || null,
    checked_in: ticket.checked_in,
    checked_in_at: ticket.checked_in_at,
    created_at: ticket.created_at,
    event_title: event?.title || '',
    event_slug: event?.slug || '',
    event_date: event?.date || null,
    event_time: event?.time || '',
    event_location: event?.location || '',
    event_description: event?.description || '',
    event_cover_image: event?.cover_image || '',
    event_is_online: Boolean(event?.is_online),
    event_status: event?.status || '',
    host_name: event?.host_name || '',
    user_name: profile?.name || '',
    user_email: profile?.email || '',
    user_bio: profile?.bio || '',
    user_profile_image: profile?.profile_image || '',
    user_links: profile?.links ? [...profile.links] : [],
  };
}

function buildLocalAttendeeResponse(
  ticket: LocalTicket,
  event?: LocalEvent | null,
  profile?: LocalUser | null,
) {
  return {
    id: ticket.id,
    event_id: ticket.event_id,
    user_id: ticket.user_id,
    ticket_id: ticket.id,
    ticket_ref: ticket.ticket_ref,
    status: ticket.status,
    ticket_type: ticket.ticket_type,
    name: profile?.name || '',
    bio: profile?.bio || '',
    profile_image: profile?.profile_image || '',
    links: profile?.links ? [...profile.links] : [],
    checked_in: ticket.checked_in,
    checked_in_at: ticket.checked_in_at,
    created_at: ticket.created_at,
    host_name: event?.host_name || '',
  };
}

function buildLocalPaymentResponse(payment: LocalPayment) {
  return {
    id: payment.id,
    user_id: payment.user_id,
    ticket_ref: payment.ticket_ref,
    event_id: payment.event_id,
    stripe_session_id: payment.stripe_session_id,
    amount: payment.amount,
    status: payment.status,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
}

function buildLocalAdminStats() {
  const events = listAllLocalEvents();
  const tickets = Array.from(localStore.ticketsById.values());

  return {
    total_events: events.length,
    published_events: events.filter((event) => event.status === 'published').length,
    total_tickets: tickets.length,
    confirmed_tickets: tickets.filter((ticket) => ticket.status === 'confirmed').length,
    waitlisted_tickets: tickets.filter((ticket) => ticket.status === 'waitlisted').length,
    payments_completed: tickets.filter((ticket) => ticket.payment_status === 'completed').length,
    payments_pending: tickets.filter((ticket) => ticket.payment_status !== 'completed').length,
  };
}

function readLocalActor(request: NextRequest): LocalActor | null {
  const headerUserId = request.headers.get('x-evently-user-id')?.trim();
  const headerUserName = request.headers.get('x-evently-user-name')?.trim();
  const headerUserEmail = request.headers.get('x-evently-user-email')?.trim();
  const decodedUserId = decodeJwtSubject(request);
  const userId = headerUserId || decodedUserId;

  if (!userId) {
    return null;
  }

  const storedUser = getLocalUserById(userId);

  return {
    userId,
    name: headerUserName || storedUser?.name || 'Personal Calendar',
    email: headerUserEmail || storedUser?.email || '',
  };
}

function buildUniqueCalendarSlug(value: string, excludeCalendarId?: string) {
  const base = normalizeSlugBase(value);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = getLocalCalendarBySlug(candidate);
    if (!existing || existing.id === excludeCalendarId) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

function getOwnedLocalCalendars(ownerId: string) {
  return [...Array.from(localStore.calendarsById.values()).filter((calendar) => calendar.owner_id === ownerId)]
    .sort((left, right) => {
      if (left.is_default !== right.is_default) {
        return Number(right.is_default) - Number(left.is_default);
      }
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    });
}

function getLocalCalendarEventCounts(calendarId: string) {
  const now = Date.now();
  let eventCount = 0;
  let upcomingEventCount = 0;

  for (const event of Array.from(localStore.eventsById.values())) {
    if (event.calendar_id !== calendarId) {
      continue;
    }
    eventCount += 1;
    if (new Date(event.date).getTime() >= now) {
      upcomingEventCount += 1;
    }
  }

  return {
    eventCount,
    upcomingEventCount,
  };
}

function serializeLocalCalendar(calendar: LocalCalendar) {
  const counts = getLocalCalendarEventCounts(calendar.id);
  return {
    id: calendar.id,
    owner_id: calendar.owner_id,
    name: calendar.name,
    slug: calendar.slug,
    description: calendar.description,
    tint_color: calendar.tint_color,
    location_scope: calendar.location_scope,
    city: calendar.city,
    cover_image: calendar.cover_image,
    subscriber_count: calendar.subscriber_count,
    is_default: calendar.is_default,
    event_count: counts.eventCount,
    upcoming_event_count: counts.upcomingEventCount,
    created_at: calendar.created_at,
  };
}

function ensureLocalOwnerCalendar(request: NextRequest) {
  const actor = readLocalActor(request);
  if (!actor) {
    return null;
  }

  const existingCalendars = getOwnedLocalCalendars(actor.userId);
  const defaultCalendar = existingCalendars.find((calendar) => calendar.is_default);
  if (defaultCalendar) {
    return defaultCalendar;
  }

  if (existingCalendars[0]) {
    return persistLocalCalendar({
      ...existingCalendars[0],
      is_default: true,
    });
  }

  const displayName = actor.name.trim() || 'Personal Calendar';
  return persistLocalCalendar({
    id: crypto.randomUUID(),
    owner_id: actor.userId,
    name: displayName,
    slug: buildUniqueCalendarSlug(displayName),
    description: `Events hosted by ${displayName}.`,
    tint_color: '#0e7678',
    location_scope: 'global',
    city: '',
    cover_image: '',
    subscriber_count: 1,
    is_default: true,
    created_at: new Date().toISOString(),
  });
}

function applyLocalCalendarToEvent(event: LocalEvent, calendar: LocalCalendar | null) {
  if (!calendar) {
    return {
      ...event,
      calendar_id: null,
      calendar_name: null,
      calendar_slug: null,
      calendar_tint_color: null,
    };
  }

  return {
    ...event,
    calendar_id: calendar.id,
    calendar_name: calendar.name,
    calendar_slug: calendar.slug,
    calendar_tint_color: calendar.tint_color,
  };
}

function syncLocalCalendarMetadata(calendar: LocalCalendar) {
  for (const event of Array.from(localStore.eventsById.values())) {
    if (event.calendar_id !== calendar.id) {
      continue;
    }

    persistLocalEvent(
      applyLocalCalendarToEvent(
        {
          ...event,
        },
        calendar
      )
    );
  }
}

function countReservedSeats(event: LocalEvent) {
  return Math.max(
    Number(event.attendee_count || 0),
    Number(event.confirmed_count || 0) + Number(event.waitlisted_count || 0)
  );
}

function buildLocalEvent(payload: any, request: NextRequest, selectedCalendar: LocalCalendar | null = null): LocalEvent {
  const now = new Date().toISOString();
  const actor = readLocalActor(request);
  const hostId = String(payload?.host_id || actor?.userId || crypto.randomUUID());
  const slug = slugify(String(payload?.title || 'event'));
  const maxSeats = Number(payload?.max_seats || 0);
  const ticketPrice = Number(payload?.ticket_price || 0);

  return applyLocalCalendarToEvent(
    {
      id: crypto.randomUUID(),
      title: String(payload?.title || 'Untitled event'),
      description: String(payload?.description || ''),
      date: String(payload?.date || now),
      time: String(payload?.time || ''),
      location: String(payload?.location || ''),
      is_online: Boolean(payload?.is_online),
      cover_image: String(payload?.cover_image || DEFAULT_EVENT_COVER),
      slug,
      host_id: hostId,
      host_name: String(payload?.host_name || actor?.name || 'Event Host'),
      host_image: String(payload?.host_image || ''),
      host_bio: String(payload?.host_bio || ''),
      is_paid: Boolean(payload?.is_paid),
      ticket_price: ticketPrice,
      max_seats: maxSeats,
      seats_left: maxSeats,
      attendee_count: 0,
      status: String(payload?.status || 'published'),
      community_enabled: payload?.community_enabled !== false,
      speakers: Array.isArray(payload?.speakers) ? payload.speakers : [],
      agenda: Array.isArray(payload?.agenda) ? payload.agenda : [],
      integrations: Array.isArray(payload?.integrations) ? payload.integrations : [],
      confirmed_count: 0,
      waitlisted_count: 0,
      checked_in_count: 0,
      ticket_sales: 0,
      conversion_rate: 0,
      share_url: `${getFrontendBaseUrl(request)}/events/${slug}`,
      created_at: now,
    },
    selectedCalendar
  );
}

function updateLocalEvent(event: LocalEvent, payload: any) {
  const nextMaxSeats =
    payload?.max_seats !== undefined ? Math.max(0, Number(payload.max_seats || 0)) : event.max_seats;
  const reservedSeats = countReservedSeats(event);

  const updatedEvent: LocalEvent = {
    ...event,
    title: payload?.title !== undefined ? String(payload.title || '') : event.title,
    description:
      payload?.description !== undefined ? String(payload.description || '') : event.description,
    date: payload?.date !== undefined ? String(payload.date || event.date) : event.date,
    time: payload?.time !== undefined ? String(payload.time || '') : event.time,
    location: payload?.location !== undefined ? String(payload.location || '') : event.location,
    is_online: payload?.is_online !== undefined ? Boolean(payload.is_online) : event.is_online,
    cover_image:
      payload?.cover_image !== undefined
        ? String(payload.cover_image || DEFAULT_EVENT_COVER)
        : event.cover_image,
    is_paid: payload?.is_paid !== undefined ? Boolean(payload.is_paid) : event.is_paid,
    ticket_price:
      payload?.ticket_price !== undefined ? Number(payload.ticket_price || 0) : event.ticket_price,
    max_seats: nextMaxSeats,
    seats_left: nextMaxSeats === 0 ? 0 : Math.max(nextMaxSeats - reservedSeats, 0),
    status: payload?.status !== undefined ? String(payload.status || 'published') : event.status,
    community_enabled:
      payload?.community_enabled !== undefined
        ? payload.community_enabled !== false
        : event.community_enabled,
    speakers: Array.isArray(payload?.speakers) ? payload.speakers : event.speakers,
    agenda: Array.isArray(payload?.agenda) ? payload.agenda : event.agenda,
    integrations: Array.isArray(payload?.integrations) ? payload.integrations : event.integrations,
  };

  const persisted = persistLocalEvent(updatedEvent);
  return refreshLocalEventMetrics(persisted.id) ?? persisted;
}

function buildLocalOverview(request: NextRequest) {
  const userId = decodeJwtSubject(request);
  const events = userId
    ? sortEventsByCreatedDesc(
        Array.from(localStore.eventsById.values()).filter((event) => event.host_id === userId)
      )
    : [];

  const totals = {
    total_events: events.length,
    published_events: 0,
    total_reservations: 0,
    confirmed_count: 0,
    waitlisted_count: 0,
    checked_in_count: 0,
    ticket_sales: 0,
    conversion_rate: 0,
  };

  const items = events.map((event) => {
    if (event.status === 'published') {
      totals.published_events += 1;
    }

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      date: event.date,
      is_paid: event.is_paid,
      ticket_price: event.ticket_price,
      max_seats: event.max_seats,
      seats_left: event.seats_left,
      reserved_count: event.attendee_count,
      confirmed_count: event.confirmed_count,
      waitlisted_count: event.waitlisted_count,
      checked_in_count: event.checked_in_count,
      ticket_sales: event.ticket_sales,
      conversion_rate: event.conversion_rate,
    };
  });

  return {
    ...totals,
    events: items,
  };
}

function buildLocalCommunity(slug: string) {
  const event = getLocalEventBySlug(slug);
  if (!event) {
    return null;
  }

  const attendees = getLocalEventTickets(event.id)
    .filter((ticket) => ticket.status === 'confirmed')
    .slice(0, 8)
    .map((ticket) => buildLocalAttendeeResponse(ticket, event, getLocalUserById(ticket.user_id)));

  return {
    event_id: event.id,
    event_slug: event.slug,
    community_enabled: event.community_enabled,
    speakers: event.speakers,
    attendees,
    confirmed_count: event.confirmed_count,
    waitlisted_count: event.waitlisted_count,
    checked_in_count: event.checked_in_count,
  };
}

function buildLocalEventAnalytics(event: LocalEvent) {
  const refreshed = refreshLocalEventMetrics(event.id) ?? event;
  return {
    attendee_count: refreshed.attendee_count,
    confirmed_count: refreshed.confirmed_count,
    waitlisted_count: refreshed.waitlisted_count,
    checked_in_count: refreshed.checked_in_count,
    ticket_sales: refreshed.ticket_sales,
    conversion_rate: refreshed.conversion_rate,
    seats_left: refreshed.seats_left,
    max_seats: refreshed.max_seats,
    is_paid: refreshed.is_paid,
    ticket_price: refreshed.ticket_price,
  };
}

function requireLocalUserId(request: NextRequest) {
  return readLocalActor(request)?.userId ?? null;
}

function buildLocalMyEvents(request: NextRequest) {
  const userId = requireLocalUserId(request);
  if (!userId) {
    return null;
  }

  return sortEventsByCreatedDesc(
    Array.from(localStore.eventsById.values()).filter((event) => event.host_id === userId)
  );
}

function createLocalCalendarResponse(request: NextRequest, requestBody: any) {
  const actor = readLocalActor(request);
  if (!actor) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  if (!requestBody || typeof requestBody !== 'object') {
    return NextResponse.json({ detail: 'Invalid calendar payload.' }, { status: 400 });
  }

  const name = String(requestBody?.name || '').trim();
  if (!name) {
    return NextResponse.json({ detail: 'Calendar name is required.' }, { status: 400 });
  }

  const locationScope =
    requestBody?.location_scope === 'city' || requestBody?.location_scope === 'global'
      ? requestBody.location_scope
      : 'global';

  const createdCalendar = persistLocalCalendar({
    id: crypto.randomUUID(),
    owner_id: actor.userId,
    name,
    slug: buildUniqueCalendarSlug(String(requestBody?.slug || name)),
    description: String(requestBody?.description || ''),
    tint_color: String(requestBody?.tint_color || '#0e7678'),
    location_scope: locationScope,
    city: locationScope === 'city' ? String(requestBody?.city || '') : '',
    cover_image: String(requestBody?.cover_image || ''),
    subscriber_count: 1,
    is_default: getOwnedLocalCalendars(actor.userId).length === 0,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json(serializeLocalCalendar(createdCalendar), { status: 201 });
}

function getLocalCalendarResponse(request: NextRequest, calendarSlug: string) {
  const actor = readLocalActor(request);
  if (!actor) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const calendar = getLocalCalendarBySlug(calendarSlug);
  if (!calendar) {
    return NextResponse.json({ detail: 'Calendar not found' }, { status: 404 });
  }

  if (calendar.owner_id !== actor.userId) {
    return NextResponse.json({ detail: 'Not authorized to manage this calendar' }, { status: 403 });
  }

  return NextResponse.json(serializeLocalCalendar(calendar));
}

function getLocalCalendarEventsResponse(request: NextRequest, calendarSlug: string) {
  const actor = readLocalActor(request);
  if (!actor) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const calendar = getLocalCalendarBySlug(calendarSlug);
  if (!calendar) {
    return NextResponse.json({ detail: 'Calendar not found' }, { status: 404 });
  }

  if (calendar.owner_id !== actor.userId) {
    return NextResponse.json({ detail: 'Not authorized to manage this calendar' }, { status: 403 });
  }

  const events = sortEventsByDateAsc(
    Array.from(localStore.eventsById.values()).filter((event) => event.calendar_id === calendar.id)
  );
  return NextResponse.json(events);
}

function updateLocalCalendarResponse(request: NextRequest, calendarSlug: string, requestBody: any) {
  const actor = readLocalActor(request);
  if (!actor) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const calendar = getLocalCalendarBySlug(calendarSlug);
  if (!calendar) {
    return NextResponse.json({ detail: 'Calendar not found' }, { status: 404 });
  }

  if (calendar.owner_id !== actor.userId) {
    return NextResponse.json({ detail: 'Not authorized to manage this calendar' }, { status: 403 });
  }

  if (!requestBody || typeof requestBody !== 'object') {
    return NextResponse.json({ detail: 'Invalid calendar payload.' }, { status: 400 });
  }

  const nextLocationScope =
    requestBody?.location_scope === 'city' || requestBody?.location_scope === 'global'
      ? requestBody.location_scope
      : calendar.location_scope;

  const updatedCalendar = persistLocalCalendar({
    ...calendar,
    name: requestBody?.name !== undefined ? String(requestBody.name || '').trim() || calendar.name : calendar.name,
    description:
      requestBody?.description !== undefined ? String(requestBody.description || '') : calendar.description,
    slug:
      requestBody?.slug !== undefined && String(requestBody.slug || '').trim()
        ? buildUniqueCalendarSlug(String(requestBody.slug), calendar.id)
        : calendar.slug,
    tint_color:
      requestBody?.tint_color !== undefined ? String(requestBody.tint_color || '#0e7678') : calendar.tint_color,
    location_scope: nextLocationScope,
    city:
      requestBody?.city !== undefined
        ? nextLocationScope === 'city'
          ? String(requestBody.city || '')
          : ''
        : calendar.city,
    cover_image:
      requestBody?.cover_image !== undefined ? String(requestBody.cover_image || '') : calendar.cover_image,
  });

  syncLocalCalendarMetadata(updatedCalendar);
  return NextResponse.json(serializeLocalCalendar(updatedCalendar));
}

async function readRequestBody(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  try {
    return await request.clone().json();
  } catch {
    try {
      return await request.clone().text();
    } catch {
      return null;
    }
  }
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();

  const forwardableHeaders = [
    'accept',
    'authorization',
    'content-type',
    'cookie',
  ];

  for (const headerName of forwardableHeaders) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

function normalizeBaseUrl(baseUrl: string, request: NextRequest) {
  try {
    return new URL(baseUrl).toString();
  } catch {
    return new URL(baseUrl, request.nextUrl.origin).toString();
  }
}

function buildTargetUrl(baseUrl: string, request: NextRequest, segments: string[]) {
  const apiPath = `/api/${segments.join('/')}`;
  return new URL(`${apiPath}${request.nextUrl.search}`, normalizeBaseUrl(baseUrl, request));
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const segments = context.params.path ?? [];
  const service = segments[0];
  const route = segments.slice(1).join('/');
  const requestBody = await readRequestBody(request);

  const init: RequestInit = {
    method: request.method,
    headers: buildProxyHeaders(request),
    redirect: 'manual',
    cache: 'no-store',
  };

  if (requestBody !== null && request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  }

  let lastUpstreamResponse: Response | null = null;

  for (const baseUrl of resolveServiceBases(service)) {
    const targetUrl = buildTargetUrl(baseUrl, request, segments);

    try {
      const upstreamResponse = await fetch(targetUrl, init);
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('content-length');
      responseHeaders.delete('transfer-encoding');

      if (upstreamResponse.ok || upstreamResponse.status < 500) {
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: responseHeaders,
        });
      }

      lastUpstreamResponse = new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch {
      // Try the next candidate base URL.
    }
  }

  if (service === 'blasts') {
    const response = NextResponse.json([]);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (service === 'users') {
    const response = getUserFallbackResponse(request, route, requestBody);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (service === 'attendees') {
    const response = getAttendeeFallbackResponse(request, route, requestBody);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (service === 'events') {
    const response = getEventFallbackResponse(request, route, requestBody);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (service === 'tickets') {
    const response = getTicketFallbackResponse(request, route, requestBody);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (service === 'payments') {
    const response = getPaymentFallbackResponse(request, route, requestBody);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (lastUpstreamResponse) {
    return lastUpstreamResponse;
  }

  return NextResponse.json(
    {
      detail: `${service || 'API'} service is unavailable right now.`,
    },
    { status: 503 }
  );
}

function getEventFallbackResponse(request: NextRequest, route: string, requestBody: any) {
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

  if (normalizedRoute === 'my-events') {
    const events = buildLocalMyEvents(request);
    if (!events) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    const response = NextResponse.json(events);
    response.headers.set('x-evently-source', 'local-fallback');
    return response;
  }

  if (normalizedRoute === 'analytics/overview') {
    const userId = requireLocalUserId(request);
    if (!userId) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(buildLocalOverview(request));
  }

  if (normalizedRoute === 'calendars') {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const actor = readLocalActor(request);
      if (!actor) {
        return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
      }

      ensureLocalOwnerCalendar(request);
      return NextResponse.json(
        getOwnedLocalCalendars(actor.userId).map((calendar) => serializeLocalCalendar(calendar))
      );
    }

    if (request.method === 'POST') {
      return createLocalCalendarResponse(request, requestBody);
    }
  }

  if (normalizedRoute.startsWith('calendars/')) {
    const calendarRoute = normalizedRoute.slice('calendars/'.length);
    const calendarSegments = calendarRoute.split('/');
    const calendarSlug = calendarSegments[0];
    const calendarSubroute = calendarSegments.slice(1).join('/');

    if (calendarSlug && !calendarSubroute && (request.method === 'GET' || request.method === 'HEAD')) {
      return getLocalCalendarResponse(request, calendarSlug);
    }

    if (calendarSlug && !calendarSubroute && request.method === 'PUT') {
      return updateLocalCalendarResponse(request, calendarSlug, requestBody);
    }

    if (calendarSlug && calendarSubroute === 'events' && (request.method === 'GET' || request.method === 'HEAD')) {
      return getLocalCalendarEventsResponse(request, calendarSlug);
    }
  }

  if (normalizedRoute.startsWith('manage/')) {
    const subRoute = normalizedRoute.slice(7); // {slug} or {slug}/invite etc.
    const slug = subRoute.split('/')[0];
    const event = getLocalEventBySlug(slug);
    
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }

    if (subRoute.endsWith('/invite')) {
       return NextResponse.json({ detail: 'Event service is unavailable right now.' }, { status: 503 });
    }
    if (subRoute.endsWith('/invitations') || subRoute.endsWith('/guests')) {
       return NextResponse.json([]);
    }
    if (subRoute.endsWith('/blast')) {
       return NextResponse.json({ detail: 'Event service is unavailable right now.' }, { status: 503 });
    }

    return NextResponse.json(event);
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && !normalizedRoute) {
    return NextResponse.json(listPublishedLocalEvents());
  }

  if (request.method === 'POST' && !normalizedRoute) {
    if (!requestBody || typeof requestBody !== 'object') {
      return NextResponse.json({ detail: 'Invalid event payload.' }, { status: 400 });
    }

    let selectedCalendar: LocalCalendar | null = null;
    if (requestBody?.calendar_id !== undefined && requestBody?.calendar_id !== null) {
      selectedCalendar = getLocalCalendarById(String(requestBody.calendar_id));
      if (!selectedCalendar) {
        return NextResponse.json({ detail: 'Calendar not found' }, { status: 404 });
      }

      const actor = readLocalActor(request);
      if (!actor) {
        return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
      }

      if (selectedCalendar.owner_id !== actor.userId) {
        return NextResponse.json({ detail: 'Not authorized to use this calendar' }, { status: 403 });
      }
    } else {
      selectedCalendar = ensureLocalOwnerCalendar(request);
    }

    const localEvent = persistLocalEvent(buildLocalEvent(requestBody, request, selectedCalendar));
    return NextResponse.json(localEvent, { status: 201 });
  }

  if (
    (request.method === 'PUT' || request.method === 'PATCH') &&
    normalizedRoute &&
    !normalizedRoute.startsWith('analytics/') &&
    !normalizedRoute.endsWith('/analytics') &&
    !normalizedRoute.endsWith('/community')
  ) {
    const userId = requireLocalUserId(request);
    if (!userId) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    if (!requestBody || typeof requestBody !== 'object') {
      return NextResponse.json({ detail: 'Invalid event payload.' }, { status: 400 });
    }

    const event = getLocalEventByIdOrSlug(normalizedRoute);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }

    if (event.host_id !== userId) {
      return NextResponse.json({ detail: 'Not authorized to manage this event' }, { status: 403 });
    }

    return NextResponse.json(updateLocalEvent(event, requestBody));
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('id/')) {
    const eventId = normalizedRoute.slice(3);
    const event = getLocalEventById(eventId);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(event);
  }

  if (request.method === 'GET' && normalizedRoute.endsWith('/community')) {
    const slug = normalizedRoute.slice(0, -'/community'.length);
    const community = buildLocalCommunity(slug);
    if (!community) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(community);
  }

  if (request.method === 'GET' && normalizedRoute.endsWith('/analytics')) {
    const eventKey = normalizedRoute.slice(0, -'/analytics'.length);
    const event = getLocalEventByIdOrSlug(eventKey);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(buildLocalEventAnalytics(event));
  }

  if (request.method === 'GET' && normalizedRoute === 'admin/all') {
    return NextResponse.json(sortEventsByCreatedDesc(listAllLocalEvents()));
  }

  if (request.method === 'GET' && normalizedRoute === 'admin/stats') {
    return NextResponse.json(buildLocalAdminStats());
  }

  if (request.method === 'GET' && normalizedRoute === 'blasts') {
    return NextResponse.json([]);
  }

  if (request.method === 'GET' && normalizedRoute === 'invitations/suggestions') {
    return NextResponse.json({ detail: 'Event service is unavailable right now.' }, { status: 503 });
  }

  if (request.method === 'GET' && normalizedRoute) {
    const event = getLocalEventByIdOrSlug(normalizedRoute);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json(event);
  }

  return NextResponse.json(
    {
      detail: 'Event service is unavailable right now.',
    },
    { status: 503 }
  );
}

function getUserFallbackResponse(request: NextRequest, route: string, requestBody: any) {
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');
  const actor = readLocalActor(request);

  if (request.method === 'POST' && normalizedRoute === 'otp/request') {
    return NextResponse.json({
      success: true,
      message: 'OTP sent to email (simulated)',
      resend_in_seconds: 60,
      debug_code: '123456',
    });
  }

  if (request.method === 'POST' && normalizedRoute === 'otp/verify') {
    const userId = crypto.randomUUID();
    const email = String(requestBody?.email || 'dev@example.com').trim().toLowerCase();
    const user = ensureLocalUser(userId, {
      email,
      name: String(requestBody?.name || displayNameFromEmail(email)),
      role: getLocalUserRole(email, 'user'),
    });
    const token = createFallbackToken(userId, user.role);
    return NextResponse.json({
      token,
      data: buildLocalUserResponse(user),
      success: true,
    });
  }

  if (request.method === 'POST' && normalizedRoute === 'signup') {
    const email = String(requestBody?.email || '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ detail: 'Email is required.' }, { status: 400 });
    }

    if (getLocalUserByEmail(email)) {
      return NextResponse.json({ detail: 'User already exists with this email' }, { status: 400 });
    }

    const userId = crypto.randomUUID();
    const user = ensureLocalUser(userId, {
      email,
      name: String(requestBody?.name || displayNameFromEmail(email)),
      role: getLocalUserRole(email, 'user'),
    });
    const token = createFallbackToken(userId, user.role);
    return NextResponse.json(
      {
        success: true,
        token,
        data: buildLocalUserResponse(user),
      },
      { status: 201 }
    );
  }

  if (request.method === 'POST' && normalizedRoute === 'login') {
    const email = String(requestBody?.email || '').trim().toLowerCase();
    const existingUser = getLocalUserByEmail(email);
    const user =
      existingUser ||
      ensureLocalUser(crypto.randomUUID(), {
        email,
        name: String(requestBody?.name || displayNameFromEmail(email || 'dev@example.com')),
        role: getLocalUserRole(email, 'user'),
      });

    const token = createFallbackToken(user.id, user.role);
    return NextResponse.json({
      success: true,
      token,
      data: buildLocalUserResponse(user),
    });
  }

  if (request.method === 'GET' && normalizedRoute === 'profile') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const user = ensureLocalUser(actor.userId, {
      email: actor.email,
      name: actor.name,
    });
    return NextResponse.json(buildLocalUserResponse(user));
  }

  if (request.method === 'PUT' && normalizedRoute === 'profile') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    if (!requestBody || typeof requestBody !== 'object') {
      return NextResponse.json({ detail: 'Invalid profile payload.' }, { status: 400 });
    }

    const user = ensureLocalUser(actor.userId, {
      email: actor.email,
      name: String(requestBody?.name || actor.name || displayNameFromEmail(actor.email || 'dev@example.com')),
      bio: String(requestBody?.bio || ''),
      profile_image: String(requestBody?.profile_image || ''),
      links: normalizeLocalLinks(requestBody?.links),
    });
    const token = createFallbackToken(user.id, user.role);
    return NextResponse.json({
      success: true,
      token,
      data: buildLocalUserResponse(user),
    });
  }

  if (request.method === 'GET' && normalizedRoute === 'admin/users') {
    const adminUser = actor ? getLocalUserById(actor.userId) : null;
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ detail: 'Admin access required.' }, { status: 403 });
    }

    const users = Array.from(localStore.usersById.values())
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((user) => buildLocalUserResponse(user));
    return NextResponse.json(users);
  }

  if (request.method === 'GET' && normalizedRoute === 'admin/stats') {
    const adminUser = actor ? getLocalUserById(actor.userId) : null;
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ detail: 'Admin access required.' }, { status: 403 });
    }

    return NextResponse.json({
      total_users: localStore.usersById.size,
      admin_users: Array.from(localStore.usersById.values()).filter((user) => user.role === 'admin').length,
      active_users: localStore.usersById.size,
    });
  }

  if (request.method === 'GET' && normalizedRoute) {
    const user = getLocalUserById(normalizedRoute) || getLocalUserByEmail(normalizedRoute);
    if (!user) {
      return NextResponse.json({ detail: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(buildLocalUserResponse(user));
  }

  return NextResponse.json(
    {
      detail: 'Users service is unavailable right now.',
    },
    { status: 503 }
  );
}

function getTicketFallbackResponse(request: NextRequest, route: string, requestBody: any) {
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');
  const actor = readLocalActor(request);

  if (request.method === 'POST' && normalizedRoute === 'book') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const eventId = String(requestBody?.event_id || '').trim();
    if (!eventId) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }

    const event = getLocalEventByIdOrSlug(eventId);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }

    const existingTicket = getLocalEventTickets(event.id).find(
      (ticket) => ticket.user_id === actor.userId && !['cancelled', 'rejected'].includes(ticket.status)
    );
    if (existingTicket) {
      return NextResponse.json(
        {
          detail: 'You already have a ticket or waitlist entry for this event',
        },
        { status: 400 }
      );
    }

    const reservedCount = getLocalEventTickets(event.id).filter((ticket) =>
      ['confirmed', 'pending_payment', 'pending_approval'].includes(ticket.status)
    ).length;
    const soldOut = Boolean(event.max_seats && event.max_seats > 0 && reservedCount >= event.max_seats);
    const ticketType = event.is_paid ? 'paid' : 'free';
    const ticketRef = `EVTLY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const status = soldOut ? 'waitlisted' : event.is_paid ? 'pending_payment' : 'confirmed';
    const paymentStatus = soldOut ? 'none' : event.is_paid ? 'pending' : 'none';
    const profile = ensureLocalUser(actor.userId, {
      email: actor.email,
      name: actor.name,
    });
    const ticket = persistLocalTicket({
      id: crypto.randomUUID(),
      ticket_ref: ticketRef,
      event_id: event.id,
      user_id: actor.userId,
      status,
      ticket_type: ticketType,
      payment_status: paymentStatus,
      stripe_session_id: '',
      qr_code: status === 'waitlisted' ? '' : buildLocalQrCode(ticketRef, event.id, actor.userId),
      checked_in: false,
      checked_in_at: null,
      created_at: new Date().toISOString(),
      amount: Number(event.ticket_price || 0),
    });
    refreshLocalEventMetrics(event.id);

    return NextResponse.json(buildLocalTicketDetail(ticket, event, profile), { status: 201 });
  }

  if (request.method === 'GET' && normalizedRoute === 'my-tickets') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const tickets = Array.from(localStore.ticketsById.values())
      .filter((ticket) => ticket.user_id === actor.userId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((ticket) => buildLocalTicketDetail(ticket, getLocalEventById(ticket.event_id), getLocalUserById(ticket.user_id)));
    return NextResponse.json(tickets);
  }

  if (request.method === 'GET' && normalizedRoute === 'by-ref') {
    return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 });
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('by-ref/')) {
    const ticketRef = normalizedRoute.slice('by-ref/'.length);
    const ticket = getLocalTicketByRef(ticketRef);
    if (!ticket) {
      return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json(
      buildLocalTicketDetail(ticket, getLocalEventById(ticket.event_id), getLocalUserById(ticket.user_id))
    );
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('event/')) {
    const eventRoute = normalizedRoute.slice('event/'.length);
    const [eventId, subRoute = ''] = eventRoute.split('/', 2);
    const event = getLocalEventByIdOrSlug(eventId);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }

    const eventHost = actor ? getLocalUserById(actor.userId) : null;
    if (!eventHost || event.host_id !== actor?.userId) {
      return NextResponse.json({ detail: 'Not authorized to view this event' }, { status: 403 });
    }

    const tickets = getLocalEventTickets(event.id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((ticket) => buildLocalTicketDetail(ticket, event, getLocalUserById(ticket.user_id)));

    if (subRoute === 'summary') {
      const confirmed = tickets.filter((ticket) => ticket.status === 'confirmed').length;
      const waitlisted = tickets.filter((ticket) => ticket.status === 'waitlisted').length;
      const checkedIn = tickets.filter((ticket) => ticket.checked_in).length;
      const paidConfirmed = tickets.filter(
        (ticket) => ticket.status === 'confirmed' && ticket.ticket_type === 'paid' && ticket.payment_status === 'completed'
      ).length;

      return NextResponse.json({
        event_id: event.id,
        title: event.title,
        slug: event.slug,
        confirmed,
        waitlisted,
        checked_in: checkedIn,
        ticket_sales: paidConfirmed * Number(event.ticket_price || 0),
        reserved: tickets.filter((ticket) =>
          ['confirmed', 'pending_payment', 'pending_approval'].includes(ticket.status)
        ).length,
      });
    }

    if (subRoute === 'checked-in') {
      return NextResponse.json(tickets.filter((ticket) => ticket.checked_in));
    }

    return NextResponse.json(tickets);
  }

  if (request.method === 'PUT' && normalizedRoute.startsWith('manage/')) {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const ticketId = normalizedRoute.slice('manage/'.length);
    const ticket = getLocalTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 });
    }

    const event = getLocalEventById(ticket.event_id);
    if (!event || event.host_id !== actor.userId) {
      return NextResponse.json({ detail: 'Not authorized to manage this ticket' }, { status: 403 });
    }

    if (!requestBody || typeof requestBody !== 'object') {
      return NextResponse.json({ detail: 'Invalid ticket payload.' }, { status: 400 });
    }

    ticket.status = String(requestBody?.status || ticket.status);
    if (['cancelled', 'rejected'].includes(ticket.status)) {
      ticket.checked_in = false;
      ticket.checked_in_at = null;
      if (ticket.payment_status === 'pending') {
        ticket.payment_status = 'failed';
      }
    }
    if (ticket.status === 'confirmed' && ticket.payment_status === 'pending') {
      ticket.payment_status = 'completed';
    }

    persistLocalTicket(ticket);
    refreshLocalEventMetrics(event.id);
    return NextResponse.json(buildLocalTicketDetail(ticket, event, getLocalUserById(ticket.user_id)));
  }

  return NextResponse.json(
    {
      detail: 'Ticket service is unavailable right now.',
    },
    { status: 503 }
  );
}

function getPaymentFallbackResponse(request: NextRequest, route: string, requestBody: any) {
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');
  const actor = readLocalActor(request);

  if (request.method === 'POST' && normalizedRoute === 'create-session') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const eventId = String(requestBody?.event_id || '').trim();
    const ticketRef = String(requestBody?.ticket_ref || '').trim();
    if (!eventId || !ticketRef) {
      return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 });
    }

    const event = getLocalEventByIdOrSlug(eventId);
    const ticket = getLocalTicketByRef(ticketRef);
    if (!event || !ticket || ticket.event_id !== event.id) {
      return NextResponse.json({ detail: 'Ticket not found for this event' }, { status: 404 });
    }
    if (ticket.user_id !== actor.userId) {
      return NextResponse.json({ detail: 'Not authorized to manage this ticket' }, { status: 403 });
    }
    if (ticket.status === 'waitlisted') {
      return NextResponse.json({ detail: 'Waitlisted tickets cannot be paid until approved' }, { status: 400 });
    }

    const existingPayment = Array.from(localStore.paymentsBySessionId.values()).find(
      (payment) => payment.ticket_ref === ticketRef && payment.user_id === actor.userId && payment.status === 'succeeded'
    );
    if (existingPayment) {
      return NextResponse.json({
        success: true,
        url: `${getFrontendBaseUrl(request)}/payment-success?session_id=${existingPayment.stripe_session_id}`,
      });
    }

    const sessionId = `dev_${ticketRef}_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const payment = persistLocalPayment({
      id: crypto.randomUUID(),
      user_id: actor.userId,
      ticket_ref: ticketRef,
      event_id: event.id,
      stripe_session_id: sessionId,
      amount: Number(event.ticket_price || requestBody?.amount || 0),
      status: 'succeeded',
      created_at: now,
      updated_at: now,
    });

    ticket.status = 'confirmed';
    ticket.payment_status = 'completed';
    ticket.ticket_type = 'paid';
    ticket.stripe_session_id = sessionId;
    ticket.qr_code = ticket.qr_code || buildLocalQrCode(ticket.ticket_ref, event.id, actor.userId);
    persistLocalTicket(ticket);
    refreshLocalEventMetrics(event.id);

    return NextResponse.json({
      success: true,
      url: `${getFrontendBaseUrl(request)}/payment-success?session_id=${payment.stripe_session_id}`,
    });
  }

  if (request.method === 'GET' && normalizedRoute === 'my-payments') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const payments = Array.from(localStore.paymentsBySessionId.values())
      .filter((payment) => payment.user_id === actor.userId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((payment) => buildLocalPaymentResponse(payment));
    return NextResponse.json({ success: true, data: payments });
  }

  if (request.method === 'POST' && normalizedRoute.startsWith('refund/')) {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const ticketRef = normalizedRoute.slice('refund/'.length);
    const payment = Array.from(localStore.paymentsBySessionId.values()).find(
      (entry) => entry.ticket_ref === ticketRef && entry.user_id === actor.userId
    );
    if (!payment) {
      return NextResponse.json({ detail: 'Payment not found' }, { status: 404 });
    }
    if (payment.status === 'refunded') {
      return NextResponse.json({ success: true, message: 'Payment already refunded' });
    }

    const ticket = getLocalTicketByRef(ticketRef);
    const event = ticket ? getLocalEventById(ticket.event_id) : null;
    payment.status = 'refunded';
    payment.updated_at = new Date().toISOString();
    persistLocalPayment(payment);

    if (ticket) {
      ticket.status = 'cancelled';
      ticket.payment_status = 'refunded';
      ticket.checked_in = false;
      ticket.checked_in_at = null;
      persistLocalTicket(ticket);
    }
    if (event) {
      refreshLocalEventMetrics(event.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Refund processed',
      refund_id: payment.stripe_session_id,
    });
  }

  return NextResponse.json(
    {
      detail: 'Payment service is unavailable right now.',
    },
    { status: 503 }
  );
}

function getAttendeeFallbackResponse(request: NextRequest, route: string, requestBody: any) {
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');
  const actor = readLocalActor(request);

  if (request.method === 'POST' && normalizedRoute === 'check-in') {
    if (!actor) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    if (!requestBody || typeof requestBody !== 'object') {
      return NextResponse.json({ detail: 'Invalid check-in payload.' }, { status: 400 });
    }

    const event = getLocalEventByIdOrSlug(String(requestBody?.event_id || ''));
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    if (event.host_id !== actor.userId) {
      return NextResponse.json({ detail: 'Not authorized to manage this event' }, { status: 403 });
    }

    const ticket = getLocalTicketByRef(String(requestBody?.ticket_ref || ''));
    if (!ticket || ticket.event_id !== event.id) {
      return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 });
    }
    if (ticket.status !== 'confirmed') {
      return NextResponse.json({ detail: 'Only confirmed attendees can be checked in' }, { status: 400 });
    }
    if (ticket.checked_in) {
      return NextResponse.json({ detail: 'Attendee already checked in' }, { status: 400 });
    }

    const now = new Date().toISOString();
    ticket.checked_in = true;
    ticket.checked_in_at = now;
    persistLocalTicket(ticket);
    refreshLocalEventMetrics(event.id);

    return NextResponse.json({
      success: true,
      message: 'Attendee checked in successfully',
      event_title: event.title,
      attendee_id: ticket.id,
      checked_in_at: now,
    });
  }

  if (request.method === 'GET' && normalizedRoute === 'stats') {
    const hostEvents = actor
      ? Array.from(localStore.eventsById.values()).filter((event) => event.host_id === actor.userId)
      : [];
    const eventIds = new Set(hostEvents.map((event) => event.id));
    const tickets = Array.from(localStore.ticketsById.values()).filter((ticket) => eventIds.has(ticket.event_id));
    const confirmed = tickets.filter((ticket) => ticket.status === 'confirmed');
    const waitlisted = tickets.filter((ticket) => ticket.status === 'waitlisted');
    const checkedIn = tickets.filter((ticket) => ticket.checked_in);
    const eventPriceMap = new Map(hostEvents.map((event) => [event.id, Number(event.ticket_price || 0)]));
    const revenue = tickets.reduce((sum, ticket) => {
      if (ticket.status !== 'confirmed' || ticket.ticket_type !== 'paid' || ticket.payment_status !== 'completed') {
        return sum;
      }
      return sum + (eventPriceMap.get(ticket.event_id) || 0);
    }, 0);

    return NextResponse.json({
      total_events: hostEvents.length,
      total_attendees: tickets.length,
      confirmed_attendees: confirmed.length,
      waitlisted_attendees: waitlisted.length,
      checked_in_count: checkedIn.length,
      total_revenue: revenue,
    });
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('event/') && normalizedRoute.endsWith('/checked-in')) {
    const eventId = normalizedRoute.slice('event/'.length, -'/checked-in'.length);
    const event = getLocalEventByIdOrSlug(eventId);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    if (!actor || event.host_id !== actor.userId) {
      return NextResponse.json({ detail: 'Not authorized to manage this event' }, { status: 403 });
    }

    const attendees = getLocalEventTickets(event.id)
      .filter((ticket) => ticket.checked_in)
      .sort((left, right) => new Date(left.checked_in_at || left.created_at).getTime() - new Date(right.checked_in_at || right.created_at).getTime())
      .map((ticket) => buildLocalAttendeeResponse(ticket, event, getLocalUserById(ticket.user_id)));
    return NextResponse.json(attendees);
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('event/')) {
    const eventId = normalizedRoute.slice('event/'.length).split('/')[0];
    const event = getLocalEventByIdOrSlug(eventId);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }
    if (!actor || event.host_id !== actor.userId) {
      return NextResponse.json({ detail: 'Not authorized to manage this event' }, { status: 403 });
    }

    const attendees = getLocalEventTickets(event.id)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((ticket) => buildLocalAttendeeResponse(ticket, event, getLocalUserById(ticket.user_id)));
    return NextResponse.json(attendees);
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('public/event/')) {
    const eventId = normalizedRoute.slice('public/event/'.length);
    const event = getLocalEventByIdOrSlug(eventId);
    if (!event) {
      return NextResponse.json({ detail: 'Event not found' }, { status: 404 });
    }

    const allTickets = getLocalEventTickets(event.id);
    const attendees = allTickets
      .filter((ticket) => ticket.status === 'confirmed')
      .slice(0, 8)
      .map((ticket) => buildLocalAttendeeResponse(ticket, event, getLocalUserById(ticket.user_id)));
    return NextResponse.json({
      event_id: event.id,
      confirmed_count: allTickets.filter((ticket) => ticket.status === 'confirmed').length,
      waitlisted_count: allTickets.filter((ticket) => ticket.status === 'waitlisted').length,
      checked_in_count: allTickets.filter((ticket) => ticket.checked_in).length,
      attendees,
    });
  }

  if (request.method === 'GET' && normalizedRoute.startsWith('internal/on-ticket-purchased')) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    {
      detail: 'Attendee service is unavailable right now.',
    },
    { status: 503 }
  );
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function HEAD(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

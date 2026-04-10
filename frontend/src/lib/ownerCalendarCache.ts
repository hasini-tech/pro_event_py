'use client';

type CalendarCacheIdentity = {
  id?: string | null;
  email?: string | null;
} | null | undefined;

function getIdentityKeyPart(identity?: CalendarCacheIdentity) {
  const email = String(identity?.email || '')
    .trim()
    .toLowerCase();
  if (email) {
    return email;
  }

  const id = String(identity?.id || '').trim();
  return id || null;
}

export function getOwnerCalendarsCacheKey(identity?: CalendarCacheIdentity) {
  const identityPart = getIdentityKeyPart(identity);
  return identityPart ? `evently_owner_calendars_${identityPart}` : null;
}

export function getOwnerCalendarDetailCacheKey(
  identity?: CalendarCacheIdentity,
  slug?: string | null,
) {
  const identityPart = getIdentityKeyPart(identity);
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!identityPart || !normalizedSlug) {
    return null;
  }
  return `evently_owner_calendar_detail_${identityPart}_${normalizedSlug}`;
}

export function readOwnerCalendarsCache<T = unknown>(cacheKey: string | null) {
  if (typeof window === 'undefined' || !cacheKey) {
    return [] as T[];
  }

  try {
    const rawValue = localStorage.getItem(cacheKey);
    if (!rawValue) {
      return [] as T[];
    }

    const parsed = JSON.parse(rawValue) as { calendars?: unknown } | unknown[];
    const calendars = Array.isArray(parsed) ? parsed : parsed?.calendars;
    return Array.isArray(calendars) ? (calendars as T[]) : ([] as T[]);
  } catch {
    return [] as T[];
  }
}

export function writeOwnerCalendarsCache(cacheKey: string | null, calendars: unknown[]) {
  if (typeof window === 'undefined' || !cacheKey) {
    return;
  }

  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 1,
        saved_at: new Date().toISOString(),
        calendars,
      }),
    );
  } catch {
    // Ignore storage failures in private mode or restricted browsers.
  }
}

export function readOwnerCalendarDetailCache<T = unknown>(cacheKey: string | null) {
  if (typeof window === 'undefined' || !cacheKey) {
    return null as T | null;
  }

  try {
    const rawValue = localStorage.getItem(cacheKey);
    if (!rawValue) {
      return null as T | null;
    }

    const parsed = JSON.parse(rawValue) as { detail?: unknown } | unknown;
    return ((parsed && typeof parsed === 'object' && 'detail' in parsed ? parsed.detail : parsed) ??
      null) as T | null;
  } catch {
    return null as T | null;
  }
}

export function writeOwnerCalendarDetailCache(cacheKey: string | null, detail: unknown) {
  if (typeof window === 'undefined' || !cacheKey) {
    return;
  }

  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 1,
        saved_at: new Date().toISOString(),
        detail,
      }),
    );
  } catch {
    // Ignore storage failures in private mode or restricted browsers.
  }
}

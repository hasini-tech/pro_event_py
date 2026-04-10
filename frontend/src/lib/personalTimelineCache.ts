'use client';

type TimelineIdentity = {
  id?: string | null;
  email?: string | null;
} | null | undefined;

type CacheableTimelineItem = {
  id?: unknown;
};

export function readStoredTimelineIdentity() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawUser = localStorage.getItem('evently_user');
    if (!rawUser) {
      return null;
    }
    return JSON.parse(rawUser) as { id?: string; email?: string } | null;
  } catch {
    return null;
  }
}

export function getPersonalTimelineCacheKey(identity?: TimelineIdentity) {
  const email = String(identity?.email || '')
    .trim()
    .toLowerCase();
  if (email) {
    return `evently_personal_timeline_${email}`;
  }

  const id = String(identity?.id || '').trim();
  if (id) {
    return `evently_personal_timeline_${id}`;
  }

  return null;
}

export function readPersonalTimelineCacheItems<T = unknown>(cacheKey: string | null) {
  if (typeof window === 'undefined' || !cacheKey) {
    return [] as T[];
  }

  try {
    const rawValue = localStorage.getItem(cacheKey);
    if (!rawValue) {
      return [] as T[];
    }

    const parsed = JSON.parse(rawValue) as { events?: unknown } | unknown[];
    const events = Array.isArray(parsed) ? parsed : parsed?.events;
    return Array.isArray(events) ? (events as T[]) : ([] as T[]);
  } catch {
    return [] as T[];
  }
}

export function writePersonalTimelineCacheItems(cacheKey: string | null, events: unknown[]) {
  if (typeof window === 'undefined' || !cacheKey) {
    return;
  }

  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 1,
        saved_at: new Date().toISOString(),
        events,
      }),
    );
  } catch {
    // Ignore storage failures in private mode or restricted browsers.
  }
}

function getCacheItemId(item: CacheableTimelineItem | null | undefined) {
  const id = String(item?.id || '').trim();
  return id || null;
}

export function mergeUniqueTimelineItems<T extends CacheableTimelineItem>(primary: T[], secondary: T[]) {
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...secondary]) {
    const id = getCacheItemId(item);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(item);
  }

  return merged;
}

function readResponseHeader(headers: unknown, name: string) {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  const normalizedName = name.toLowerCase();
  const headerMap = headers as Record<string, unknown> & {
    get?: (headerName: string) => string | null | undefined;
  };

  if (typeof headerMap.get === 'function') {
    return headerMap.get(name) || headerMap.get(normalizedName) || null;
  }

  const direct = headerMap[name] ?? headerMap[normalizedName];
  return typeof direct === 'string' ? direct : null;
}

export function isLocalFallbackResponse(headers: unknown) {
  return readResponseHeader(headers, 'x-evently-source') === 'local-fallback';
}

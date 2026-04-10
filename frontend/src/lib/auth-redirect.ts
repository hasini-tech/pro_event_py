const DEFAULT_POST_LOGIN_PATH = '/create-event/form';
const DEFAULT_AUTH_HOME_PATH = '/dashboard?tab=events';

export function getSafeRedirectPath(
  redirectPath?: string | null,
  fallback = DEFAULT_POST_LOGIN_PATH,
) {
  if (!redirectPath) {
    return fallback;
  }

  if (!redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return fallback;
  }

  return redirectPath;
}

type AuthHrefOptions = {
  forceLogin?: boolean;
};

export function shouldForceLogin(forceLogin?: string | null) {
  return forceLogin === '1';
}

export function buildAuthHref(
  pathname: '/login' | '/signup',
  redirectPath?: string | null,
  options?: AuthHrefOptions,
) {
  const safeRedirectPath = getSafeRedirectPath(redirectPath);
  const params = new URLSearchParams({ redirect: safeRedirectPath });
  if (options?.forceLogin) {
    params.set('forceLogin', '1');
  }
  return `${pathname}?${params.toString()}`;
}

export { DEFAULT_AUTH_HOME_PATH, DEFAULT_POST_LOGIN_PATH };

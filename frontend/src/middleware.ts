import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_AUTH_HOME_PATH, getSafeRedirectPath, shouldForceLogin } from '@/lib/auth-redirect';

// Add paths that require authentication here
const protectedPaths = [
  '/dashboard',
  '/create-event',
  '/manage',
  '/manage-attendees',
  '/check-in',
  '/profile',
];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('evently_token')?.value;

  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));
  
  if (isProtectedPath && !token) {
    // Redirect to login if accessing a protected route without a token
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if logged in and trying to access auth pages
  const isAuthPath = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup');
  const forceLogin = shouldForceLogin(request.nextUrl.searchParams.get('forceLogin'));
  if (isAuthPath && token && !forceLogin) {
    const redirectPath = getSafeRedirectPath(
      request.nextUrl.searchParams.get('redirect'),
      DEFAULT_AUTH_HOME_PATH,
    );
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  return NextResponse.next();
}

// Config to specify which paths the middleware should run on
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/create-event/:path*',
    '/manage/:path*',
    '/manage-attendees/:path*',
    '/check-in/:path*',
    '/profile/:path*',
    '/login',
    '/signup'
  ],
};

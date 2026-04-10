'use client';

import React, { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import EmailOtpGate from '@/components/EmailOtpGate';
import {
  getSafeRedirectPath,
  shouldForceLogin,
} from '@/lib/auth-redirect';

function LoginContent() {
  const searchParams = useSearchParams();

  const redirectPath = useMemo(
    () => getSafeRedirectPath(searchParams?.get('redirect')),
    [searchParams],
  );
  const forceLogin = useMemo(
    () => shouldForceLogin(searchParams?.get('forceLogin')),
    [searchParams],
  );

  return <EmailOtpGate redirectPath={redirectPath} forceVerification={forceLogin} />;
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary-color)" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

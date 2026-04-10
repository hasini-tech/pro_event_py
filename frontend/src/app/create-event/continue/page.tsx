'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import EmailOtpGate from '@/components/EmailOtpGate';
import { getSafeRedirectPath } from '@/lib/auth-redirect';

function CreateEventContinueContent() {
  const searchParams = useSearchParams();
  const redirectPath = useMemo(
    () => getSafeRedirectPath(searchParams?.get('redirect'), '/create-event/form'),
    [searchParams],
  );

  return (
    <EmailOtpGate
      redirectPath={redirectPath}
      forceVerification
      eyebrow="Event builder"
      emailHeading="Continue with email"
      emailDescription="Enter your email address and we will send a 6 digit code. Once you verify it, the create event form page will open next."
    />
  );
}

export default function CreateEventContinuePage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary-color)" />
        </div>
      }
    >
      <CreateEventContinueContent />
    </Suspense>
  );
}

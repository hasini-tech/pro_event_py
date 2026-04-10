import { redirect } from 'next/navigation';
import { buildAuthHref } from '@/lib/auth-redirect';

type SignupPageProps = {
  searchParams?: {
    redirect?: string;
    forceLogin?: string;
  };
};

export default function SignupPage({ searchParams }: SignupPageProps) {
  const redirectPath =
    typeof searchParams?.redirect === 'string' ? searchParams.redirect : undefined;
  const forceLogin = searchParams?.forceLogin === '1';

  redirect(buildAuthHref('/login', redirectPath, { forceLogin }));
}

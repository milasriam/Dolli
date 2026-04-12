import { useEffect } from 'react';
import { authApi } from '../lib/auth';
import { AuthChrome } from '@/components/AuthChrome';

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const linked = params.get('linked');
    const errorMessage = params.get('msg');

    if (errorMessage) {
      window.location.assign(`/auth/error?msg=${encodeURIComponent(errorMessage)}`);
      return;
    }

    if (!token) {
      window.location.assign('/auth/error?msg=Missing authentication token');
      return;
    }

    authApi.setStoredToken(token);
    window.location.assign(linked === '1' ? '/profile?social_linked=1' : '/profile');
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthChrome />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 outline-none"
      >
        <div
          className="h-12 w-12 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-400"
          role="status"
          aria-label="Loading"
        />
        <p className="mt-6 text-sm text-muted-foreground">Finishing sign-in…</p>
      </main>
    </div>
  );
}

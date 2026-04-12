import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { AuthChrome } from '@/components/AuthChrome';

export default function MagicLinkLogin() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [error, setError] = useState('');
  const [working, setWorking] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(t('auth.magicMissingToken'));
      setWorking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setWorking(true);
      setError('');
      try {
        await authApi.consumeMagicLink(token);
        const profileOk = await refetch();
        if (cancelled) return;
        if (!profileOk) {
          setError(t('auth.signedInNoProfile'));
          setWorking(false);
          return;
        }
        navigate('/profile', { replace: true });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('auth.loginFailed'));
          setWorking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate, refetch]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthChrome />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 outline-none sm:py-14"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <h1 className="text-xl font-bold mb-2">{t('auth.magicOpening')}</h1>
          {working ? (
            <div className="flex justify-center py-8">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : error ? (
            <>
              <p className="text-sm text-red-400 mb-6">{error}</p>
              <Link
                to="/login"
                className="text-sm font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400"
              >
                {t('auth.signIn')}
              </Link>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

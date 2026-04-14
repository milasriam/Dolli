import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi, fetchLoginOptions, type LoginOptions } from '@/lib/auth';
import { AuthChrome } from '@/components/AuthChrome';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [opts, setOpts] = useState<LoginOptions | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      const o = await fetchLoginOptions();
      if (!c) {
        setOpts(o);
        setLoadingOpts(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Show form if server advertises reset, or if email/password login exists (user came from login; POST still enforces SMTP + ALLOW_PASSWORD_RESET).
  const enabled = Boolean(opts?.password_reset || opts?.password);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthChrome />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 outline-none sm:py-14"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <h1 className="text-2xl font-bold mb-1">{t('auth.resetRequestTitle')}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t('auth.resetRequestHint')}</p>

          {loadingOpts ? (
            <div className="flex justify-center py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : !enabled ? (
            <p className="text-sm text-amber-900 dark:text-amber-200/90">{t('profileAccount.configureServer')}</p>
          ) : sent ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('auth.resetRequestSent')}</p>
          ) : (
            <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4">
              <input
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500"
                type="email"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? t('auth.magicSending') : t('auth.resetRequestSubmit')}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-violet-700 hover:text-violet-600 dark:text-violet-400">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

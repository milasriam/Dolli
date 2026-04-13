import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi, fetchLoginOptions, type LoginOptions } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { AuthChrome } from '@/components/AuthChrome';

const GoogleGlyph = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const TikTokGlyph = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.28 8.28 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.28z" />
  </svg>
);

const MetaGlyph = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.23.14.27-.01.06.01.24 0 .38z" />
  </svg>
);

function SocialButton({
  label,
  sub,
  icon,
  onClick,
}: {
  label: string;
  sub?: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3.5 text-left text-foreground transition-all hover:bg-muted hover:border-muted-foreground/20"
    >
      <span className="shrink-0 text-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {sub ? <span className="block text-xs text-muted-foreground mt-0.5">{sub}</span> : null}
      </span>
    </button>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = location.pathname === '/register';
  const { refetch } = useAuth();
  const [opts, setOpts] = useState<LoginOptions | null>(null);
  const [optsLoading, setOptsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOptsLoading(true);
      const o = await fetchLoginOptions();
      if (!cancelled) {
        setOpts(o);
        setOptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister && opts?.email_signup) {
        await authApi.register(email.trim(), password);
      } else {
        await authApi.localLogin(email.trim(), password);
      }
      const profileOk = await refetch();
      if (!profileOk) {
        setError(t('auth.signedInNoProfile'));
        return;
      }
      navigate('/profile');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; code?: string; message?: string };
      const detail = ax?.response?.data?.detail;
      const code = ax?.code;
      if (code === 'ERR_NETWORK' || ax?.message === 'Network Error') {
        const h = window.location.hostname;
        const hint = h.includes('staging') ? t('auth.hintStaging') : t('auth.hintProd');
        setError(t('auth.networkError', { hint }));
      } else {
        setError(typeof detail === 'string' ? detail : ax?.message || t('auth.loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const anySocial =
    opts?.google_oidc || opts?.tiktok || opts?.meta_facebook || opts?.local_demo_redirect;
  const anyMethod = Boolean(anySocial || opts?.password || opts?.magic_link);

  const sendMagicLink = async () => {
    setMagicError('');
    setMagicSent(false);
    setMagicLoading(true);
    try {
      await authApi.requestMagicLink(magicEmail.trim());
      setMagicSent(true);
    } catch (err: unknown) {
      const ax = err as { message?: string };
      setMagicError(ax?.message || t('auth.magicSendFailed'));
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthChrome />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 outline-none sm:py-14"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h1 className="text-2xl font-bold mb-1">
          {isRegister ? t('auth.createAccount') : t('auth.signIn')}
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          {isRegister ? t('auth.registerBlurb') : t('auth.loginBlurb')}
        </p>

        {optsLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {!opts || !anyMethod ? (
              <p className="mb-4 text-sm text-amber-900 dark:text-amber-200/90">{t('auth.noMethods')}</p>
            ) : (
              <div className="space-y-3 mb-6">
                {opts.google_oidc ? (
                  <SocialButton
                    label={t('auth.continueGoogle')}
                    sub={t('auth.subGoogle')}
                    icon={GoogleGlyph}
                    onClick={() => authApi.startGoogleOidc()}
                  />
                ) : null}
                {opts.tiktok ? (
                  <SocialButton
                    label={t('auth.continueTiktok')}
                    sub={t('auth.subTiktok')}
                    icon={TikTokGlyph}
                    onClick={() => authApi.startTikTok()}
                  />
                ) : null}
                {opts.meta_facebook ? (
                  <SocialButton
                    label={t('auth.continueFacebook')}
                    sub={t('auth.subFacebook')}
                    icon={MetaGlyph}
                    onClick={() => authApi.startMetaFacebook()}
                  />
                ) : null}
                {opts.local_demo_redirect && !opts.google_oidc ? (
                  <SocialButton
                    label={t('auth.demoSession')}
                    sub={t('auth.subDemo')}
                    icon={<span className="text-lg">⚡</span>}
                    onClick={() => authApi.startGoogleOidc()}
                  />
                ) : null}
              </div>
            )}

            {opts?.password && (!isRegister || opts.email_signup) ? (
              <>
                <div className="flex items-center gap-3 my-6">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('auth.orEmail')}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                  <input
                    className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500"
                    type="email"
                    placeholder={t('auth.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500"
                    type="password"
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isRegister && opts.email_signup ? 8 : undefined}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                  />
                  {/* Show whenever email/password sign-in exists; forgot page explains if server has no SMTP / ALLOW_PASSWORD_RESET */}
                  {!isRegister && opts?.password ? (
                    <div className="text-right -mt-1">
                      <Link
                        to="/auth/forgot-password"
                        className="text-xs font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
                      >
                        {t('auth.forgotPassword')}
                      </Link>
                    </div>
                  ) : null}
                  {error ? <p className="text-red-400 text-sm">{error}</p> : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loading ? t('auth.signingIn') : isRegister ? t('auth.signUpEmail') : t('auth.signInEmail')}
                  </button>
                </form>
              </>
            ) : isRegister && !opts?.email_signup ? (
              <p className="mt-4 text-sm text-muted-foreground">{t('auth.emailSignupDisabled')}</p>
            ) : null}

            {opts?.magic_link ? (
              <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">{t('auth.magicLinkTitle')}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t('auth.magicLinkHint')}</p>
                <input
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-500"
                  type="email"
                  placeholder={t('auth.email')}
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  disabled={magicLoading}
                />
                {magicError ? <p className="text-xs text-red-400">{magicError}</p> : null}
                {magicSent ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('auth.magicSent')}</p>
                ) : null}
                <button
                  type="button"
                  disabled={magicLoading || !magicEmail.trim()}
                  onClick={() => void sendMagicLink()}
                  className="w-full rounded-lg bg-muted py-2.5 text-sm font-semibold text-foreground border border-border hover:bg-muted/80 disabled:opacity-50"
                >
                  {magicLoading ? t('auth.magicSending') : t('auth.magicSend')}
                </button>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground mt-6 text-center leading-relaxed">{t('auth.termsBlurb')}</p>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {isRegister ? (
                <>
                  {t('auth.alreadyHave')}{' '}
                  <Link to="/login" className="font-medium text-violet-700 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">
                    {t('auth.signIn')}
                  </Link>
                </>
              ) : (
                <>
                  {t('auth.newHere')}{' '}
                  <Link to="/register" className="font-medium text-violet-700 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300">
                    {t('auth.createAccount')}
                  </Link>
                </>
              )}
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}

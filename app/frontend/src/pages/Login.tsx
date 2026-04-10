import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
      className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-left hover:bg-white/[0.1] hover:border-white/20 transition-all"
    >
      <span className="shrink-0 text-white">{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold text-white text-sm">{label}</span>
        {sub ? <span className="block text-xs text-slate-500 mt-0.5">{sub}</span> : null}
      </span>
    </button>
  );
}

export default function Login() {
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
      await authApi.localLogin(email.trim(), password);
      const profileOk = await refetch();
      if (!profileOk) {
        setError(
          'Signed in, but the app could not load your profile (API error or session). Refresh the page or try again.',
        );
        return;
      }
      navigate('/profile');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; code?: string; message?: string };
      const detail = ax?.response?.data?.detail;
      const code = ax?.code;
      if (code === 'ERR_NETWORK' || ax?.message === 'Network Error') {
        const h = window.location.hostname;
        const stagingHint =
          'Use https://staging.dolli.space (not http://). Confirm requests go to the same host for /api.';
        const prodHint =
          'Use https://dolli.space or https://www.dolli.space (not http://). Confirm requests go to https://api.dolli.space.';
        setError(
          `Network error: often CORS or wrong protocol. ${h.includes('staging') ? stagingHint : prodHint} Check DevTools → Network for the failing OPTIONS/POST.`,
        );
      } else {
        setError(typeof detail === 'string' ? detail : ax?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const anySocial =
    opts?.google_oidc || opts?.tiktok || opts?.meta_facebook || opts?.local_demo_redirect;

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <AuthChrome />
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13131A]/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
        <h1 className="text-2xl font-bold mb-1">{isRegister ? 'Create account' : 'Sign in'}</h1>
        <p className="text-slate-400 text-sm mb-6">
          {isRegister
            ? 'Use Google, TikTok, or Facebook — we create your Dolli profile on first sign-in.'
            : 'Continue with a social account, or use email if your server enables it.'}
        </p>

        {optsLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {!opts || (!anySocial && !opts.password) ? (
              <p className="text-amber-200/90 text-sm mb-4">
                No sign-in methods are enabled on this server yet. Ask the operator to configure{' '}
                <code className="text-xs bg-black/40 px-1 rounded">OIDC_*</code> (Google),{' '}
                <code className="text-xs bg-black/40 px-1 rounded">TIKTOK_*</code>,{' '}
                <code className="text-xs bg-black/40 px-1 rounded">META_*</code>, or password login in the backend env.
              </p>
            ) : (
              <div className="space-y-3 mb-6">
                {opts.google_oidc ? (
                  <SocialButton
                    label="Continue with Google"
                    sub="Recommended — OpenID Connect"
                    icon={GoogleGlyph}
                    onClick={() => authApi.startGoogleOidc()}
                  />
                ) : null}
                {opts.tiktok ? (
                  <SocialButton
                    label="Continue with TikTok"
                    sub="TikTok Login Kit"
                    icon={TikTokGlyph}
                    onClick={() => authApi.startTikTok()}
                  />
                ) : null}
                {opts.meta_facebook ? (
                  <SocialButton
                    label="Continue with Facebook"
                    sub="Same Meta account used for Instagram apps"
                    icon={MetaGlyph}
                    onClick={() => authApi.startMetaFacebook()}
                  />
                ) : null}
                {opts.local_demo_redirect && !opts.google_oidc ? (
                  <SocialButton
                    label="Demo session (dev)"
                    sub="Uses ALLOW_LOCAL_AUTH — not for production"
                    icon={<span className="text-lg">⚡</span>}
                    onClick={() => authApi.startGoogleOidc()}
                  />
                ) : null}
              </div>
            )}

            {opts?.password ? (
              <>
                <div className="flex items-center gap-3 my-6">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">or email</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                  <input
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-violet-500 text-sm"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-violet-500 text-sm"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {error ? <p className="text-red-400 text-sm">{error}</p> : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 font-semibold disabled:opacity-60 text-sm"
                  >
                    {loading ? 'Signing in...' : isRegister ? 'Sign up with email' : 'Sign in with email'}
                  </button>
                </form>
              </>
            ) : null}

            <p className="text-xs text-slate-500 mt-6 text-center leading-relaxed">
              By continuing you agree to our terms. Social logins may use a placeholder email for TikTok/Meta when the
              provider does not share one — you can still receive payouts using verified profile details later.
            </p>

            <div className="mt-6 text-center text-sm text-slate-400">
              {isRegister ? (
                <>
                  Already have an account?{' '}
                  <Link to="/login" className="text-violet-400 hover:text-violet-300 font-medium">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  New here?{' '}
                  <Link to="/register" className="text-violet-400 hover:text-violet-300 font-medium">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

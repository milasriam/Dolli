import { FormEvent, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { AuthChrome } from '@/components/AuthChrome';

/** Same minimum as backend ResetPasswordRequest.token (do not gate UI on login-options.password_reset). */
const MIN_TOKEN_LEN = 10;

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const tokenOk = token.trim().length >= MIN_TOKEN_LEN;
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (password !== password2) {
      setError(t('profileAccount.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPasswordWithToken(token, password);
      const ok = await refetch();
      if (!ok) {
        setError(t('auth.signedInNoProfile'));
        return;
      }
      navigate('/profile', { replace: true });
    } catch (err) {
      const ax = err as { code?: string; message?: string };
      if (ax?.code === 'ERR_NETWORK' || ax?.message === 'Network Error' || ax?.message === 'Failed to fetch') {
        const h = window.location.hostname;
        const hint = h.includes('staging') ? t('auth.hintStaging') : t('auth.hintProd');
        setError(t('auth.networkError', { hint }));
      } else {
        setError(err instanceof Error ? err.message : t('auth.loginFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  let body: ReactNode;
  if (!tokenOk) {
    body = (
      <>
        <p className="text-sm text-red-400 mb-6">{t('auth.resetTokenMissing')}</p>
        <Link to="/login" className="text-sm font-semibold text-violet-600 dark:text-violet-400">
          {t('auth.signIn')}
        </Link>
      </>
    );
  } else {
    body = (
      <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4">
        <input
          className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500"
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <input
          className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500"
          type="password"
          placeholder={t('profileAccount.confirmPassword')}
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? t('auth.resetPasswordLoading') : t('auth.resetPasswordSubmit')}
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthChrome />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 outline-none sm:py-14"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <h1 className="text-2xl font-bold mb-1">{t('auth.resetPasswordTitle')}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t('auth.resetPasswordHint')}</p>
          {body}
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

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthChrome } from '@/components/AuthChrome';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(5);
  const errorMessage = useMemo(
    () => searchParams.get('msg') || t('authError.defaultMessage'),
    [searchParams, t, i18n.language],
  );

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthChrome />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-12 outline-none"
      >
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-2xl" />
              <AlertCircle className="relative h-14 w-14 text-rose-600 dark:text-rose-400" strokeWidth={1.5} aria-hidden />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('authError.title')}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{errorMessage}</p>
            <p className="text-xs text-muted-foreground">
              {secondsLeft > 0 ? t('authError.redirect', { count: secondsLeft }) : t('authError.redirecting')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="rounded-xl bg-violet-600 px-6 text-white hover:bg-violet-500 border-0"
            >
              <Link to="/">{t('authError.home')}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-border bg-transparent text-foreground hover:bg-muted"
            >
              <Link to="/login">{t('authError.tryAgain')}</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

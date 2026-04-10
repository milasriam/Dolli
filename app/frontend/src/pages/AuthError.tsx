import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthChrome } from '@/components/AuthChrome';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(5);
  const errorMessage =
    searchParams.get('msg') ||
    'Your sign-in could not be completed. The link may have expired or already been used.';

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <AuthChrome />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-2xl" />
              <AlertCircle className="relative h-14 w-14 text-rose-400" strokeWidth={1.5} aria-hidden />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Sign-in problem</h1>
            <p className="text-sm leading-relaxed text-slate-400">{errorMessage}</p>
            <p className="text-xs text-slate-600">
              {secondsLeft > 0
                ? `Taking you home in ${secondsLeft}s…`
                : 'Redirecting…'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="rounded-xl bg-violet-600 px-6 text-white hover:bg-violet-500 border-0"
            >
              <Link to="/">Home</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5">
              <Link to="/login">Try again</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

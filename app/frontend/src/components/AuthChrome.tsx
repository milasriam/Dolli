import { Link } from 'react-router-dom';
import { DolliLogoLink } from '@/components/DolliLogoLink';

/** Minimal top bar for auth flows — full Header would duplicate “Sign in” on /login. */
export function AuthChrome() {
  return (
    <header className="shrink-0 border-b border-white/5 bg-[#0A0A0F]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <DolliLogoLink variant="header" />
        <Link
          to="/"
          className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          Home
        </Link>
      </div>
    </header>
  );
}

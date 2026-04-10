import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DolliLogoLink } from '@/components/DolliLogoLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  SITE_ACCOUNT_LINKS_GUEST,
  SITE_ACCOUNT_LINKS_USER,
  SITE_DISCOVER_LINKS,
} from '@/lib/siteNav';

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="block rounded-lg py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-white"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  const { user } = useAuth();
  const accountLinks = user ? SITE_ACCOUNT_LINKS_USER : SITE_ACCOUNT_LINKS_GUEST;

  return (
    <footer className="mt-auto border-t border-white/5 bg-[#08080f]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <DolliLogoLink variant="footer" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Social-native micro-donations: discover fundraisers, follow organizers, and share impact from one place.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Discover</p>
            <nav className="mt-3 flex flex-col" aria-label="Footer discover">
              {SITE_DISCOVER_LINKS.map((item) => (
                <FooterLink key={item.to} to={item.to}>
                  {item.label}
                </FooterLink>
              ))}
            </nav>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Your account</p>
            <nav className="mt-3 flex flex-col" aria-label="Footer account">
              {accountLinks.map((item) => (
                <FooterLink key={item.to} to={item.to}>
                  {item.label}
                </FooterLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-6 sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Why Dolli</p>
              <p className="mt-3 text-sm text-slate-500">
                Built for short-form video and messaging: $1 gifts, transparent organizer stats, and feeds tuned to who
                you follow.
              </p>
            </div>
            <p className="text-xs text-slate-600">© {new Date().getFullYear()} Dolli. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

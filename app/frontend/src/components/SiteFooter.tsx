import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
      className="block rounded-lg py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const accountLinks = user ? SITE_ACCOUNT_LINKS_USER : SITE_ACCOUNT_LINKS_GUEST;

  return (
    <footer className="mt-auto border-t border-border bg-muted/25">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <DolliLogoLink variant="footer" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{t('footer.tagline')}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('footer.discover')}</p>
            <nav className="mt-3 flex flex-col" aria-label={t('footer.discover')}>
              {SITE_DISCOVER_LINKS.map((item) => (
                <FooterLink key={item.to} to={item.to}>
                  {t(item.labelKey)}
                </FooterLink>
              ))}
            </nav>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('footer.yourAccount')}
            </p>
            <nav className="mt-3 flex flex-col" aria-label={t('footer.yourAccount')}>
              {accountLinks.map((item) => (
                <FooterLink key={item.to} to={item.to}>
                  {t(item.labelKey)}
                </FooterLink>
              ))}
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-6 sm:col-span-2 lg:col-span-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t('footer.whyDolli')}</p>
              <p className="mt-3 text-sm text-muted-foreground">{t('footer.whyBody')}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('footer.copyright', { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

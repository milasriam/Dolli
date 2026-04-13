import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadNotificationCount } from '@/lib/notifications';
import {
  Menu,
  X,
  Plus,
  User,
  BarChart3,
  Compass,
  LogOut,
  Lock,
  Bell,
  HeartHandshake,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DolliLogoLink } from '@/components/DolliLogoLink';
import { LanguageMenu } from '@/components/LanguageMenu';
import { ThemeAppearanceMenu } from '@/components/ThemeAppearanceMenu';
import { headerAvatarPromoClass } from '@/lib/curatedHighlight';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function NavLink({
  to,
  children,
  icon,
  onNavigate,
}: {
  to: string;
  children: ReactNode;
  icon?: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:min-h-0"
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-1">
      <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function mobileRowClass(active?: boolean) {
  return `block w-full text-left px-4 py-3 rounded-lg transition-colors ${
    active
      ? 'border border-violet-500/25 bg-violet-600/20 text-violet-100 dark:text-violet-100'
      : 'text-foreground hover:bg-muted/50'
  }`;
}

export default function Header() {
  const { t } = useTranslation();
  const { user, logout, loading, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void fetchUnreadNotificationCount().then((n) => {
        if (!cancelled) setUnreadNotifications(n);
      });
    };
    refresh();
    const t = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [user?.id]);

  const closeMobile = () => setMobileOpen(false);

  const accountLabel =
    user?.name?.trim() || (user?.email ? user.email.split('@')[0] : t('header.account'));

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-violet-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-background"
      >
        {t('a11y.skipToMain')}
      </a>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          {/* Logo + primary browse (desktop) */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <DolliLogoLink variant="header" />
            <nav className="hidden min-w-0 md:flex items-center gap-0.5" aria-label="Main">
              <NavLink to="/explore" icon={<Compass className="w-4 h-4 opacity-80" aria-hidden />}>
                {t('nav.explore')}
              </NavLink>
              <NavLink to="/search/users">{t('nav.people')}</NavLink>
              {user && (
                <NavLink to="/friends" icon={<HeartHandshake className="w-4 h-4 opacity-80" aria-hidden />}>
                  {t('nav.friends')}
                </NavLink>
              )}
            </nav>
          </div>

          {/* Actions + account (desktop) */}
          <div className="hidden shrink-0 md:flex items-center gap-2">
            <LanguageMenu />
            <ThemeAppearanceMenu />
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
            ) : user ? (
              <>
                <Button
                  asChild
                  className="h-9 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-900/30 hover:bg-violet-500 border-0 gap-1.5"
                >
                  <Link to="/create">
                    <Plus className="w-4 h-4" aria-hidden />
                    {t('nav.create')}
                  </Link>
                </Button>

                <div className="mx-1 h-7 w-px bg-border" aria-hidden />

                <Link
                  to="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  aria-label={
                    unreadNotifications > 0
                      ? t('a11y.notificationsWithCount', { count: unreadNotifications })
                      : t('a11y.notifications')
                  }
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-1 top-1 flex h-[18px] min-w-[1.125rem] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="ml-0.5 flex h-10 max-w-[11rem] items-center gap-1.5 rounded-xl border border-border bg-muted/30 py-1 pl-1 pr-2 text-left text-sm text-foreground outline-none transition-colors hover:border-border hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      aria-label={t('a11y.accountMenu')}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 ${headerAvatarPromoClass(
                          user.curated_highlight as 'frame' | 'featured' | null | undefined,
                        )}`}
                      >
                        <User className="h-4 w-4 text-white" aria-hidden />
                      </div>
                      <span className="truncate font-medium text-foreground">{accountLabel}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 border-border bg-popover p-1 text-popover-foreground shadow-xl"
                  >
                    <DropdownMenuLabel className="space-y-1 px-2 py-2 font-normal">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {user.name?.trim() || t('header.dolliMember')}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {user.curated_badge_label && (
                          <span
                            className="max-w-full truncate rounded-full border border-amber-500/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300/95"
                            title={user.curated_badge_label}
                          >
                            {user.curated_badge_label}
                          </span>
                        )}
                        {user.organization_verified && (
                          <span
                            className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400/90"
                            title={user.organization_display_name || t('header.org')}
                          >
                            {t('header.org')}
                          </span>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer rounded-lg focus:bg-muted focus:text-foreground"
                    >
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4 opacity-70" />
                        {t('nav.profile')}
                      </Link>
                    </DropdownMenuItem>
                    {user.has_password ? (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-lg focus:bg-muted focus:text-foreground"
                      >
                        <Link to="/profile#account-security" className="flex items-center gap-2">
                          <Lock className="h-4 w-4 opacity-70" aria-hidden />
                          {t('nav.changePassword')}
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    {isAdmin && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-lg focus:bg-muted focus:text-foreground"
                      >
                        <Link to="/admin" className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 opacity-70" />
                          {t('nav.analytics')}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg text-rose-600 focus:bg-rose-500/10 focus:text-rose-700 dark:text-rose-300 dark:focus:bg-rose-500/15 dark:focus:text-rose-200"
                      onClick={() => logout()}
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        {t('nav.signOut')}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  className="h-9 rounded-xl border-0 bg-gradient-to-r from-violet-600 to-purple-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-purple-500"
                >
                  <Link to="/login">{t('nav.signIn')}</Link>
                </Button>
                <Link
                  to="/register"
                  className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('nav.signUp')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted/50 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background/98 pb-4 md:hidden">
          <div className="flex justify-end gap-2 px-4 pt-3">
            <LanguageMenu />
            <ThemeAppearanceMenu />
          </div>
          <MobileSection title={t('nav.browse')}>
            <Link to="/explore" onClick={closeMobile} className={mobileRowClass()}>
              {t('nav.explore')}
            </Link>
            <Link to="/search/users" onClick={closeMobile} className={mobileRowClass()}>
              {t('nav.people')}
            </Link>
          </MobileSection>

          {user && (
            <>
              <MobileSection title={t('nav.social')}>
                <Link to="/friends" onClick={closeMobile} className={mobileRowClass()}>
                  {t('nav.friends')}
                </Link>
              </MobileSection>
              <MobileSection title={t('nav.actions')}>
                <Link to="/create" onClick={closeMobile} className={mobileRowClass(true)}>
                  <span className="flex items-center gap-2 font-semibold">
                    <Plus className="h-4 w-4" />
                    {t('nav.createCampaign')}
                  </span>
                </Link>
                <Link to="/notifications" onClick={closeMobile} className={mobileRowClass()}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      {t('nav.notifications')}
                    </span>
                    {unreadNotifications > 0 && (
                      <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-bold text-white">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </span>
                </Link>
              </MobileSection>
              <MobileSection title={t('nav.account')}>
                <Link to="/profile" onClick={closeMobile} className={mobileRowClass()}>
                  {t('nav.profile')}
                </Link>
                {user.has_password ? (
                  <Link
                    to="/profile#account-security"
                    onClick={closeMobile}
                    className={mobileRowClass()}
                  >
                    {t('nav.changePassword')}
                  </Link>
                ) : null}
                {isAdmin && (
                  <Link to="/admin" onClick={closeMobile} className={mobileRowClass()}>
                    {t('nav.analytics')}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMobile();
                  }}
                  className={`${mobileRowClass()} text-rose-400 hover:text-rose-300`}
                >
                  {t('nav.signOut')}
                </button>
              </MobileSection>
            </>
          )}

          {!user && !loading && (
            <MobileSection title={t('nav.account')}>
              <Link to="/login" onClick={closeMobile} className={mobileRowClass(true)}>
                {t('nav.signIn')}
              </Link>
              <Link to="/register" onClick={closeMobile} className={mobileRowClass()}>
                {t('nav.createAccount')}
              </Link>
            </MobileSection>
          )}
        </div>
      )}
    </header>
  );
}

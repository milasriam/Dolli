import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
  Bell,
  HeartHandshake,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DolliLogoLink } from '@/components/DolliLogoLink';
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
      className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5"
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pt-1">
      <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function mobileRowClass(active?: boolean) {
  return `block w-full text-left px-4 py-3 rounded-lg transition-colors ${
    active
      ? 'bg-violet-600/20 text-violet-100 border border-violet-500/25'
      : 'text-white hover:bg-white/5'
  }`;
}

export default function Header() {
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
    user?.name?.trim() || (user?.email ? user.email.split('@')[0] : 'Account');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          {/* Logo + primary browse (desktop) */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <DolliLogoLink variant="header" />
            <nav className="hidden min-w-0 md:flex items-center gap-0.5" aria-label="Main">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/explore" icon={<Compass className="w-4 h-4 opacity-80" aria-hidden />}>
                Explore
              </NavLink>
              <NavLink to="/search/users">People</NavLink>
              {user && (
                <NavLink to="/friends" icon={<HeartHandshake className="w-4 h-4 opacity-80" aria-hidden />}>
                  Friends
                </NavLink>
              )}
            </nav>
          </div>

          {/* Actions + account (desktop) */}
          <div className="hidden shrink-0 md:flex items-center gap-2">
            {loading ? (
              <div className="h-9 w-24 rounded-xl bg-white/10 animate-pulse" />
            ) : user ? (
              <>
                <Button
                  asChild
                  className="h-9 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-900/30 hover:bg-violet-500 border-0 gap-1.5"
                >
                  <Link to="/create">
                    <Plus className="w-4 h-4" aria-hidden />
                    Create
                  </Link>
                </Button>

                <div className="mx-1 h-7 w-px bg-white/10" aria-hidden />

                <Link
                  to="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  aria-label={
                    unreadNotifications > 0
                      ? `Notifications, ${unreadNotifications} unread`
                      : 'Notifications'
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
                      className="ml-0.5 flex h-10 max-w-[11rem] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-1 pl-1 pr-2 text-left text-sm text-white outline-none transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      aria-label="Account menu"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 ${headerAvatarPromoClass(
                          user.curated_highlight as 'frame' | 'featured' | null | undefined,
                        )}`}
                      >
                        <User className="h-4 w-4 text-white" aria-hidden />
                      </div>
                      <span className="truncate font-medium text-slate-200">{accountLabel}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 border-white/10 bg-[#13131A] p-1 text-slate-100 shadow-xl"
                  >
                    <DropdownMenuLabel className="space-y-1 px-2 py-2 font-normal">
                      <span className="block truncate text-sm font-semibold text-white">
                        {user.name?.trim() || 'Dolli member'}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{user.email}</span>
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
                            title={user.organization_display_name || 'Verified organization'}
                          >
                            Org
                          </span>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer rounded-lg text-slate-200 focus:bg-white/10 focus:text-white"
                    >
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="h-4 w-4 opacity-70" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-lg text-slate-200 focus:bg-white/10 focus:text-white"
                      >
                        <Link to="/admin" className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 opacity-70" />
                          Analytics
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg text-rose-300 focus:bg-rose-500/15 focus:text-rose-200"
                      onClick={() => logout()}
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  className="h-9 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-purple-500 border-0"
                >
                  <Link to="/login">Sign in</Link>
                </Button>
                <Link
                  to="/register"
                  className="px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white hover:bg-white/5 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#0A0A0F]/98 pb-4 md:hidden">
          <MobileSection title="Browse">
            <Link to="/" onClick={closeMobile} className={mobileRowClass()}>
              Home
            </Link>
            <Link to="/explore" onClick={closeMobile} className={mobileRowClass()}>
              Explore
            </Link>
            <Link to="/search/users" onClick={closeMobile} className={mobileRowClass()}>
              People
            </Link>
          </MobileSection>

          {user && (
            <>
              <MobileSection title="Social">
                <Link to="/friends" onClick={closeMobile} className={mobileRowClass()}>
                  Friends
                </Link>
              </MobileSection>
              <MobileSection title="Actions">
                <Link to="/create" onClick={closeMobile} className={mobileRowClass(true)}>
                  <span className="flex items-center gap-2 font-semibold">
                    <Plus className="h-4 w-4" />
                    Create campaign
                  </span>
                </Link>
                <Link to="/notifications" onClick={closeMobile} className={mobileRowClass()}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-slate-400" />
                      Notifications
                    </span>
                    {unreadNotifications > 0 && (
                      <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-bold text-white">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </span>
                </Link>
              </MobileSection>
              <MobileSection title="Account">
                <Link to="/profile" onClick={closeMobile} className={mobileRowClass()}>
                  Profile
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={closeMobile} className={mobileRowClass()}>
                    Analytics
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
                  Sign out
                </button>
              </MobileSection>
            </>
          )}

          {!user && !loading && (
            <MobileSection title="Account">
              <Link to="/login" onClick={closeMobile} className={mobileRowClass(true)}>
                Sign in
              </Link>
              <Link to="/register" onClick={closeMobile} className={mobileRowClass()}>
                Create account
              </Link>
            </MobileSection>
          )}
        </div>
      )}
    </header>
  );
}

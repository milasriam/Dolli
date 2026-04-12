import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { PageHeader, PageHeaderIconFrame } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyFriends, type FriendBrief } from '@/lib/friends';
import { HeartHandshake, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Friends() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [items, setItems] = useState<FriendBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchMyFriends();
      if (cancelled) return;
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-24 text-center outline-none"
        >
          <HeartHandshake className="w-14 h-14 text-sky-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t('friends.guestTitle')}</h1>
          <p className="text-muted-foreground text-sm mb-6">{t('friends.guestBody')}</p>
          <button
            type="button"
            onClick={() => login()}
            className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3"
          >
            {t('nav.signIn')}
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-24 outline-none sm:px-6"
      >
        <PageHeader
          icon={
            <PageHeaderIconFrame className="border-sky-500/25 bg-sky-500/15">
              <HeartHandshake className="h-6 w-6 text-sky-300" aria-hidden />
            </PageHeaderIconFrame>
          }
          title={t('friends.title')}
          description={t('friends.description', { count: total })}
          auxiliary={
            <Link
              to="/search/users"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
            >
              <Search className="h-4 w-4" aria-hidden />
              {t('friends.findPeople')}
            </Link>
          }
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-muted-foreground font-medium mb-2">{t('friends.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('friends.emptyBody')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li
                key={row.user_id}
                className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{row.name?.trim() || t('friends.dolliMember')}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{t('friends.mutualFollow')}</p>
                </div>
                <Link
                  to={`/search/users?q=${encodeURIComponent(row.name?.trim() || row.user_id)}`}
                  className="text-xs font-semibold text-violet-300 hover:text-violet-200 shrink-0"
                >
                  {t('common.search')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

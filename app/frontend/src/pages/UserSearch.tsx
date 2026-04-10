import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import { PageHeader } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { useAuth } from '@/contexts/AuthContext';
import { searchUsers, type UserSearchItem } from '@/lib/userSearch';
import { fetchFollowStatus, fetchFriendStatus, setFollowing } from '@/lib/follows';
import { Button } from '@/components/ui/button';
import { Search, Building2, UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function UserSearch() {
  const { user, login } = useAuth();
  const [params, setParams] = useSearchParams();
  const qParam = (params.get('q') || '').trim();
  const [input, setInput] = useState(qParam);
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
  const [friendMap, setFriendMap] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setInput(qParam);
  }, [qParam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!qParam) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const items = await searchUsers(qParam, 30);
        if (cancelled) return;
        setResults(items);
        if (!user) {
          setFollowMap({});
          setFriendMap({});
          return;
        }
        const m: Record<string, boolean> = {};
        const fm: Record<string, boolean> = {};
        await Promise.all(
          items.map(async (it) => {
            if (it.user_id === user.id) return;
            const [st, fr] = await Promise.all([
              fetchFollowStatus(it.user_id),
              fetchFriendStatus(it.user_id),
            ]);
            m[it.user_id] = Boolean(st?.following);
            fm[it.user_id] = Boolean(fr?.friends);
          }),
        );
        if (!cancelled) {
          setFollowMap(m);
          setFriendMap(fm);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qParam, user?.id]);

  const submit = () => {
    const t = input.trim();
    if (!t) {
      setParams({});
      return;
    }
    setParams({ q: t });
  };

  const toggleFollow = async (row: UserSearchItem) => {
    if (!user) {
      login();
      return;
    }
    if (row.user_id === user.id) return;
    setBusyId(row.user_id);
    try {
      const cur = followMap[row.user_id] ?? false;
      await setFollowing(row.user_id, !cur);
      setFollowMap((prev) => ({ ...prev, [row.user_id]: !cur }));
      const fr = await fetchFriendStatus(row.user_id);
      setFriendMap((prev) => ({ ...prev, [row.user_id]: Boolean(fr?.friends) }));
      toast.success(!cur ? 'Subscribed — their fundraisers & milestones will surface for you.' : 'Unfollowed.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update follow');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <Header />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-24 sm:px-6">
        <PageHeader
          title="Find people & organizations"
          description="Search by name, public profile title, or organization. Then follow to tailor your feeds and notifications."
        />

        <form
          className="flex gap-2 mb-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Name, org, or email fragment…"
              className="w-full pl-10 pr-3 py-3 rounded-xl bg-[#13131A] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/40"
              aria-label="Search users"
            />
          </div>
          <Button type="submit" className="rounded-xl bg-violet-600 hover:bg-violet-500 px-6">
            Search
          </Button>
        </form>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : !qParam ? (
          <p className="text-slate-500 text-sm">Type a query and press Search.</p>
        ) : results.length === 0 ? (
          <p className="text-slate-400 text-sm">No matches for “{qParam}”.</p>
        ) : (
          <ul className="space-y-2">
            {results.map((row) => (
              <li
                key={row.user_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#13131A] px-4 py-3"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/25 to-pink-500/15 border border-white/10 flex items-center justify-center shrink-0">
                    {row.is_verified_organization ? (
                      <Building2 className="w-5 h-5 text-emerald-300" />
                    ) : (
                      <span className="text-sm font-bold text-violet-200">
                        {(row.display_name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <p className="font-semibold text-white truncate">{row.display_name}</p>
                      {friendMap[row.user_id] && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-sky-300 border border-sky-500/35 rounded-full px-2 py-0.5">
                          Friends
                        </span>
                      )}
                    </div>
                    {row.subtitle && <p className="text-xs text-slate-500 truncate">{row.subtitle}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {user && row.user_id !== user.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant={followMap[row.user_id] ? 'outline' : 'default'}
                      disabled={busyId === row.user_id}
                      onClick={() => void toggleFollow(row)}
                      className={
                        followMap[row.user_id]
                          ? 'border-white/20 bg-transparent text-white'
                          : 'bg-violet-600 hover:bg-violet-500 text-white border-0'
                      }
                    >
                      {followMap[row.user_id] ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-1" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" /> Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-600 mt-8">
          Tip: open someone’s fundraiser and use <strong className="text-slate-500">Follow</strong> on the organizer
          card to connect your feeds.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}

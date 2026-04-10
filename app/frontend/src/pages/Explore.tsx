import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { client, refreshWebSdkClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CAMPAIGN_CATEGORIES } from '@/lib/campaignCategories';
import Header from '@/components/Header';
import { PageHeader } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Search, Users, Share2, Sparkles, Megaphone, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Campaign {
  id: number;
  title: string;
  description: string;
  category: string;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  share_count: number;
  image_url: string | null;
  status: string;
  urgency_level: string;
  featured: boolean;
  is_nsfw?: boolean;
}

/** When browsing the “Network” tab — activity from people you follow. */
interface NetworkMeta {
  activity_type: 'donation' | 'share';
  actor_display_name?: string | null;
  donation_amount?: number | null;
  occurred_at?: string | null;
  /** For copy: “Someone you follow” vs “A friend”. */
  connection: 'following' | 'friends';
}

type ExploreCampaign = Campaign & { network?: NetworkMeta };

const PAGE_SIZE = 24;

/** Touch-friendly + visible keyboard focus (WCAG-style). */
const feedTabBtn =
  'min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10';

const feedSubBtn =
  'min-h-11 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9';

export default function Explore() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const categories = useMemo(
    () => [
      { value: 'all', label: t('category.all'), emoji: '🌍' },
      ...CAMPAIGN_CATEGORIES.map(({ value, emoji }) => ({
        value,
        label: t(`category.${value}`),
        emoji,
      })),
    ],
    [t],
  );

  const urgencyBadge = useMemo(
    () =>
      ({
        critical: { label: t('campaign.urgency.critical'), color: 'bg-red-500/20 text-red-400 border-red-500/30' },
        high: { label: t('campaign.urgency.high'), color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
        medium: { label: t('campaign.urgency.medium'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
        low: { label: t('campaign.urgency.low'), color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      }) as Record<string, { label: string; color: string }>,
    [t],
  );

  const sortOptions = useMemo(
    () => [
      { value: 'trending', label: t('explore.sortTrending') },
      { value: 'newest', label: t('explore.sortNewest') },
      { value: 'almost-funded', label: t('explore.sortAlmostFunded') },
    ],
    [t],
  );
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<ExploreCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');
  const [skip, setSkip] = useState(0);
  const [feedScope, setFeedScope] = useState<'all' | 'creators' | 'network' | 'friends'>('all');
  const [creatorsFriendsOnly, setCreatorsFriendsOnly] = useState(false);
  const filterKey = `${debouncedSearch}\0${selectedCategory}\0${sortBy}\0${feedScope}\0${creatorsFriendsOnly}`;
  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!user && feedScope !== 'all') setFeedScope('all');
  }, [user, feedScope]);

  /** Deep links from Profile (e.g. /explore?view=creators&friends_only=1). */
  useEffect(() => {
    if (!user) return;
    const q = new URLSearchParams(location.search);
    const view = q.get('view');
    if (view === 'creators' || view === 'network' || view === 'friends') {
      setFeedScope(view);
    } else if (view === 'all') {
      setFeedScope('all');
    }
    if (q.get('friends_only') === '1') {
      setCreatorsFriendsOnly(true);
      if (!view) setFeedScope('creators');
    } else {
      setCreatorsFriendsOnly(false);
    }
  }, [user?.id, location.search]);

  /** Keep URL in sync so feeds are bookmarkable / shareable (matches Profile deep links). */
  useEffect(() => {
    if (!user) return;
    const p = new URLSearchParams();
    if (feedScope !== 'all') p.set('view', feedScope);
    if (creatorsFriendsOnly && feedScope === 'creators') p.set('friends_only', '1');
    const next = p.toString();
    if (next !== searchParams.toString()) setSearchParams(p, { replace: true });
  }, [user, feedScope, creatorsFriendsOnly, searchParams, setSearchParams]);

  useEffect(() => {
    refreshWebSdkClient();
    const filtersChanged = prevFilterKeyRef.current !== filterKey;
    if (filtersChanged) {
      prevFilterKeyRef.current = filterKey;
      if (skip !== 0) {
        setSkip(0);
        return;
      }
    }

    let cancelled = false;
    const isFirstPage = skip === 0;
    if (isFirstPage) {
      setLoading(true);
      setLoadError(false);
    } else setLoadingMore(true);
    (async () => {
      try {
        if ((feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends') && !user) {
          if (cancelled) return;
          setTotal(0);
          setCampaigns([]);
          return;
        }

        let items: ExploreCampaign[] = [];
        let totalCount = 0;

        if (feedScope === 'creators' && user) {
          const params = new URLSearchParams();
          params.set('limit', String(PAGE_SIZE));
          params.set('skip', String(skip));
          if (creatorsFriendsOnly) params.set('friends_only', 'true');
          const response = await client.apiCall.invoke({
            url: `/api/v1/entities/campaigns/following?${params.toString()}`,
            method: 'GET',
            data: {},
          });
          if (cancelled) return;
          items = (response?.data?.items || []) as ExploreCampaign[];
          totalCount = Number(response?.data?.total ?? 0);
        } else if ((feedScope === 'network' || feedScope === 'friends') && user) {
          const params = new URLSearchParams();
          params.set('limit', String(PAGE_SIZE));
          params.set('skip', String(skip));
          params.set('connection', feedScope === 'friends' ? 'friends' : 'following');
          const response = await client.apiCall.invoke({
            url: `/api/v1/entities/campaigns/network-activity?${params.toString()}`,
            method: 'GET',
            data: {},
          });
          if (cancelled) return;
          const raw = (response?.data?.items || []) as Array<{
            activity_type: string;
            actor_display_name?: string | null;
            donation_amount?: number | null;
            occurred_at?: string | null;
            campaign: Campaign;
          }>;
          const conn = feedScope === 'friends' ? 'friends' : 'following';
          items = raw.map((row) => ({
            ...row.campaign,
            network: {
              activity_type: row.activity_type === 'share' ? 'share' : 'donation',
              actor_display_name: row.actor_display_name,
              donation_amount: row.donation_amount ?? undefined,
              occurred_at: row.occurred_at,
              connection: conn,
            },
          }));
          totalCount = Number(response?.data?.total ?? 0);
        } else {
          const sortApi =
            sortBy === 'trending'
              ? '-share_count'
              : sortBy === 'newest'
                ? '-created_at'
                : 'progress_desc';
          const q: Record<string, string> = { status: 'active' };
          if (selectedCategory !== 'all') q.category = selectedCategory;
          const params = new URLSearchParams();
          params.set('query', JSON.stringify(q));
          params.set('sort', sortApi);
          params.set('limit', String(PAGE_SIZE));
          params.set('skip', String(skip));
          if (debouncedSearch) params.set('search', debouncedSearch);

          const response = await client.apiCall.invoke({
            url: `/api/v1/entities/campaigns?${params.toString()}`,
            method: 'GET',
            data: {},
          });
          if (cancelled) return;
          items = (response?.data?.items || []) as ExploreCampaign[];
          totalCount = Number(response?.data?.total ?? 0);
        }
        setTotal(Number.isFinite(totalCount) ? totalCount : 0);
        setCampaigns((prev) => (isFirstPage ? items : [...prev, ...items]));
      } catch (err) {
        console.error('Failed to load campaigns:', err);
        if (!cancelled && isFirstPage) {
          setCampaigns([]);
          setTotal(0);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.nsfw_filter_enabled, filterKey, skip, retryTick, feedScope]);

  const hasMore = skip + campaigns.length < total;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-24 outline-none sm:px-6 lg:px-8"
      >
        <PageHeader
          size="lg"
          titleRowAlign="end"
          title={t('explore.title')}
          description={t('explore.description')}
          actions={
            <Link
              to="/search/users"
              className="whitespace-nowrap text-sm font-semibold text-violet-700 transition-colors hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
            >
              {t('explore.findPeopleLink')}
            </Link>
          }
        >
          {user ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={feedScope === 'all'}
                  onClick={() => setFeedScope('all')}
                  className={`${feedTabBtn} ${
                    feedScope === 'all'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-900 dark:text-violet-200'
                      : 'border-border bg-card text-muted-foreground hover:border-muted'
                  }`}
                >
                  {t('explore.everyone')}
                </button>
                <button
                  type="button"
                  aria-pressed={feedScope === 'creators'}
                  onClick={() => setFeedScope('creators')}
                  className={`flex items-center gap-2 ${feedTabBtn} ${
                    feedScope === 'creators'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-900 dark:text-violet-200'
                      : 'border-border bg-card text-muted-foreground hover:border-muted'
                  }`}
                >
                  <Megaphone className="h-4 w-4" />
                  {t('explore.theirFundraisers')}
                </button>
                <button
                  type="button"
                  aria-pressed={feedScope === 'network'}
                  onClick={() => setFeedScope('network')}
                  className={`flex items-center gap-2 ${feedTabBtn} ${
                    feedScope === 'network'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-900 dark:text-violet-200'
                      : 'border-border bg-card text-muted-foreground hover:border-muted'
                  }`}
                >
                  <Share2 className="h-4 w-4" />
                  {t('explore.networkActivity')}
                </button>
                <button
                  type="button"
                  aria-pressed={feedScope === 'friends'}
                  onClick={() => setFeedScope('friends')}
                  className={`flex items-center gap-2 ${feedTabBtn} ${
                    feedScope === 'friends'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-900 dark:text-violet-200'
                      : 'border-border bg-card text-muted-foreground hover:border-muted'
                  }`}
                >
                  <HeartHandshake className="h-4 w-4" />
                  {t('nav.friends')}
                </button>
              </div>
              {feedScope === 'creators' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!creatorsFriendsOnly}
                    onClick={() => setCreatorsFriendsOnly(false)}
                    className={`${feedSubBtn} ${
                      !creatorsFriendsOnly
                        ? 'border-border bg-muted text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('explore.allFollowing')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={creatorsFriendsOnly}
                    onClick={() => setCreatorsFriendsOnly(true)}
                    className={`flex items-center gap-1.5 ${feedSubBtn} ${
                      creatorsFriendsOnly
                        ? 'border-sky-500/30 bg-sky-500/15 text-sky-200'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <HeartHandshake className="h-3.5 w-3.5" />
                    {t('explore.friendsOnly')}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </PageHeader>

        {/* Search & Filters */}
        <div
          className={`space-y-4 mb-8 ${
            feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends'
              ? 'opacity-60 pointer-events-none'
              : ''
          }`}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={t('explore.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('explore.searchAria')}
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-xl text-foreground placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                aria-pressed={selectedCategory === cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedCategory === cat.value
                    ? 'border border-violet-500/30 bg-violet-500/20 text-violet-800 dark:text-violet-300'
                    : 'border border-border bg-card text-muted-foreground hover:border-muted'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {sortOptions.map((sort) => (
              <button
                key={sort.value}
                type="button"
                aria-pressed={sortBy === sort.value}
                onClick={() => setSortBy(sort.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  sortBy === sort.value
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loadError && !loading && skip === 0 ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 px-6 py-14 text-center">
            <p className="text-lg font-semibold text-foreground mb-2">{t('explore.loadErrorTitle')}</p>
            <p className="mb-6 text-sm text-muted-foreground">{t('explore.loadErrorHint')}</p>
            <Button
              type="button"
              onClick={() => setRetryTick((n) => n + 1)}
              className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white border-0"
            >
              {t('explore.tryAgain')}
            </Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-2xl border border-border h-80 animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
            <div className="text-center py-20">
            <div className="text-5xl mb-4">
              {feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends' ? '👋' : '🔍'}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {!user && (feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends')
                ? t('explore.empty.signInTitle')
                : feedScope === 'creators'
                  ? creatorsFriendsOnly
                    ? t('explore.empty.creatorsFriends')
                    : t('explore.empty.creatorsFollowing')
                  : feedScope === 'network'
                    ? t('explore.empty.network')
                    : feedScope === 'friends'
                      ? t('explore.empty.friends')
                      : t('explore.empty.none')}
            </h3>
            <p className="mx-auto max-w-md text-muted-foreground">
              {!user && (feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends')
                ? t('explore.empty.signInHint')
                : feedScope === 'creators'
                  ? creatorsFriendsOnly
                    ? t('explore.empty.creatorsFriendsHint')
                    : t('explore.empty.creatorsFollowingHint')
                  : feedScope === 'network'
                    ? t('explore.empty.networkHint')
                    : feedScope === 'friends'
                      ? t('explore.empty.friendsHint')
                      : t('explore.empty.noneHint')}
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const progress = Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100);
              const urgency = urgencyBadge[campaign.urgency_level] || urgencyBadge.medium;
              const rowKey = campaign.network?.occurred_at
                ? `${campaign.id}-${campaign.network.occurred_at}`
                : String(campaign.id);
              const connection = campaign.network?.connection ?? 'following';
              const actorFallback =
                connection === 'friends' ? t('explore.actorFriend') : t('explore.actorFollowing');

              return (
                <Link
                  key={rowKey}
                  to={`/campaign/${campaign.id}`}
                  className="group block bg-card rounded-2xl border border-border overflow-hidden hover:border-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-48 overflow-hidden bg-muted">
                    {campaign.image_url ? (
                    <img
                      src={campaign.image_url}
                      alt={campaign.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                        {t('explore.noCover')}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${urgency.color}`}>
                        {urgency.label}
                      </span>
                      {campaign.is_nsfw && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-500/15 text-rose-300 border-rose-500/30">
                          {t('explore.sensitive')}
                        </span>
                      )}
                    </div>
                    {campaign.featured && (
                      <div className="absolute top-3 right-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> {t('explore.featured')}
                        </span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute bottom-3 right-3">
                      <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                        {t('explore.fromOneDollar')}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    {campaign.network && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90 mb-2">
                        {campaign.network.activity_type === 'donation'
                          ? t('explore.activityDonation', {
                              name: campaign.network.actor_display_name || actorFallback,
                            })
                          : t('explore.activityShare', {
                              name: campaign.network.actor_display_name || actorFallback,
                            })}
                        {campaign.network.activity_type === 'donation' &&
                        campaign.network.donation_amount != null ? (
                          <span className="font-medium text-muted-foreground normal-case">
                            {' '}
                            · ${Number(campaign.network.donation_amount).toLocaleString()}
                          </span>
                        ) : null}
                      </p>
                    )}
                    <h3 className="mb-2 line-clamp-1 text-lg font-bold text-foreground transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300">
                      {campaign.title}
                    </h3>
                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-bold text-emerald-400">${campaign.raised_amount.toLocaleString()}</span>
                        <span className="text-muted-foreground">
                          {t('explore.ofGoal', { goal: campaign.goal_amount.toLocaleString() })}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" title="People who completed a paid gift">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {campaign.donor_count.toLocaleString()} {t('explore.chippedIn')}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" /> {campaign.share_count.toLocaleString()}
                      </span>
                      <span className="font-semibold text-violet-400">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-10">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => setSkip((s) => s + PAGE_SIZE)}
                className="rounded-xl border-border bg-muted/40 px-8 py-6 text-foreground hover:bg-muted/60"
              >
                {loadingMore ? t('explore.loading') : t('explore.loadMore')}
              </Button>
            </div>
          )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
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

const categories = [
  { value: 'all', label: 'All', emoji: '🌍' },
  ...CAMPAIGN_CATEGORIES.map(({ value, label, emoji }) => ({ value, label, emoji })),
];

const urgencyBadge: Record<string, { label: string; color: string }> = {
  critical: { label: '🔥 Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: '⚡ Urgent', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  medium: { label: '📢 Active', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  low: { label: '🌱 Growing', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const PAGE_SIZE = 24;

export default function Explore() {
  const { user } = useAuth();
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
        let t = 0;

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
          t = Number(response?.data?.total ?? 0);
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
          t = Number(response?.data?.total ?? 0);
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
          t = Number(response?.data?.total ?? 0);
        }
        setTotal(Number.isFinite(t) ? t : 0);
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
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <Header />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <PageHeader
          size="lg"
          titleRowAlign="end"
          title="Explore Campaigns"
          description="Find causes you care about and make an impact with $1"
          actions={
            <Link
              to="/search/users"
              className="whitespace-nowrap text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
            >
              Find people &amp; orgs →
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
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    feedScope === 'all'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-200'
                      : 'border-white/10 bg-[#13131A] text-slate-400 hover:border-white/20'
                  }`}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  aria-pressed={feedScope === 'creators'}
                  onClick={() => setFeedScope('creators')}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    feedScope === 'creators'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-200'
                      : 'border-white/10 bg-[#13131A] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <Megaphone className="h-4 w-4" />
                  Their fundraisers
                </button>
                <button
                  type="button"
                  aria-pressed={feedScope === 'network'}
                  onClick={() => setFeedScope('network')}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    feedScope === 'network'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-200'
                      : 'border-white/10 bg-[#13131A] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <Share2 className="h-4 w-4" />
                  Network activity
                </button>
                <button
                  type="button"
                  aria-pressed={feedScope === 'friends'}
                  onClick={() => setFeedScope('friends')}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                    feedScope === 'friends'
                      ? 'border-violet-500/35 bg-violet-500/20 text-violet-200'
                      : 'border-white/10 bg-[#13131A] text-slate-400 hover:border-white/20'
                  }`}
                >
                  <HeartHandshake className="h-4 w-4" />
                  Friends
                </button>
              </div>
              {feedScope === 'creators' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!creatorsFriendsOnly}
                    onClick={() => setCreatorsFriendsOnly(false)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      !creatorsFriendsOnly
                        ? 'border-white/15 bg-white/10 text-white'
                        : 'border-white/10 bg-[#13131A] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    All following
                  </button>
                  <button
                    type="button"
                    aria-pressed={creatorsFriendsOnly}
                    onClick={() => setCreatorsFriendsOnly(true)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      creatorsFriendsOnly
                        ? 'border-sky-500/30 bg-sky-500/15 text-sky-200'
                        : 'border-white/10 bg-[#13131A] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <HeartHandshake className="h-3.5 w-3.5" />
                    Friends only
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="search"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search campaigns"
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3.5 bg-[#13131A] border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
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
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'bg-[#13131A] text-slate-400 border border-white/5 hover:border-white/10'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {[
              { value: 'trending', label: '🔥 Trending' },
              { value: 'newest', label: '✨ Newest' },
              { value: 'almost-funded', label: '🎯 Almost Funded' },
            ].map((sort) => (
              <button
                key={sort.value}
                type="button"
                aria-pressed={sortBy === sort.value}
                onClick={() => setSortBy(sort.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortBy === sort.value
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
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
            <p className="text-lg font-semibold text-white mb-2">Couldn’t load campaigns</p>
            <p className="text-sm text-slate-400 mb-6">Check your connection and try again.</p>
            <Button
              type="button"
              onClick={() => setRetryTick((n) => n + 1)}
              className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white border-0"
            >
              Try again
            </Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#13131A] rounded-2xl border border-white/5 h-80 animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
            <div className="text-center py-20">
            <div className="text-5xl mb-4">
              {feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends' ? '👋' : '🔍'}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {!user && (feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends')
                ? 'Sign in for this feed'
                : feedScope === 'creators'
                  ? creatorsFriendsOnly
                    ? 'No fundraisers from friends yet'
                    : 'No fundraisers from people you follow'
                  : feedScope === 'network'
                    ? 'Nothing in your network feed yet'
                    : feedScope === 'friends'
                      ? 'Nothing from friends yet'
                      : 'No campaigns found'}
            </h3>
            <p className="text-slate-400 max-w-md mx-auto">
              {!user && (feedScope === 'creators' || feedScope === 'network' || feedScope === 'friends')
                ? 'Log in to see fundraisers and activity from people you follow.'
                : feedScope === 'creators'
                  ? creatorsFriendsOnly
                    ? 'Mutual follows only — when a friend has a live fundraiser, it shows here.'
                    : 'Follow organizers on campaign pages — their live fundraisers show up here.'
                  : feedScope === 'network'
                    ? 'When people you follow donate (paid gift) or create a share link for a campaign, it appears here.'
                    : feedScope === 'friends'
                      ? 'When friends (mutual follows) donate or share a campaign, it appears here.'
                      : 'Try adjusting your search or filters'}
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
              const actorFallback = connection === 'friends' ? 'A friend' : 'Someone you follow';

              return (
                <Link
                  key={rowKey}
                  to={`/campaign/${campaign.id}`}
                  className="group block bg-[#13131A] rounded-2xl border border-white/5 overflow-hidden hover:border-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-48 overflow-hidden bg-[#1A1A25]">
                    {campaign.image_url ? (
                    <img
                      src={campaign.image_url}
                      alt={campaign.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
                        No cover image
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#13131A] via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${urgency.color}`}>
                        {urgency.label}
                      </span>
                      {campaign.is_nsfw && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-500/15 text-rose-300 border-rose-500/30">
                          Sensitive
                        </span>
                      )}
                    </div>
                    {campaign.featured && (
                      <div className="absolute top-3 right-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Featured
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {campaign.network && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/90 mb-2">
                        {campaign.network.activity_type === 'donation'
                          ? `${campaign.network.actor_display_name || actorFallback} donated`
                          : `${campaign.network.actor_display_name || actorFallback} shared`}
                        {campaign.network.activity_type === 'donation' &&
                        campaign.network.donation_amount != null ? (
                          <span className="text-slate-400 font-medium normal-case">
                            {' '}
                            · ${Number(campaign.network.donation_amount).toLocaleString()}
                          </span>
                        ) : null}
                      </p>
                    )}
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-violet-300 transition-colors line-clamp-1">
                      {campaign.title}
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">{campaign.description}</p>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-bold text-emerald-400">${campaign.raised_amount.toLocaleString()}</span>
                        <span className="text-slate-500">of ${campaign.goal_amount.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {campaign.donor_count.toLocaleString()}
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
                className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 px-8 py-6"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
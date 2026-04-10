import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';
import {
  BarChart3, TrendingUp, Users, Share2, DollarSign,
  ArrowUpRight, ArrowDownRight, Target, Zap, User, ShieldAlert, MousePointerClick, ListChecks, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CampaignStats {
  total_campaigns: number;
  total_raised: number;
  total_donors: number;
  total_shares: number;
  avg_completion: number;
}

interface ReferralFunnel {
  total_shares: number;
  total_clicks: number;
  total_signups: number;
  total_donations: number;
  click_rate: number;
  signup_rate: number;
  donation_rate: number;
  viral_coefficient: number;
}

interface PlatformMetric {
  platform: string;
  shares: number;
  clicks: number;
  donations: number;
  conversion_rate: number;
}

interface ModerationCampaignRow {
  id: number;
  user_id: string;
  title: string;
  status: string | null;
  category: string | null;
  is_nsfw: boolean;
  created_at: string | null;
}

interface ProductEventSummary {
  since_iso: string;
  days: number;
  total: number;
  by_event: { event: string; count: number }[];
}

interface PilotCreatorsPayload {
  env_emails: string[];
  database_emails: string[];
  effective_emails: string[];
}

type CuratedHighlight = 'none' | 'frame' | 'featured';

interface CuratedBadgeRow {
  email: string;
  label: string;
  slug: string;
  highlight: CuratedHighlight;
}

interface CuratedBadgesPayload {
  items: CuratedBadgeRow[];
}

const platformIcons: Record<string, string> = {
  tiktok: '📱',
  instagram: '📸',
  twitter: '🐦',
  other: '🔗',
  copy: '📋',
};

export default function AdminDashboard() {
  const { user, login, loading: authLoading, isAdmin, refetch } = useAuth();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [funnel, setFunnel] = useState<ReferralFunnel | null>(null);
  const [platforms, setPlatforms] = useState<PlatformMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [nsfwRows, setNsfwRows] = useState<ModerationCampaignRow[]>([]);
  const [nsfwTotal, setNsfwTotal] = useState(0);
  const [nsfwLoading, setNsfwLoading] = useState(false);
  const [productEvents, setProductEvents] = useState<ProductEventSummary | null>(null);
  const [pilotPayload, setPilotPayload] = useState<PilotCreatorsPayload | null>(null);
  const [pilotText, setPilotText] = useState('');
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotSaving, setPilotSaving] = useState(false);
  const [curatedRows, setCuratedRows] = useState<CuratedBadgeRow[]>([]);
  const [curatedLoading, setCuratedLoading] = useState(false);
  const [curatedSaving, setCuratedSaving] = useState(false);

  useEffect(() => {
    if (user) {
      void loadAnalytics();
      if (isAdmin) {
        void loadNsfwQueue();
        void loadProductEvents();
        void loadPilotCreators();
        void loadCuratedBadges();
      }
    } else {
      setLoading(false);
    }
  }, [user, isAdmin]);

  const loadAnalytics = async () => {
    try {
      const [statsRes, funnelRes, platformsRes] = await Promise.all([
        client.apiCall.invoke({ url: '/api/v1/analytics/campaign-stats', method: 'GET', data: {} }),
        client.apiCall.invoke({ url: '/api/v1/analytics/referral-funnel', method: 'GET', data: {} }),
        client.apiCall.invoke({ url: '/api/v1/analytics/platform-metrics', method: 'GET', data: {} }),
      ]);
      setStats(statsRes.data);
      setFunnel(funnelRes.data);
      setPlatforms(platformsRes.data || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProductEvents = async () => {
    if (!isAdmin) return;
    try {
      const res = await client.apiCall.invoke({
        url: '/api/v1/admin/analytics/product-events-summary?days=7',
        method: 'GET',
        data: {},
      });
      setProductEvents(res.data as ProductEventSummary);
    } catch (err) {
      console.error('Failed to load product events summary:', err);
      setProductEvents(null);
    }
  };

  const loadPilotCreators = async () => {
    if (!isAdmin) return;
    const token = authApi.getStoredToken();
    if (!token) return;
    setPilotLoading(true);
    try {
      const res = await fetch(`${getAPIBaseURL()}/api/v1/admin/pilot-campaign-creators`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as PilotCreatorsPayload;
      setPilotPayload(d);
      setPilotText((d.database_emails || []).join('\n'));
    } catch (err) {
      console.error('Failed to load pilot campaign creators:', err);
      setPilotPayload(null);
      toast.error('Could not load pilot creator list');
    } finally {
      setPilotLoading(false);
    }
  };

  const savePilotCreators = async () => {
    if (!isAdmin) return;
    const token = authApi.getStoredToken();
    if (!token) return;
    const emails = pilotText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setPilotSaving(true);
    try {
      const res = await fetch(`${getAPIBaseURL()}/api/v1/admin/pilot-campaign-creators`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      });
      if (!res.ok) {
        let detail = await res.text();
        try {
          const j = JSON.parse(detail) as { detail?: string };
          if (j.detail) detail = j.detail;
        } catch {
          /* keep raw */
        }
        throw new Error(detail);
      }
      const d = (await res.json()) as PilotCreatorsPayload;
      setPilotPayload(d);
      setPilotText((d.database_emails || []).join('\n'));
      toast.success('Pilot creator list saved');
    } catch (err) {
      console.error('Failed to save pilot campaign creators:', err);
      toast.error(err instanceof Error ? err.message : 'Save failed — check emails are valid');
    } finally {
      setPilotSaving(false);
    }
  };

  const loadCuratedBadges = async () => {
    if (!isAdmin) return;
    const token = authApi.getStoredToken();
    if (!token) return;
    setCuratedLoading(true);
    try {
      const res = await fetch(`${getAPIBaseURL()}/api/v1/admin/curated-user-badges`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as CuratedBadgesPayload;
      setCuratedRows(
        (d.items || []).map((it) => ({
          ...it,
          highlight: (['none', 'frame', 'featured'].includes(it.highlight as string)
            ? it.highlight
            : 'none') as CuratedHighlight,
        })),
      );
    } catch (err) {
      console.error('Failed to load curated badges:', err);
      setCuratedRows([]);
      toast.error('Could not load curated badges');
    } finally {
      setCuratedLoading(false);
    }
  };

  const saveCuratedBadges = async () => {
    if (!isAdmin) return;
    const token = authApi.getStoredToken();
    if (!token) return;
    const items = curatedRows
      .map((r) => ({
        email: r.email.trim(),
        label: r.label.trim(),
        slug: r.slug.trim(),
        highlight: r.highlight,
      }))
      .filter((r) => r.email && r.label);
    setCuratedSaving(true);
    try {
      const res = await fetch(`${getAPIBaseURL()}/api/v1/admin/curated-user-badges`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        let detail = await res.text();
        try {
          const j = JSON.parse(detail) as { detail?: string };
          if (j.detail) detail = j.detail;
        } catch {
          /* keep raw */
        }
        throw new Error(detail);
      }
      const d = (await res.json()) as CuratedBadgesPayload;
      setCuratedRows(
        (d.items || []).map((it) => ({
          ...it,
          highlight: (['none', 'frame', 'featured'].includes(it.highlight as string)
            ? it.highlight
            : 'none') as CuratedHighlight,
        })),
      );
      toast.success('Curated badges saved');
      void refetch();
    } catch (err) {
      console.error('Failed to save curated badges:', err);
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCuratedSaving(false);
    }
  };

  const loadNsfwQueue = async () => {
    setNsfwLoading(true);
    try {
      const res = await client.apiCall.invoke({
        url: '/api/v1/admin/moderation/nsfw-campaigns?skip=0&limit=40',
        method: 'GET',
        data: {},
      });
      setNsfwRows((res.data?.items || []) as ModerationCampaignRow[]);
      setNsfwTotal(Number(res.data?.total ?? 0));
    } catch (err) {
      console.error('Failed to load NSFW moderation queue:', err);
      setNsfwRows([]);
      setNsfwTotal(0);
    } finally {
      setNsfwLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Sign in to view analytics</h2>
          <p className="text-slate-400 mb-6">Access the admin dashboard to track platform performance.</p>
          <Button
            onClick={login}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-6 rounded-2xl shadow-2xl shadow-violet-500/25 border-0"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <Header />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-violet-400" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-400">Platform performance & referral analytics</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Raised', value: `$${(stats?.total_raised || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Active Campaigns', value: stats?.total_campaigns || 0, icon: Target, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { label: 'Total Donors', value: (stats?.total_donors || 0).toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Total Shares', value: (stats?.total_shares || 0).toLocaleString(), icon: Share2, color: 'text-pink-400', bg: 'bg-pink-500/10' },
            { label: 'Avg Completion', value: `${Math.round(stats?.avg_completion || 0)}%`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#13131A] rounded-xl border border-white/5 p-5">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {isAdmin && productEvents && (
          <div className="mb-8 bg-[#13131A] rounded-2xl border border-white/5 p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-cyan-400" />
              Web product events
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Last {productEvents.days} days · {productEvents.total.toLocaleString()} total · since{' '}
              {new Date(productEvents.since_iso).toLocaleString()}
            </p>
            {productEvents.by_event.length === 0 ? (
              <p className="text-sm text-slate-500">No events recorded yet. Ensure Alembic migration for client events is applied.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {productEvents.by_event.map((row) => (
                  <div key={row.event} className="rounded-xl bg-white/5 border border-white/5 px-3 py-3">
                    <div className="text-xl font-bold text-white">{row.count.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5" title={row.event}>
                      {row.event}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Referral Funnel */}
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Referral Funnel
            </h3>

            <div className="space-y-4">
              {[
                { label: 'Shares', value: funnel?.total_shares || 0, rate: null, color: 'bg-violet-500', width: '100%' },
                { label: 'Clicks', value: funnel?.total_clicks || 0, rate: funnel?.click_rate, color: 'bg-blue-500', width: `${Math.min(funnel?.click_rate || 0, 100)}%` },
                { label: 'Signups', value: funnel?.total_signups || 0, rate: funnel?.signup_rate, color: 'bg-amber-500', width: `${Math.min(funnel?.signup_rate || 0, 100)}%` },
                { label: 'Donations', value: funnel?.total_donations || 0, rate: funnel?.donation_rate, color: 'bg-emerald-500', width: `${Math.min(funnel?.donation_rate || 0, 100)}%` },
              ].map((step) => (
                <div key={step.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{step.label}</span>
                    <span className="text-white font-semibold">
                      {step.value.toLocaleString()}
                      {step.rate !== null && (
                        <span className="text-slate-500 ml-1">({step.rate}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${step.color} transition-all duration-1000`}
                      style={{ width: step.width }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Viral Coefficient (K-factor)</span>
                <span className={`text-2xl font-bold ${(funnel?.viral_coefficient || 0) >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {funnel?.viral_coefficient || 0}
                  {(funnel?.viral_coefficient || 0) >= 1 ? (
                    <ArrowUpRight className="w-5 h-5 inline ml-1 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 inline ml-1 text-amber-400" />
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {(funnel?.viral_coefficient || 0) >= 1
                  ? '🎉 Viral growth! Each donor brings more than 1 new donor.'
                  : 'Target: K > 1 for viral growth'}
              </p>
            </div>
          </div>

          {/* Platform Breakdown */}
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-400" />
              Platform Performance
            </h3>

            {platforms.length === 0 ? (
              <div className="text-center py-12">
                <Share2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No platform data yet</p>
                <p className="text-xs text-slate-500 mt-1">Share campaigns to see platform analytics</p>
              </div>
            ) : (
              <div className="space-y-4">
                {platforms.map((p) => (
                  <div key={p.platform} className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{platformIcons[p.platform] || '🔗'}</span>
                        <span className="font-semibold capitalize">{p.platform}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{p.conversion_rate}% CVR</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold">{p.shares}</div>
                        <div className="text-xs text-slate-500">Shares</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{p.clicks}</div>
                        <div className="text-xs text-slate-500">Clicks</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{p.donations}</div>
                        <div className="text-xs text-slate-500">Donations</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1 mb-3">
              Partner &amp; early access
            </h2>
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-emerald-400" />
                Pilot campaign creators
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pilotLoading || pilotSaving}
                  onClick={() => void loadPilotCreators()}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Refresh
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pilotLoading || pilotSaving}
                  onClick={() => void savePilotCreators()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                >
                  {pilotSaving ? 'Saving…' : 'Save list'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Accounts with these emails can <span className="text-slate-300">create campaigns</span> without a prior
              paid donation. Stored in the database; server env <code className="text-slate-400">PILOT_CAMPAIGN_CREATE_EMAILS</code>{' '}
              is merged in (remove from env when you want DB-only control).
            </p>
            {pilotPayload && pilotPayload.env_emails.length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                <span className="font-semibold text-amber-300">Also from env:</span>{' '}
                {pilotPayload.env_emails.join(', ')}
              </div>
            )}
            {pilotPayload && (
              <p className="text-[11px] text-slate-500 mb-2">
                Effective allowlist now: <span className="text-slate-300">{pilotPayload.effective_emails.length}</span>{' '}
                email(s)
              </p>
            )}
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
              placeholder={'one email per line or comma-separated\npilot@example.com'}
              value={pilotText}
              onChange={(e) => setPilotText(e.target.value)}
              disabled={pilotLoading}
              spellCheck={false}
            />
            {pilotLoading && !pilotPayload && (
              <p className="text-xs text-slate-500 mt-2">Loading…</p>
            )}
          </div>

          <div className="mt-6 bg-[#13131A] rounded-2xl border border-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Curated profile badges
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={curatedLoading || curatedSaving}
                  onClick={() => void loadCuratedBadges()}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={curatedLoading || curatedSaving}
                  onClick={() =>
                    setCuratedRows((rows) => [...rows, { email: '', label: '', slug: '', highlight: 'none' }])
                  }
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  Add row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={curatedLoading || curatedSaving}
                  onClick={() => void saveCuratedBadges()}
                  className="bg-amber-600 hover:bg-amber-500 text-white border-0"
                >
                  {curatedSaving ? 'Saving…' : 'Save badges'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Shown on their profile and in the header, and <span className="text-slate-400">publicly on their campaign
              pages</span> next to “Organizer”. <span className="text-slate-400">Visual tier</span> adds a contrast frame
              (and a stronger “featured” look reserved for future paid promotion). Keyed by login email; leave slug
              empty to auto-generate from the label.
            </p>
            <div className="space-y-3">
              {curatedRows.length === 0 && !curatedLoading ? (
                <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-white/10 rounded-xl">
                  No rows yet — use “Add row” or Refresh after migration.
                </p>
              ) : (
                curatedRows.map((row, idx) => (
                  <div
                    key={`badge-${idx}`}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-xl border border-white/5 bg-black/20 p-3"
                  >
                    <label className="sm:col-span-3 text-[11px] text-slate-500 uppercase tracking-wide block">
                      Email
                      <input
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                        value={row.email}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCuratedRows((rows) => rows.map((r, i) => (i === idx ? { ...r, email: v } : r)));
                        }}
                        placeholder="name@gmail.com"
                        spellCheck={false}
                      />
                    </label>
                    <label className="sm:col-span-3 text-[11px] text-slate-500 uppercase tracking-wide block">
                      Badge text
                      <input
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                        value={row.label}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCuratedRows((rows) => rows.map((r, i) => (i === idx ? { ...r, label: v } : r)));
                        }}
                        placeholder="Early partner"
                        maxLength={64}
                      />
                    </label>
                    <label className="sm:col-span-2 text-[11px] text-slate-500 uppercase tracking-wide block">
                      Slug (optional)
                      <input
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white font-mono"
                        value={row.slug}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCuratedRows((rows) => rows.map((r, i) => (i === idx ? { ...r, slug: v } : r)));
                        }}
                        placeholder="early_partner"
                        spellCheck={false}
                      />
                    </label>
                    <label className="sm:col-span-3 text-[11px] text-slate-500 uppercase tracking-wide block">
                      Visual tier
                      <select
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                        value={row.highlight}
                        onChange={(e) => {
                          const v = e.target.value as CuratedHighlight;
                          setCuratedRows((rows) => rows.map((r, i) => (i === idx ? { ...r, highlight: v } : r)));
                        }}
                      >
                        <option value="none">Standard (badge only)</option>
                        <option value="frame">Highlight frame</option>
                        <option value="featured">Featured (beta / future paid)</option>
                      </select>
                    </label>
                    <div className="sm:col-span-1 flex sm:justify-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        onClick={() => setCuratedRows((rows) => rows.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {curatedLoading && curatedRows.length === 0 ? (
              <p className="text-xs text-slate-500 mt-3">Loading…</p>
            ) : null}
          </div>
          </div>
        )}

        {isAdmin && (
          <div className="mt-10 bg-[#13131A] rounded-2xl border border-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                NSFW moderation queue
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={nsfwLoading}
                onClick={() => void loadNsfwQueue()}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                Refresh
              </Button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Campaigns flagged as sensitive ({nsfwTotal} total). Open each page to review copy and media before broad
              distribution.
            </p>
            {nsfwLoading && nsfwRows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">Loading…</div>
            ) : nsfwRows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No flagged campaigns right now.</div>
            ) : (
              <ul className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
                {nsfwRows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-black/20">
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{row.title || `Campaign #${row.id}`}</p>
                      <p className="text-[11px] text-slate-500">
                        #{row.id}
                        {row.status ? ` · ${row.status}` : ''}
                        {row.category ? ` · ${row.category}` : ''}
                      </p>
                    </div>
                    <Link
                      to={`/campaign/${row.id}`}
                      className="text-sm font-semibold text-violet-400 hover:text-violet-300 shrink-0"
                    >
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, fetchLoginOptions, type LoginOptions } from '@/lib/auth';
import { fetchEarlyDonorMilestone, type EarlyDonorMilestone } from '@/lib/earlyDonorMilestone';
import { fetchMyFriends, type FriendBrief } from '@/lib/friends';
import { fetchFollowStats, fetchMyFollowing, type FollowStats, type FollowingBrief } from '@/lib/follows';
import { profileHeroPromoClass } from '@/lib/curatedHighlight';
import Header from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';
import { OwnerCampaignControls } from '@/components/OwnerCampaignControls';
import { toast } from 'sonner';
import {
  Heart, Trophy, Flame, Share2, TrendingUp, User, HeartHandshake, UserPlus, Megaphone,
  Copy, CheckCircle2, Pencil, Check, X,
  Zap, Users, Gift, Sparkles, Lock, Facebook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const USE_MOCK_DATA = false;

const MOCK_USER = {
  id: 'mock-amir-001',
  email: 'amir@dolli.app',
  name: 'Amir',
  role: 'user',
};

const MOCK_DONATIONS = [
  { id: 1, campaign_id: 1, amount: 1, payment_status: 'paid', source_platform: 'tiktok', created_at: '2026-03-28T10:00:00Z' },
  { id: 2, campaign_id: 2, amount: 5, payment_status: 'paid', source_platform: 'instagram', created_at: '2026-03-27T14:30:00Z' },
  { id: 3, campaign_id: 3, amount: 1, payment_status: 'paid', source_platform: 'direct', created_at: '2026-03-26T09:15:00Z' },
  { id: 4, campaign_id: 1, amount: 10, payment_status: 'paid', source_platform: 'referral', created_at: '2026-03-25T18:00:00Z' },
  { id: 5, campaign_id: 4, amount: 5, payment_status: 'paid', source_platform: 'tiktok', created_at: '2026-03-24T12:00:00Z' },
  { id: 6, campaign_id: 2, amount: 25, payment_status: 'paid', source_platform: 'direct', created_at: '2026-03-23T08:00:00Z' },
];

const MOCK_BADGES = [
  { id: 1, name: 'First Dollar', description: 'Made your first donation', icon: '💰', category: 'giving', tier: 'bronze' },
  { id: 2, name: 'Generous Heart', description: 'Donated 5+ times', icon: '❤️', category: 'giving', tier: 'silver' },
  { id: 3, name: 'Impact Maker', description: 'Donated $25+', icon: '⭐', category: 'giving', tier: 'gold' },
  { id: 4, name: 'Streak Starter', description: '3-day donation streak', icon: '🔥', category: 'streak', tier: 'bronze' },
  { id: 5, name: 'Streak Master', description: '7-day donation streak', icon: '💎', category: 'streak', tier: 'platinum' },
  { id: 6, name: 'Social Spark', description: 'First referral donation', icon: '⚡', category: 'social', tier: 'bronze' },
  { id: 7, name: 'Referral Champion', description: '10+ referral donations', icon: '🏆', category: 'social', tier: 'gold' },
  { id: 8, name: 'Early Adopter', description: 'Joined during launch', icon: '🚀', category: 'special', tier: 'silver' },
];

const MOCK_REFERRALS = [
  { id: 1, campaign_id: 1, platform: 'tiktok', clicks: 142, signups: 8, donations_count: 12, donations_amount: 47, referral_token: 'amir-tk-001' },
  { id: 2, campaign_id: 2, platform: 'instagram', clicks: 89, signups: 5, donations_count: 6, donations_amount: 32, referral_token: 'amir-ig-001' },
];

const MOCK_CAMPAIGNS = [
  { id: 1, title: 'Plant 1,000 Trees', category: 'environment', goal_amount: 1000, raised_amount: 420, status: 'active' },
  { id: 2, title: 'Clean Water for All', category: 'health', goal_amount: 2000, raised_amount: 890, status: 'active' },
  { id: 3, title: 'Feed the Hungry', category: 'food', goal_amount: 500, raised_amount: 500, status: 'completed' },
];

interface Donation {
  id: number;
  campaign_id: number;
  amount: number;
  payment_status: string;
  source_platform: string;
  created_at: string;
}

interface Badge {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
}

interface Referral {
  id: number;
  campaign_id: number;
  platform: string;
  clicks: number;
  signups: number;
  donations_count: number;
  donations_amount: number;
  referral_token: string;
}

interface Campaign {
  id: number;
  user_id?: string;
  title: string;
  category: string;
  goal_amount: number;
  raised_amount: number;
  donor_count?: number;
  status: string;
}

const tierColors: Record<string, string> = {
  bronze: 'from-amber-700 to-amber-800 border-amber-600/30',
  silver: 'from-slate-400 to-slate-500 border-slate-400/30',
  gold: 'from-yellow-400 to-amber-500 border-yellow-400/30',
  platinum: 'from-violet-400 to-purple-500 border-violet-400/30',
};

const TIKTOK_ICON = (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.28 8.28 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.28z" />
  </svg>
);

const INSTAGRAM_ICON = (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

export default function Profile() {
  const { t } = useTranslation();
  const { user: authUser, loading: authLoading, refetch } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'badges' | 'referrals'>('activity');
  const [copied, setCopied] = useState(false);
  const [nsfwSaving, setNsfwSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [earlyDonor, setEarlyDonor] = useState<EarlyDonorMilestone | null>(null);
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);
  const [followingPeople, setFollowingPeople] = useState<FollowingBrief[]>([]);
  const [friendsPeople, setFriendsPeople] = useState<FriendBrief[]>([]);
  const [acctOpts, setAcctOpts] = useState<LoginOptions | null>(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [igDraft, setIgDraft] = useState('');
  const [igBusy, setIgBusy] = useState(false);

  const user = USE_MOCK_DATA ? MOCK_USER : authUser;
  const isLoading = USE_MOCK_DATA ? false : (authLoading || loading);

  useEffect(() => {
    void fetchLoginOptions().then(setAcctOpts);
  }, []);

  useEffect(() => {
    if (authUser?.instagram_handle !== undefined) {
      setIgDraft(authUser.instagram_handle || '');
    }
  }, [authUser?.instagram_handle, authUser?.id]);

  useEffect(() => {
    if (USE_MOCK_DATA) return;
    const u = new URLSearchParams(window.location.search);
    if (u.get('social_linked') !== '1') return;
    if (!authApi.getStoredToken()) return;
    window.history.replaceState({}, '', '/profile');
    void (async () => {
      await refetch();
      toast.success(t('profileAccount.socialLinkedToast'));
    })();
  }, [refetch, t]);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setDonations(MOCK_DONATIONS);
      setBadges(MOCK_BADGES);
      setReferrals(MOCK_REFERRALS);
      setCampaigns(MOCK_CAMPAIGNS);
      setFollowStats({ follower_count: 128, following_count: 42, mutual_friend_count: 9 });
      setFollowingPeople(
        ['River Org', 'Sam K.', 'Mira Chen', 'Demo Creator'].map((name, i) => ({
          user_id: `mock-${i}`,
          name,
        })),
      );
      setFriendsPeople([{ user_id: 'mock-f1', name: 'Alex' }, { user_id: 'mock-f2', name: 'Jordan' }]);
      setLoading(false);
      return;
    }
    if (user) {
      void loadEarlyDonor();
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadEarlyDonor = async () => {
    if (USE_MOCK_DATA) return;
    try {
      const m = await fetchEarlyDonorMilestone();
      setEarlyDonor(m);
    } catch {
      setEarlyDonor(null);
    }
  };

  const loadData = async () => {
    if (!user?.id) return;
    try {
      const [donationsRes, badgesRes, referralsRes, campaignsRes, friendsRes, statsRes, followingRes] =
        await Promise.all([
          client.entities.donations.query({ sort: '-created_at', limit: 50 }),
          client.entities.badges.query({ limit: 50 }),
          client.entities.referrals.query({ sort: '-created_at', limit: 50 }),
          client.entities.campaigns.query({
            query: { user_id: user.id },
            sort: '-created_at',
            limit: 50,
          }),
          fetchMyFriends(),
          fetchFollowStats(user.id),
          fetchMyFollowing(),
        ]);
      setDonations(donationsRes?.data?.items || []);
      setBadges(badgesRes?.data?.items || []);
      setReferrals(referralsRes?.data?.items || []);
      setCampaigns(campaignsRes?.data?.items || []);
      setFriendsPeople(friendsRes?.items ?? []);
      setFollowStats(
        statsRes ?? {
          follower_count: 0,
          following_count: followingRes?.total ?? followingRes?.items?.length ?? 0,
          mutual_friend_count: friendsRes?.total ?? friendsRes?.items?.length ?? 0,
        },
      );
      setFollowingPeople(followingRes?.items ?? []);
    } catch (err) {
      console.error('Failed to load profile data:', err);
      setFollowStats({ follower_count: 0, following_count: 0, mutual_friend_count: 0 });
      setFollowingPeople([]);
      setFriendsPeople([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferralLink = async () => {
    const refId = USE_MOCK_DATA ? 'amir' : (user?.id?.slice(0, 8) || 'dolli');
    const link = `${window.location.origin}/?ref=${refId}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareImpact = (platform: string) => {
    const refId = USE_MOCK_DATA ? 'amir' : (user?.id?.slice(0, 8) || 'dolli');
    const text = `I've donated $${totalDonated} and helped multiply $${totalReferralAmount} through referrals on Dolli! Join me 💜`;
    const url = `${window.location.origin}/?ref=${refId}`;
    if (platform === 'tiktok') {
      window.open(`https://www.tiktok.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'instagram') {
      navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success('Copied! Share it on Instagram Stories.');
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center pt-24 outline-none"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-24 text-center outline-none"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Sign in to see your impact</h2>
          <p className="text-muted-foreground mb-6">Track your donations, badges, and referral impact.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-6 rounded-2xl shadow-2xl shadow-violet-500/25 border-0">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-2xl border-border px-8 py-6 font-semibold text-foreground hover:bg-muted/60"
            >
              <Link to="/register">Create account</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const paidDonations = donations.filter((d) => d.payment_status === 'paid');
  const totalDonated = paidDonations.reduce((sum, d) => sum + d.amount, 0);
  const totalReferralDonations = referrals.reduce((sum, r) => sum + r.donations_count, 0);
  const totalReferralAmount = referrals.reduce((sum, r) => sum + r.donations_amount, 0);
  const totalClicks = referrals.reduce((sum, r) => sum + r.clicks, 0);
  const streak = paidDonations.length > 0 ? Math.min(paidDonations.length, 7) : 0;
  const impactMultiplied = totalDonated + totalReferralAmount;

  // Earned badges
  const earnedBadgeNames: string[] = [];
  if (paidDonations.length >= 1) earnedBadgeNames.push('First Dollar');
  if (paidDonations.length >= 5) earnedBadgeNames.push('Generous Heart');
  if (totalDonated >= 25) earnedBadgeNames.push('Impact Maker');
  if (streak >= 3) earnedBadgeNames.push('Streak Starter');
  if (streak >= 7) earnedBadgeNames.push('Streak Master');
  if (totalReferralDonations >= 1) earnedBadgeNames.push('Social Spark');
  if (totalReferralDonations >= 10) earnedBadgeNames.push('Referral Champion');
  earnedBadgeNames.push('Early Adopter');

  // Build activity feed
  type ActivityItem = { type: string; label: string; detail: string; date: string; iconType: string };
  const activityFeed: ActivityItem[] = [];
  paidDonations.forEach((d) => {
    activityFeed.push({
      type: 'donation',
      label: `Donated $${d.amount}`,
      detail: `Campaign #${d.campaign_id} via ${d.source_platform}`,
      date: d.created_at,
      iconType: 'donation',
    });
  });
  campaigns.forEach((c) => {
    activityFeed.push({
      type: 'campaign',
      label: `Created "${c.title}"`,
      detail: `$${c.raised_amount} raised of $${c.goal_amount}`,
      date: '',
      iconType: 'campaign',
    });
  });
  referrals.forEach((r) => {
    if (r.donations_count > 0) {
      activityFeed.push({
        type: 'referral',
        label: `${r.donations_count} referral donations`,
        detail: `$${r.donations_amount} via ${r.platform}`,
        date: '',
        iconType: 'referral',
      });
    }
  });

  const getActivityIcon = (iconType: string) => {
    switch (iconType) {
      case 'donation': return Heart;
      case 'campaign': return Sparkles;
      case 'referral': return Share2;
      default: return Zap;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-20 outline-none sm:px-6"
      >
        {/* Profile Header */}
        <div
          className={`bg-card rounded-2xl border border-border p-6 mb-6 relative overflow-hidden ${profileHeroPromoClass(
            authUser?.curated_highlight as 'frame' | 'featured' | null | undefined,
          )}`}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-4 mb-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/20 ring-offset-2 ring-offset-card">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {USE_MOCK_DATA ? (
                <>
                  <h1 className="text-xl font-bold">Amir</h1>
                  <p className="text-sm text-muted-foreground">Tap → Share → Multiply</p>
                </>
              ) : editingName ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Display name"
                    maxLength={120}
                    className="h-10 border-border bg-muted/60 text-foreground"
                    autoFocus
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={nameSaving}
                      onClick={async () => {
                        setNameSaving(true);
                        try {
                          const trimmed = nameDraft.trim();
                          await authApi.updateProfile({ name: trimmed });
                          await refetch();
                          setEditingName(false);
                          toast.success(trimmed ? 'Name updated' : 'Name cleared');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Could not save name');
                        } finally {
                          setNameSaving(false);
                        }
                      }}
                      className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                      aria-label="Save name"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={nameSaving}
                      onClick={() => {
                        setEditingName(false);
                        setNameDraft(user?.name || '');
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h1 className="text-xl font-bold truncate">
                      {user?.name?.trim() ? user.name : 'My Impact'}
                    </h1>
                    {authUser?.curated_badge_label && (
                      <span
                        className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-300 border border-amber-500/35 rounded-full px-2 py-0.5"
                        title={authUser.curated_badge_label}
                      >
                        {authUser.curated_badge_label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Tap → Share → Multiply</p>
                </>
              )}
            </div>
            {!USE_MOCK_DATA && !editingName && (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(user?.name || '');
                  setEditingName(true);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground"
                aria-label="Edit display name"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {followStats && (
          <section className="mb-6 space-y-5" aria-label="Your network on Dolli">
            <div className="rounded-2xl border border-border bg-card p-1">
              <div className="grid grid-cols-3 divide-x divide-border">
                <div
                  className="px-2 py-4 text-center"
                  title="Accounts that follow you on Dolli — they may see your public fundraisers in their feeds."
                >
                  <Users className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {followStats.follower_count.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Followers
                  </p>
                </div>
                <a
                  href="#people-you-follow"
                  className="block px-2 py-4 text-center transition-colors hover:bg-muted/50"
                  title="People and organizations you follow"
                >
                  <UserPlus className="mx-auto mb-1 h-4 w-4 text-violet-400" aria-hidden />
                  <p className="text-2xl font-bold tabular-nums text-violet-200">
                    {followStats.following_count.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Following
                  </p>
                </a>
                <Link
                  to="/friends"
                  className="block px-2 py-4 text-center transition-colors hover:bg-muted/50"
                  title="Mutual follows — you follow each other"
                >
                  <HeartHandshake className="mx-auto mb-1 h-4 w-4 text-sky-400" aria-hidden />
                  <p className="text-2xl font-bold tabular-nums text-sky-200">
                    {followStats.mutual_friend_count.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Friends</p>
                </Link>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Your feeds</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  to="/explore?view=creators"
                  className="group rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 to-card p-4 transition-all hover:border-violet-500/35"
                >
                  <Megaphone className="mb-2 h-5 w-5 text-violet-300" aria-hidden />
                  <p className="font-semibold text-foreground">Their fundraisers</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground group-hover:text-muted-foreground">
                    Live campaigns from organizers you follow.
                  </p>
                </Link>
                <Link
                  to="/explore?view=network"
                  className="group rounded-2xl border border-border bg-gradient-to-br from-pink-500/10 to-card p-4 transition-all hover:border-pink-500/35"
                >
                  <Share2 className="mb-2 h-5 w-5 text-pink-300" aria-hidden />
                  <p className="font-semibold text-foreground">Network activity</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground group-hover:text-muted-foreground">
                    Donations and shares from people you follow.
                  </p>
                </Link>
                <Link
                  to="/explore?view=friends"
                  className="group rounded-2xl border border-border bg-gradient-to-br from-sky-500/10 to-card p-4 transition-all hover:border-sky-500/35"
                >
                  <HeartHandshake className="mb-2 h-5 w-5 text-sky-300" aria-hidden />
                  <p className="font-semibold text-foreground">Friends only</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground group-hover:text-muted-foreground">
                    The same signals, filtered to mutual follows.
                  </p>
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <Link to="/explore?view=creators&friends_only=1" className="text-violet-400 hover:text-violet-300">
                  Friends’ fundraisers only →
                </Link>
                <Link to="/notifications" className="text-muted-foreground hover:text-muted-foreground">
                  Notification inbox →
                </Link>
              </div>
            </div>

            <div id="people-you-follow" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">People you follow</h2>
                <Link
                  to="/search/users"
                  className="text-xs font-semibold text-violet-400 hover:text-violet-300"
                >
                  Find more →
                </Link>
              </div>
              {followingPeople.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You’re not following anyone yet. Open a fundraiser and tap{' '}
                  <span className="text-muted-foreground">Follow</span> on the organizer card, or discover accounts in{' '}
                  <Link to="/search/users" className="text-violet-400 hover:text-violet-300">
                    People search
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {followingPeople.map((p) => (
                    <Link
                      key={p.user_id}
                      to={`/search/users?q=${encodeURIComponent(p.name?.trim() || p.user_id)}`}
                      className="shrink-0 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-900 dark:hover:text-white"
                    >
                      {p.name?.trim() || 'Member'}
                    </Link>
                  ))}
                </div>
              )}

              {friendsPeople.length > 0 ? (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-500/90">Friends</h3>
                    <Link to="/friends" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                      Open list →
                    </Link>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {friendsPeople.map((p) => (
                      <Link
                        key={p.user_id}
                        to={`/search/users?q=${encodeURIComponent(p.name?.trim() || p.user_id)}`}
                        className="shrink-0 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-100 transition-colors hover:border-sky-400/40 hover:bg-sky-500/15"
                      >
                        {p.name?.trim() || 'Friend'}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {!USE_MOCK_DATA && earlyDonor?.milestone != null && earlyDonor.rank != null && (
          <div className="mb-6 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-violet-600/10 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-amber-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80 mb-1">
                  Platform milestone
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                  Among the first {earlyDonor.milestone.toLocaleString()} donors on Dolli
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Your place by first completed gift:{' '}
                  <span className="font-semibold text-foreground">#{earlyDonor.rank}</span>
                  {earlyDonor.total_distinct_donors > 0 ? (
                    <>
                      {' '}
                      <span className="text-muted-foreground">
                        · {earlyDonor.total_distinct_donors.toLocaleString()} donor
                        {earlyDonor.total_distinct_donors === 1 ? '' : 's'} on the platform so far
                      </span>
                    </>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  Rankings use the time of each account’s first successful donation. Tiers unlock at 100, 1,000, and
                  10,000 — a permanent thank-you as the community grows.
                </p>
              </div>
            </div>
          </div>
        )}

        {!USE_MOCK_DATA && authUser && (
          <section
            className="mb-6 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
            aria-labelledby="account-security-heading"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                <Lock className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="account-security-heading" className="text-sm font-bold text-foreground">
                  {t('profileAccount.title')}
                </h2>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('profileAccount.emailLabel')}
                </p>
                <p className="mt-0.5 break-all text-sm text-foreground">{authUser.email}</p>
                {authUser.email?.includes('@users.dolli.internal') ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t('profileAccount.emailSyntheticHint')}
                  </p>
                ) : null}
              </div>
            </div>

            {authUser.has_password ? (
              <form
                className="space-y-3 border-t border-border pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    if (pwNew !== pwNew2) {
                      toast.error(t('profileAccount.passwordMismatch'));
                      return;
                    }
                    setPwBusy(true);
                    try {
                      await authApi.changePassword(pwCurrent, pwNew);
                      setPwCurrent('');
                      setPwNew('');
                      setPwNew2('');
                      await refetch();
                      toast.success(t('profileAccount.passwordUpdated'));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Error');
                    } finally {
                      setPwBusy(false);
                    }
                  })();
                }}
              >
                <p className="text-xs font-semibold text-foreground">{t('profileAccount.changePasswordTitle')}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('profileAccount.currentPassword')}
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    className="h-10 border-border bg-muted/60 text-foreground sm:col-span-1"
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('profileAccount.newPassword')}
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    className="h-10 border-border bg-muted/60 text-foreground sm:col-span-1"
                  />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('profileAccount.confirmPassword')}
                    value={pwNew2}
                    onChange={(e) => setPwNew2(e.target.value)}
                    className="h-10 border-border bg-muted/60 text-foreground sm:col-span-1"
                  />
                </div>
                <Button type="submit" size="sm" disabled={pwBusy} className="rounded-xl">
                  {t('profileAccount.savePassword')}
                </Button>
              </form>
            ) : null}

            <div className="space-y-4 border-t border-border pt-5">
              <div>
                <p className="text-xs font-semibold text-foreground">{t('profileAccount.socialTitle')}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('profileAccount.socialIntro')}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {TIKTOK_ICON}
                    {t('profileAccount.tiktok')}
                  </span>
                  {authUser.tiktok_primary_login ? (
                    <span className="text-xs text-muted-foreground">
                      {t('profileAccount.signedInWith', { provider: t('profileAccount.tiktok') })}
                    </span>
                  ) : authUser.tiktok_connected ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t('profileAccount.linkedAs', {
                          name: authUser.tiktok_display_name || 'TikTok',
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() =>
                          void (async () => {
                            try {
                              await authApi.unlinkTikTok();
                              await refetch();
                              toast.success(t('profileAccount.unlinkDone'));
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Error');
                            }
                          })()
                        }
                      >
                        {t('profileAccount.unlink')}
                      </Button>
                    </div>
                  ) : acctOpts?.tiktok ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg bg-foreground/10 text-xs text-foreground hover:bg-foreground/15"
                      onClick={() =>
                        void (async () => {
                          try {
                            toast.info(t('profileAccount.linking'));
                            await authApi.startSocialLinkTikTok();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Error');
                          }
                        })()
                      }
                    >
                      {t('profileAccount.connect')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('profileAccount.configureServer')}</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Facebook className="h-4 w-4 text-sky-300" aria-hidden />
                    {t('profileAccount.facebook')}
                  </span>
                  {authUser.meta_primary_login ? (
                    <span className="text-xs text-muted-foreground">
                      {t('profileAccount.signedInWith', { provider: t('profileAccount.facebook') })}
                    </span>
                  ) : authUser.meta_connected ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t('profileAccount.linkedAs', {
                          name: authUser.meta_display_name || 'Facebook',
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        onClick={() =>
                          void (async () => {
                            try {
                              await authApi.unlinkMeta();
                              await refetch();
                              toast.success(t('profileAccount.unlinkDone'));
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Error');
                            }
                          })()
                        }
                      >
                        {t('profileAccount.unlink')}
                      </Button>
                    </div>
                  ) : acctOpts?.meta_facebook ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg bg-foreground/10 text-xs text-foreground hover:bg-foreground/15"
                      onClick={() =>
                        void (async () => {
                          try {
                            toast.info(t('profileAccount.linking'));
                            await authApi.startSocialLinkMeta();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Error');
                          }
                        })()
                      }
                    >
                      {t('profileAccount.connect')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('profileAccount.configureServer')}</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {INSTAGRAM_ICON}
                  {t('profileAccount.instagramHandle')}
                </span>
                <p className="text-xs text-muted-foreground">{t('profileAccount.instagramHint')}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={igDraft}
                    onChange={(e) => setIgDraft(e.target.value)}
                    placeholder="username"
                    maxLength={120}
                    className="h-10 border-border bg-muted/60 text-foreground sm:max-w-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl sm:w-auto"
                    disabled={igBusy}
                    onClick={() =>
                      void (async () => {
                        setIgBusy(true);
                        try {
                          await authApi.updateProfile({
                            instagram_handle: igDraft.trim() || null,
                          });
                          await refetch();
                          toast.success(t('profileAccount.instagramSaved'));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Error');
                        } finally {
                          setIgBusy(false);
                        }
                      })()
                    }
                  >
                    {t('profileAccount.saveHandle')}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {!USE_MOCK_DATA && (
          <div className="bg-card rounded-2xl border border-border p-5 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">NSFW filter</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  When on, mature or sensitive fundraisers stay out of Explore and home, and campaign pages stay
                  blurred until you turn this off.
                </p>
              </div>
              <Switch
                checked={user?.nsfw_filter_enabled !== false}
                disabled={nsfwSaving}
                onCheckedChange={async (checked) => {
                  setNsfwSaving(true);
                  try {
                    await authApi.updateProfile({ nsfw_filter_enabled: checked });
                    await refetch();
                    toast.success(
                      checked
                        ? 'Sensitive fundraisers stay hidden.'
                        : 'Sensitive fundraisers may appear in feeds and full pages.',
                    );
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not update setting');
                  } finally {
                    setNsfwSaving(false);
                  }
                }}
                aria-label="Hide NSFW and sensitive fundraisers"
              />
            </div>
          </div>
        )}

        {/* Impact Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <Heart className="w-5 h-5 text-pink-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-emerald-400">${totalDonated}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Donated</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <Sparkles className="w-5 h-5 text-violet-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-foreground">{campaigns.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Campaigns Created</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <Users className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-foreground">{totalReferralDonations}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">People Referred</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent">${impactMultiplied}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Impact Multiplied</div>
          </div>
        </div>

        {!USE_MOCK_DATA && campaigns.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-5 mb-6">
            <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Your campaigns
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Until the first completed donation, you can move a live campaign back to drafts or delete it.
            </p>
            <div className="space-y-4">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="space-y-2 rounded-xl border border-border bg-muted/40 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {(c.status || 'active').toLowerCase() === 'draft' ? 'Draft' : c.status === 'active' ? 'Live' : c.status}
                    </span>
                  </div>
                  <OwnerCampaignControls
                    campaign={{
                      id: c.id,
                      title: c.title,
                      status: c.status,
                      raised_amount: c.raised_amount,
                      donor_count: c.donor_count,
                    }}
                    onChanged={loadData}
                    layout="row"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements - Streak + Badges */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Achievements
            </h2>
            <span className="text-xs text-muted-foreground">{earnedBadgeNames.length} earned</span>
          </div>

          {/* Donation Streak */}
          <div className="mb-4 rounded-xl bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Donation Streak
              </span>
              <span className="text-xs font-bold text-foreground">{streak} days</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div
                  key={day}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    day <= streak
                      ? 'bg-gradient-to-r from-orange-400 to-amber-500 shadow-sm shadow-orange-500/30'
                      : 'bg-muted/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-4 gap-2">
            {badges.slice(0, 8).map((badge) => {
              const earned = earnedBadgeNames.includes(badge.name);
              return (
                <div
                  key={badge.id}
                  className={`rounded-xl p-2.5 text-center transition-all ${
                    earned
                      ? 'bg-gradient-to-br from-violet-500/10 to-pink-500/10 border border-violet-500/20'
                      : 'border border-border bg-muted/30 opacity-30'
                  }`}
                >
                  <div className="text-xl mb-0.5">{badge.icon}</div>
                  <div className="text-[9px] font-semibold text-muted-foreground leading-tight line-clamp-1">{badge.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-card rounded-xl p-1 border border-border">
          {[
            { key: 'activity' as const, label: 'My feed', icon: Zap },
            { key: 'badges' as const, label: 'All Badges', icon: Trophy },
            { key: 'referrals' as const, label: 'Referrals', icon: Share2 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity Feed */}
        {activeTab === 'activity' && (
          <div className="space-y-2">
            {activityFeed.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold mb-2">No personal activity yet</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Donations, campaigns you create, and referrals show up here — your private timeline on Dolli.
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  For community-wide updates, use <strong className="text-muted-foreground">Your feeds</strong> above or open{' '}
                  <Link to="/explore?view=network" className="text-violet-400 hover:text-violet-300">
                    Network activity
                  </Link>
                  .
                </p>
                <Link to="/explore">
                  <Button className="rounded-xl border-0 bg-violet-600 text-white hover:bg-violet-500">
                    Explore campaigns
                  </Button>
                </Link>
              </div>
            ) : (
              activityFeed.slice(0, 15).map((item, idx) => {
                const IconComp = getActivityIcon(item.iconType);
                const colorMap: Record<string, string> = {
                  donation: 'bg-emerald-500/10 text-emerald-400',
                  campaign: 'bg-violet-500/10 text-violet-400',
                  referral: 'bg-blue-500/10 text-blue-400',
                };
                return (
                  <div key={idx} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[item.type] || 'bg-white/5 text-muted-foreground'}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.detail}</div>
                    </div>
                    {item.date && (
                      <div className="text-[10px] text-slate-600 flex-shrink-0">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* All Badges */}
        {activeTab === 'badges' && (
          <div className="grid grid-cols-2 gap-3">
            {badges.map((badge) => {
              const earned = earnedBadgeNames.includes(badge.name);
              const tierClass = tierColors[badge.tier] || tierColors.bronze;
              return (
                <div
                  key={badge.id}
                  className={`rounded-2xl border p-4 text-center transition-all ${
                    earned
                      ? `bg-gradient-to-br ${tierClass} bg-opacity-10`
                      : 'bg-card border-border opacity-30'
                  }`}
                >
                  <div className="text-3xl mb-2">{badge.icon}</div>
                  <div className="font-bold text-sm mb-1">{badge.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{badge.description}</div>
                  {earned && (
                    <div className="mt-2 text-[10px] font-semibold text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Earned
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Referrals */}
        {activeTab === 'referrals' && (
          <div className="space-y-3">
            {/* Referral Link */}
            <div className="bg-card rounded-2xl border border-violet-500/20 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-foreground">Your Referral Link</span>
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 truncate rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                    {USE_MOCK_DATA ? 'dolli.app/u/amir?ref=123' : `${window.location.origin}/?ref=${user?.id?.slice(0, 8) || 'dolli'}`}
                  </div>
                  <button
                    onClick={handleCopyReferralLink}
                    className="px-3 py-2.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-all"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Impact Multiplier Visualization */}
                <div className="mb-4 rounded-xl bg-muted/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-violet-300">Impact Multiplier</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {totalDonated > 0 ? `${((impactMultiplied / totalDonated) || 1).toFixed(1)}x` : '1.0x'}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-pink-500 to-emerald-500 transition-all duration-1000"
                      style={{ width: `${Math.min(((impactMultiplied / Math.max(totalDonated, 1)) / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Your ${totalDonated} turned into ${impactMultiplied} through referrals
                  </p>
                </div>

                {/* Share Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleShareImpact('tiktok')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition-all hover:bg-slate-800 dark:bg-black dark:hover:bg-white/10"
                  >
                    {TIKTOK_ICON}
                    TikTok
                  </button>
                  <button
                    onClick={() => handleShareImpact('instagram')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
                  >
                    {INSTAGRAM_ICON}
                    Instagram
                  </button>
                  <button
                    onClick={() => handleShareImpact('twitter')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition-all hover:bg-slate-800 dark:bg-black dark:hover:bg-white/10"
                  >
                    <Share2 className="w-4 h-4" />
                    X
                  </button>
                </div>
              </div>
            </div>

            {/* Referral Stats */}
            {referrals.length > 0 && (
              <>
                <div className="bg-card rounded-xl border border-border p-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-blue-400">{totalClicks}</div>
                    <div className="text-[10px] text-muted-foreground">Clicks</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-violet-400">{totalReferralDonations}</div>
                    <div className="text-[10px] text-muted-foreground">Conversions</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">${totalReferralAmount}</div>
                    <div className="text-[10px] text-muted-foreground">Impact</div>
                  </div>
                </div>
                {referrals.map((r) => (
                  <div key={r.id} className="bg-card rounded-xl border border-border p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Share2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm capitalize">{r.platform}</div>
                        <div className="text-xs text-muted-foreground">Campaign #{r.campaign_id}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-muted-foreground">{r.clicks} clicks</div>
                      <div className="text-emerald-400 font-semibold">{r.donations_count} donations</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {referrals.length === 0 && (
              <div className="text-center py-8 bg-card rounded-2xl border border-border">
                <Share2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold mb-2">No referrals yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Share your link above to start multiplying impact</p>
              </div>
            )}

            {/* Share My Impact CTA */}
            <Button
              onClick={handleCopyReferralLink}
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold py-6 rounded-2xl shadow-2xl shadow-violet-500/20 hover:shadow-violet-500/30 transition-all border-0"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share My Impact
            </Button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { toast } from 'sonner';
import {
  Heart, Trophy, Flame, Share2, TrendingUp, User,
  Copy, CheckCircle2, Pencil,
  Zap, Users, Gift, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  title: string;
  category: string;
  goal_amount: number;
  raised_amount: number;
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
  const { user: authUser, login, loading: authLoading } = useAuth();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activity' | 'badges' | 'referrals'>('activity');
  const [copied, setCopied] = useState(false);

  const user = USE_MOCK_DATA ? MOCK_USER : authUser;
  const isLoading = USE_MOCK_DATA ? false : (authLoading || loading);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setDonations(MOCK_DONATIONS);
      setBadges(MOCK_BADGES);
      setReferrals(MOCK_REFERRALS);
      setCampaigns(MOCK_CAMPAIGNS);
      setLoading(false);
      return;
    }
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [donationsRes, badgesRes, referralsRes, campaignsRes] = await Promise.all([
        client.entities.donations.query({ sort: '-created_at', limit: 50 }),
        client.entities.badges.query({ limit: 50 }),
        client.entities.referrals.query({ sort: '-created_at', limit: 50 }),
        client.entities.campaigns.query({ sort: '-created_at', limit: 50 }),
      ]);
      setDonations(donationsRes?.data?.items || []);
      setBadges(badgesRes?.data?.items || []);
      setReferrals(referralsRes?.data?.items || []);
      setCampaigns(campaignsRes?.data?.items || []);
    } catch (err) {
      console.error('Failed to load profile data:', err);
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
          <h2 className="text-2xl font-bold mb-3">Sign in to see your impact</h2>
          <p className="text-slate-400 mb-6">Track your donations, badges, and referral impact.</p>
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
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      <div className="pt-20 max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        {/* Profile Header */}
        <div className="bg-[#13131A] rounded-2xl border border-white/5 p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-4 mb-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25 ring-2 ring-violet-500/20 ring-offset-2 ring-offset-[#13131A]">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{USE_MOCK_DATA ? 'Amir' : 'My Impact'}</h1>
              <p className="text-sm text-slate-500">Tap → Share → Multiply</p>
            </div>
            <button className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Impact Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-4 text-center">
            <Heart className="w-5 h-5 text-pink-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-emerald-400">${totalDonated}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Total Donated</div>
          </div>
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-4 text-center">
            <Sparkles className="w-5 h-5 text-violet-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-white">{campaigns.length}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Campaigns Created</div>
          </div>
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-4 text-center">
            <Users className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-white">{totalReferralDonations}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">People Referred</div>
          </div>
          <div className="bg-[#13131A] rounded-2xl border border-white/5 p-4 text-center">
            <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent">${impactMultiplied}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Impact Multiplied</div>
          </div>
        </div>

        {/* Achievements - Streak + Badges */}
        <div className="bg-[#13131A] rounded-2xl border border-white/5 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Achievements
            </h2>
            <span className="text-xs text-slate-500">{earnedBadgeNames.length} earned</span>
          </div>

          {/* Donation Streak */}
          <div className="bg-white/5 rounded-xl p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Donation Streak
              </span>
              <span className="text-xs font-bold text-white">{streak} days</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div
                  key={day}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    day <= streak
                      ? 'bg-gradient-to-r from-orange-400 to-amber-500 shadow-sm shadow-orange-500/30'
                      : 'bg-white/5'
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
                      : 'bg-white/[0.02] border border-white/5 opacity-30'
                  }`}
                >
                  <div className="text-xl mb-0.5">{badge.icon}</div>
                  <div className="text-[9px] font-semibold text-slate-300 leading-tight line-clamp-1">{badge.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-[#13131A] rounded-xl p-1 border border-white/5">
          {[
            { key: 'activity' as const, label: 'Activity', icon: Zap },
            { key: 'badges' as const, label: 'All Badges', icon: Trophy },
            { key: 'referrals' as const, label: 'Referrals', icon: Share2 },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-slate-500 hover:text-slate-300'
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
              <div className="text-center py-12 bg-[#13131A] rounded-2xl border border-white/5">
                <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold mb-2">No activity yet</h3>
                <p className="text-sm text-slate-400 mb-4">Start giving to build your impact story</p>
                <Link to="/explore">
                  <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0 rounded-xl">
                    Explore Campaigns
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
                  <div key={idx} className="bg-[#13131A] rounded-xl border border-white/5 p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[item.type] || 'bg-white/5 text-slate-400'}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-white truncate">{item.label}</div>
                      <div className="text-xs text-slate-500 truncate">{item.detail}</div>
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
                      : 'bg-[#13131A] border-white/5 opacity-30'
                  }`}
                >
                  <div className="text-3xl mb-2">{badge.icon}</div>
                  <div className="font-bold text-sm mb-1">{badge.name}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{badge.description}</div>
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
            <div className="bg-[#13131A] rounded-2xl border border-violet-500/20 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-white">Your Referral Link</span>
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-400 truncate border border-white/5">
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
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-violet-300">Impact Multiplier</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {totalDonated > 0 ? `${((impactMultiplied / totalDonated) || 1).toFixed(1)}x` : '1.0x'}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-pink-500 to-emerald-500 transition-all duration-1000"
                      style={{ width: `${Math.min(((impactMultiplied / Math.max(totalDonated, 1)) / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Your ${totalDonated} turned into ${impactMultiplied} through referrals
                  </p>
                </div>

                {/* Share Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleShareImpact('tiktok')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-all"
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
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-black border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-all"
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
                <div className="bg-[#13131A] rounded-xl border border-white/5 p-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-blue-400">{totalClicks}</div>
                    <div className="text-[10px] text-slate-500">Clicks</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-violet-400">{totalReferralDonations}</div>
                    <div className="text-[10px] text-slate-500">Conversions</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">${totalReferralAmount}</div>
                    <div className="text-[10px] text-slate-500">Impact</div>
                  </div>
                </div>
                {referrals.map((r) => (
                  <div key={r.id} className="bg-[#13131A] rounded-xl border border-white/5 p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Share2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm capitalize">{r.platform}</div>
                        <div className="text-xs text-slate-500">Campaign #{r.campaign_id}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-slate-400">{r.clicks} clicks</div>
                      <div className="text-emerald-400 font-semibold">{r.donations_count} donations</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {referrals.length === 0 && (
              <div className="text-center py-8 bg-[#13131A] rounded-2xl border border-white/5">
                <Share2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold mb-2">No referrals yet</h3>
                <p className="text-sm text-slate-400 mb-4">Share your link above to start multiplying impact</p>
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
      </div>
    </div>
  );
}

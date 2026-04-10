import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '@/lib/api';
import Header from '@/components/Header';
import { Heart, TrendingUp, Users, Share2, Zap, ArrowRight, Sparkles } from 'lucide-react';
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
  image_url: string;
  status: string;
  urgency_level: string;
  featured: boolean;
}

const HERO_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/7ca7266f-afd2-4e00-8277-3b67d9410f95.png';

const categoryColors: Record<string, string> = {
  environment: 'from-emerald-500 to-green-600',
  health: 'from-rose-500 to-pink-600',
  education: 'from-blue-500 to-indigo-600',
  food: 'from-amber-500 to-orange-600',
  animals: 'from-purple-500 to-violet-600',
};

const urgencyBadge: Record<string, { label: string; color: string }> = {
  critical: { label: '🔥 Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: '⚡ Urgent', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  medium: { label: '📢 Active', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  low: { label: '🌱 Growing', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100);
  const urgency = urgencyBadge[campaign.urgency_level] || urgencyBadge.medium;
  const gradientClass = categoryColors[campaign.category] || 'from-violet-500 to-purple-600';

  return (
    <Link
      to={`/campaign/${campaign.id}`}
      className="group block bg-[#13131A] rounded-2xl border border-white/5 overflow-hidden hover:border-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={campaign.image_url}
          alt={campaign.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#13131A] via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${urgency.color}`}>
            {urgency.label}
          </span>
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
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r ${gradientClass} text-white`}>
            {campaign.category}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-violet-300 transition-colors line-clamp-1">
          {campaign.title}
        </h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{campaign.description}</p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-bold text-emerald-400">${campaign.raised_amount.toLocaleString()}</span>
            <span className="text-slate-500">of ${campaign.goal_amount.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {campaign.donor_count.toLocaleString()} donors
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" /> {campaign.share_count.toLocaleString()} shares
          </span>
          <span className="font-semibold text-violet-400">{Math.round(progress)}%</span>
        </div>
      </div>
    </Link>
  );
}

export default function Index() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSorted, setAiSorted] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await client.entities.campaigns.query({
        query: { status: 'active' },
        sort: '-created_at',
        limit: 20,
      });
      const items = response?.data?.items || [];
      // AI-prioritized sorting: boost by share velocity, donor count, urgency
      const sorted = [...items].sort((a: Campaign, b: Campaign) => {
        const scoreA = (a.share_count * 2) + (a.donor_count * 1.5) + (a.urgency_level === 'critical' ? 1000 : a.urgency_level === 'high' ? 500 : 100) + (a.featured ? 2000 : 0);
        const scoreB = (b.share_count * 2) + (b.donor_count * 1.5) + (b.urgency_level === 'critical' ? 1000 : b.urgency_level === 'high' ? 500 : 100) + (b.featured ? 2000 : 0);
        return scoreB - scoreA;
      });
      setCampaigns(sorted);
      setAiSorted(true);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: Heart, label: 'Total Raised', value: '$25,640', color: 'text-pink-400' },
    { icon: Users, label: 'Active Donors', value: '20,109', color: 'text-violet-400' },
    { icon: Share2, label: 'Social Shares', value: '12,190', color: 'text-blue-400' },
    { icon: TrendingUp, label: 'Viral K-Factor', value: '1.34', color: 'text-emerald-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0F]/50 via-[#0A0A0F]/80 to-[#0A0A0F]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Social-Native Micro-Donations
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight mb-6">
              <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
                One Tap.
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-emerald-400 bg-clip-text text-transparent">
                One Dollar.
              </span>
              <br />
              <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
                Real Impact.
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-xl mx-auto">
              The micro-donation engine built for TikTok and Instagram. Share, donate, and watch your impact multiply virally.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/explore">
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-6 text-lg rounded-2xl shadow-2xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all border-0">
                  <Heart className="w-5 h-5 mr-2 fill-white" />
                  Start Giving
                </Button>
              </Link>
              <Link to="/create">
                <Button variant="outline" className="!bg-transparent !hover:bg-transparent border-white/10 text-white hover:border-violet-500/50 px-8 py-6 text-lg rounded-2xl transition-all">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative -mt-8 z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#13131A] rounded-2xl border border-white/5 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Feed */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Trending Campaigns</h2>
              {aiSorted && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  AI Ranked
                </span>
              )}
            </div>
            <p className="text-slate-500">Prioritized by share velocity & social impact</p>
          </div>
          <Link to="/explore" className="text-violet-400 hover:text-violet-300 text-sm font-medium flex items-center gap-1 transition-colors">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#13131A] rounded-2xl border border-white/5 h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">How Dolli Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Tap to Give $1', desc: 'Find a cause you care about and donate with a single tap. It only takes a dollar to make a difference.', icon: '💰' },
            { step: '02', title: 'Share the Impact', desc: 'Share your donation on TikTok or Instagram. Your friends see your impact and join the movement.', icon: '📱' },
            { step: '03', title: 'Watch It Multiply', desc: 'Every share creates a viral loop. Track your referrals and see how your $1 turned into hundreds.', icon: '🚀' },
          ].map((item) => (
            <div key={item.step} className="text-center p-6 rounded-2xl bg-[#13131A] border border-white/5 hover:border-violet-500/20 transition-all">
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="text-xs font-bold text-violet-400 tracking-wider mb-2">STEP {item.step}</div>
              <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 group"
            aria-label="Dolli home"
          >
            <img
              src="/brand/dolli-mark.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 drop-shadow-[0_0_12px_rgba(139,92,246,0.4)] group-hover:opacity-90 transition-opacity"
            />
            <span className="font-bold text-white">Dolli</span>
          </Link>
          <p className="text-sm text-slate-500">© 2026 Dolli. Social-native micro-donations for everyone.</p>
        </div>
      </footer>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
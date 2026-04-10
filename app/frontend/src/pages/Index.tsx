import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { client, refreshWebSdkClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CAMPAIGN_CATEGORY_GRADIENTS } from '@/lib/campaignCategories';
import Header from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';
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
  is_nsfw?: boolean;
}

const HERO_IMAGE = 'https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/7ca7266f-afd2-4e00-8277-3b67d9410f95.png';

const categoryColors = CAMPAIGN_CATEGORY_GRADIENTS;

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
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
  const progress = Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100);
  const urgency = urgencyBadge[campaign.urgency_level] || urgencyBadge.medium;
  const gradientClass = categoryColors[campaign.category] || 'from-violet-500 to-purple-600';

  return (
    <Link
      to={`/campaign/${campaign.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 hover:shadow-2xl hover:shadow-violet-500/10"
    >
      <div className="relative h-48 overflow-hidden">
        <img
          src={campaign.image_url}
          alt={campaign.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${urgency.color}`}>
            {urgency.label}
          </span>
          {campaign.is_nsfw && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-rose-500/15 text-rose-300 border-rose-500/30">
              {t('home.card.sensitive')}
            </span>
          )}
        </div>
        {campaign.featured && (
          <div className="absolute top-3 right-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {t('home.card.featured')}
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
        <h3 className="mb-2 line-clamp-1 text-lg font-bold text-foreground transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300">
          {campaign.title}
        </h3>
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-bold text-emerald-400">${campaign.raised_amount.toLocaleString()}</span>
            <span className="text-muted-foreground">
              {t('home.card.of', { goal: campaign.goal_amount.toLocaleString() })}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {t('home.card.donors', { count: campaign.donor_count })}
          </span>
          <span className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" /> {t('home.card.shares', { count: campaign.share_count })}
          </span>
          <span className="font-semibold text-violet-600 dark:text-violet-400">{Math.round(progress)}%</span>
        </div>
      </div>
    </Link>
  );
}

export default function Index() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSorted, setAiSorted] = useState(false);

  useEffect(() => {
    refreshWebSdkClient();
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await client.entities.campaigns.query({
          query: { status: 'active' },
          sort: '-created_at',
          limit: 20,
        });
        const items = response?.data?.items || [];
        const sorted = [...items].sort((a: Campaign, b: Campaign) => {
          const scoreA = (a.share_count * 2) + (a.donor_count * 1.5) + (a.urgency_level === 'critical' ? 1000 : a.urgency_level === 'high' ? 500 : 100) + (a.featured ? 2000 : 0);
          const scoreB = (b.share_count * 2) + (b.donor_count * 1.5) + (b.urgency_level === 'critical' ? 1000 : b.urgency_level === 'high' ? 500 : 100) + (b.featured ? 2000 : 0);
          return scoreB - scoreA;
        });
        if (!cancelled) {
          setCampaigns(sorted);
          setAiSorted(true);
        }
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.nsfw_filter_enabled]);

  const stats = useMemo(
    () => [
      { icon: Heart, label: t('home.stats.raised'), value: '$25,640', color: 'text-pink-400' },
      { icon: Users, label: t('home.stats.donors'), value: '20,109', color: 'text-violet-400' },
      { icon: Share2, label: t('home.stats.shares'), value: '12,190', color: 'text-blue-400' },
      { icon: TrendingUp, label: t('home.stats.kfactor'), value: '1.34', color: 'text-emerald-400' },
    ],
    [t],
  );

  const howSteps = useMemo(
    () => [
      { step: '01', title: t('home.steps.1t'), desc: t('home.steps.1d'), icon: '💰' },
      { step: '02', title: t('home.steps.2t'), desc: t('home.steps.2d'), icon: '📱' },
      { step: '03', title: t('home.steps.3t'), desc: t('home.steps.3d'), icon: '🚀' },
    ],
    [t],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
      {/* Hero Section */}
      <section className="relative pt-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-700 dark:border-violet-500/20 dark:text-violet-300">
              <Zap className="w-4 h-4" />
              {t('home.badge')}
            </div>
            <h1 className="mb-6 text-5xl font-black leading-tight sm:text-6xl lg:text-7xl">
              <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-500 bg-clip-text text-transparent dark:from-white dark:via-white dark:to-slate-400">
                {t('home.h1a')}
              </span>
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-pink-500 to-emerald-500 bg-clip-text text-transparent dark:from-violet-400 dark:via-pink-400 dark:to-emerald-400">
                {t('home.h1b')}
              </span>
              <br />
              <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-500 bg-clip-text text-transparent dark:from-white dark:via-white dark:to-slate-400">
                {t('home.h1c')}
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground sm:text-xl">{t('home.heroSub')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/explore">
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-6 text-lg rounded-2xl shadow-2xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all border-0">
                  <Heart className="w-5 h-5 mr-2 fill-white" />
                  {t('home.seeLive')}
                </Button>
              </Link>
              <Link to="/create">
                <Button
                  variant="outline"
                  className="rounded-2xl border-border px-8 py-6 text-lg !bg-transparent text-foreground !hover:bg-transparent hover:border-violet-500/50"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {t('home.createCampaign')}
                </Button>
              </Link>
            </div>
            <nav
              className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-10 text-sm"
              aria-label="Popular destinations"
            >
              <Link to="/explore" className="text-muted-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-300">
                {t('nav.exploreAll')}
              </Link>
              <Link to="/search/users" className="text-muted-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-300">
                {t('nav.findPeople')}
              </Link>
              <Link to="/friends" className="text-muted-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-300">
                {t('nav.friends')}
              </Link>
              <Link to="/notifications" className="text-muted-foreground transition-colors hover:text-violet-600 dark:hover:text-violet-300">
                {t('nav.notifications')}
              </Link>
            </nav>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative -mt-8 z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Feed */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t('home.trending')}</h2>
              {aiSorted && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {t('home.aiRanked')}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{t('home.trendingSub')}</p>
          </div>
          <Link
            to="/explore"
            className="flex items-center gap-1 text-sm font-medium text-violet-600 transition-colors hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300"
          >
            {t('home.viewAll')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
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
        <h2 className="mb-12 text-center text-3xl font-bold text-foreground">{t('home.howTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {howSteps.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-border bg-card p-6 text-center transition-all hover:border-violet-500/25 dark:hover:border-violet-500/20"
            >
              <div className="mb-4 text-4xl">{item.icon}</div>
              <div className="mb-2 text-xs font-bold tracking-wider text-violet-600 dark:text-violet-400">
                {t('home.step', { n: item.step })}
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      </main>
      <SiteFooter />
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
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { client } from '@/lib/api';
import Header from '@/components/Header';
import { Search, Filter, Users, Share2, Sparkles, Heart } from 'lucide-react';
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

const categories = [
  { value: 'all', label: 'All', emoji: '🌍' },
  { value: 'environment', label: 'Environment', emoji: '🌱' },
  { value: 'health', label: 'Health', emoji: '❤️' },
  { value: 'education', label: 'Education', emoji: '📚' },
  { value: 'food', label: 'Food', emoji: '🍲' },
  { value: 'animals', label: 'Animals', emoji: '🐾' },
];

const urgencyBadge: Record<string, { label: string; color: string }> = {
  critical: { label: '🔥 Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: '⚡ Urgent', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  medium: { label: '📢 Active', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  low: { label: '🌱 Growing', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

export default function Explore() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await client.entities.campaigns.query({
        query: { status: 'active' },
        sort: '-created_at',
        limit: 50,
      });
      setCampaigns(response?.data?.items || []);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = campaigns
    .filter((c) => {
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'trending') {
        const scoreA = a.share_count * 2 + a.donor_count * 1.5 + (a.featured ? 2000 : 0);
        const scoreB = b.share_count * 2 + b.donor_count * 1.5 + (b.featured ? 2000 : 0);
        return scoreB - scoreA;
      }
      if (sortBy === 'newest') return 0; // already sorted by created_at
      if (sortBy === 'almost-funded') {
        const pA = a.raised_amount / a.goal_amount;
        const pB = b.raised_amount / b.goal_amount;
        return pB - pA;
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Explore Campaigns</h1>
          <p className="text-slate-400">Find causes you care about and make an impact with $1</p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-[#13131A] border border-white/5 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
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
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#13131A] rounded-2xl border border-white/5 h-80 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">No campaigns found</h3>
            <p className="text-slate-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((campaign) => {
              const progress = Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100);
              const urgency = urgencyBadge[campaign.urgency_level] || urgencyBadge.medium;

              return (
                <Link
                  key={campaign.id}
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
                    <div className="absolute top-3 left-3">
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
        )}
      </div>
    </div>
  );
}
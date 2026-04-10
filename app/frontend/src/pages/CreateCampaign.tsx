import { useState, useEffect } from 'react';
import { useNavigate, Link, useMatch } from 'react-router-dom';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { fetchCampaignCreateEligibility } from '@/lib/campaignEligibility';
import { fetchCampaignAiDraft } from '@/lib/campaignAiDraft';
import { CAMPAIGN_CATEGORIES } from '@/lib/campaignCategories';
import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';
import { updateCampaign } from '@/lib/campaignMutations';
import {
  ArrowLeft, Sparkles, ImagePlus, Upload, Clock, DollarSign,
  Eye, User, Heart, Users, Share2, Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const USE_MOCK_DATA = false;

const MOCK_USER = {
  id: 'mock-amir-001',
  email: 'amir@dolli.app',
  name: 'Amir',
  role: 'user',
};

const MOCK_AI_RESULT = {
  title: 'Plant 1,000 Trees Together',
  description: 'Help us reforest devastated areas by planting 1,000 native trees. Every dollar plants a seedling that grows into a carbon-absorbing powerhouse.',
  category: 'environment',
  goal_amount: 1000,
  impact_statement: 'Plants one tree seedling in a deforested area',
};

const categories = CAMPAIGN_CATEGORIES;

const durations = [
  { value: 7, label: '1 Week' },
  { value: 14, label: '2 Weeks' },
  { value: 30, label: '1 Month' },
  { value: 60, label: '2 Months' },
  { value: 90, label: '3 Months' },
];

const DEFAULT_COVER_IMAGE =
  'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1200&q=80';

export default function CreateCampaign() {
  const { user: authUser, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const editMatch = useMatch('/campaign/:id/edit');
  const isEditMode = Boolean(editMatch?.params.id);
  const editCampaignId =
    editMatch?.params.id && Number.isFinite(Number(editMatch.params.id))
      ? Number(editMatch.params.id)
      : null;
  const [editBootstrapping, setEditBootstrapping] = useState(isEditMode);
  const [editError, setEditError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [eligibility, setEligibility] = useState<Awaited<
    ReturnType<typeof fetchCampaignCreateEligibility>
  > | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    goal_amount: 1000,
    duration: 30,
    image_url: '',
    gif_url: '',
    video_url: '',
    impact_statement: '',
    is_nsfw: false,
  });

  const user = USE_MOCK_DATA ? MOCK_USER : authUser;
  const isLoading = USE_MOCK_DATA ? false : authLoading;

  // Auto-show preview when enough fields are filled
  useEffect(() => {
    if (form.title && form.description && form.category) {
      setShowPreview(true);
    }
  }, [form.title, form.description, form.category]);

  useEffect(() => {
    if (isEditMode) return;
    if (!authUser) {
      setEligibility(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setEligibilityLoading(true);
      const e = await fetchCampaignCreateEligibility();
      if (!cancelled) {
        setEligibility(e);
        setEligibilityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, isEditMode]);

  useEffect(() => {
    if (!isEditMode || editCampaignId == null) {
      setEditBootstrapping(false);
      return;
    }
    if (!authUser?.id) return;

    let cancelled = false;
    (async () => {
      setEditBootstrapping(true);
      setEditError(null);
      try {
        const token = authApi.getStoredToken();
        const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/${editCampaignId}`, {
          credentials: 'omit',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const c = (await res.json().catch(() => ({}))) as {
          detail?: string;
          user_id?: string;
          status?: string;
          title?: string;
          description?: string;
          category?: string;
          goal_amount?: number;
          image_url?: string | null;
          gif_url?: string | null;
          video_url?: string | null;
          impact_statement?: string | null;
          is_nsfw?: boolean;
        };
        if (!res.ok) {
          throw new Error(typeof c.detail === 'string' ? c.detail : 'Campaign not found');
        }
        if (c.user_id !== authUser.id) {
          throw new Error('You can only edit your own drafts.');
        }
        if ((c.status || '').toLowerCase() !== 'draft') {
          throw new Error('Only drafts can be edited here. Unpublish from your profile first.');
        }
        if (cancelled) return;
        setForm({
          title: c.title || '',
          description: c.description || '',
          category: c.category || '',
          goal_amount: c.goal_amount ?? 1000,
          duration: 30,
          image_url: c.image_url || '',
          gif_url: c.gif_url || '',
          video_url: c.video_url || '',
          impact_statement: c.impact_statement || '',
          is_nsfw: Boolean(c.is_nsfw),
        });
      } catch (e) {
        if (!cancelled) {
          setEditError(e instanceof Error ? e.message : 'Failed to load campaign');
        }
      } finally {
        if (!cancelled) setEditBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, editCampaignId, authUser?.id]);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe your cause first');
      return;
    }
    setAiGenerating(true);

    if (USE_MOCK_DATA) {
      // Simulate AI generation delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setForm((prev) => ({
        ...prev,
        ...MOCK_AI_RESULT,
      }));
      toast.success('AI generated your campaign details!');
      setAiGenerating(false);
      return;
    }

    try {
      const draft = await fetchCampaignAiDraft(aiPrompt.trim(), 'deepseek-v3.2');
      setForm((prev) => ({
        ...prev,
        title: draft.title || prev.title,
        description: draft.description || prev.description,
        category: draft.category || prev.category,
        goal_amount: draft.goal_amount ?? prev.goal_amount,
        impact_statement: draft.impact_statement || prev.impact_statement,
        image_url: typeof draft.image_url === 'string' ? draft.image_url : prev.image_url,
        gif_url: typeof draft.gif_url === 'string' ? draft.gif_url : prev.gif_url,
        video_url: typeof draft.video_url === 'string' ? draft.video_url : prev.video_url,
      }));
      toast.success('AI generated your campaign details!');
      if (draft.normalization_notes?.length) {
        toast.info('Adjusted a few fields', {
          description: draft.normalization_notes.slice(0, 3).join(' · '),
        });
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'AI generation failed';
      toast.error(detail);
    } finally {
      setAiGenerating(false);
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
          <h2 className="text-2xl font-bold mb-3">Sign in to create a campaign</h2>
          <p className="text-slate-400 mb-6">Start your fundraising journey on Dolli.</p>
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

  if (isEditMode && (editCampaignId == null || !Number.isFinite(editCampaignId))) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 text-center max-w-md mx-auto px-4">
          <h2 className="text-xl font-bold mb-3">Invalid link</h2>
          <p className="text-slate-400 mb-6">This edit URL is not valid.</p>
          <Link to="/profile" className="text-violet-400 hover:text-violet-300">
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  if (isEditMode && editBootstrapping) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isEditMode && editError) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 text-center max-w-md mx-auto px-4">
          <h2 className="text-xl font-bold mb-3">Can’t open editor</h2>
          <p className="text-slate-400 mb-6">{editError}</p>
          <Link
            to="/profile"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500"
          >
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  if (!isEditMode && (eligibilityLoading || !eligibility)) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isEditMode && !eligibility.can_create) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 max-w-lg mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/30 to-rose-500/30 flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Heart className="w-10 h-10 text-amber-300" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Give first, then create</h2>
          <p className="text-slate-400 mb-2">
            {eligibility.message ||
              'Dolli asks you to complete at least one donation before starting your own fundraiser — so the community stays give-first.'}
          </p>
          <p className="text-sm text-slate-500 mb-8">
            Paid donations on your account:{' '}
            <span className="text-white font-semibold">{eligibility.paid_donations_count}</span>
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 transition-all"
          >
            Explore campaigns & donate
          </Link>
          <p className="text-xs text-slate-600 mt-6">
            Admins and dev bypass are exempt. Questions? Contact the team.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!form.title.trim()) {
      toast.error('Please enter a campaign title');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Please enter a campaign description');
      return;
    }
    if (!form.category) {
      toast.error('Please select a category');
      return;
    }

    setSubmitting(true);

    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(isDraft ? 'Campaign saved as draft!' : 'Campaign launched successfully! 🚀');
      setSubmitting(false);
      return;
    }

    try {
      const imagePayload = form.image_url.trim() || DEFAULT_COVER_IMAGE;

      if (isEditMode && editCampaignId != null) {
        await updateCampaign(editCampaignId, {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          goal_amount: form.goal_amount,
          image_url: imagePayload,
          gif_url: form.gif_url.trim() || undefined,
          video_url: form.video_url.trim() || undefined,
          impact_statement: form.impact_statement.trim() || undefined,
          status: isDraft ? 'draft' : 'active',
          urgency_level: 'medium',
          is_nsfw: form.is_nsfw,
        });
        toast.success(
          isDraft ? 'Draft updated.' : 'Campaign published — you’re live in Explore!',
        );
        navigate(isDraft ? '/profile' : `/campaign/${editCampaignId}`);
        return;
      }

      const response = await client.entities.campaigns.create({
        data: {
          title: form.title,
          description: form.description,
          category: form.category,
          goal_amount: form.goal_amount,
          raised_amount: 0,
          donor_count: 0,
          share_count: 0,
          click_count: 0,
          image_url: imagePayload,
          gif_url: form.gif_url.trim() || undefined,
          video_url: form.video_url.trim() || undefined,
          impact_statement: form.impact_statement.trim() || undefined,
          status: isDraft ? 'draft' : 'active',
          urgency_level: 'medium',
          featured: false,
          is_nsfw: form.is_nsfw,
        },
      });
      toast.success(isDraft ? 'Campaign saved as draft!' : 'Campaign launched successfully! 🚀');
      navigate(isDraft ? '/profile' : `/campaign/${response?.data?.id}`);
    } catch (err: any) {
      const detail =
        err instanceof Error
          ? err.message
          : err?.data?.detail || err?.message || 'Failed to save campaign';
      toast.error(typeof detail === 'string' ? detail : 'Failed to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.value === form.category);
  const progress = 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      <div className="pt-20 max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{isEditMode ? 'Edit draft' : 'Create Campaign'}</h1>
            <p className="text-sm text-slate-500">
              {isEditMode
                ? 'Update copy and media while this fundraiser is still a draft. Publish when you’re ready.'
                : 'Lead with emotion — photo, GIF, or short video hooks donors on TikTok & Instagram.'}
            </p>
          </div>
        </div>

        {/* AI Prompt Section */}
        <div className="bg-[#13131A] rounded-2xl border border-violet-500/20 p-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-violet-300">AI Campaign Builder</span>
            </div>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe your cause in a few words… e.g., 'Help rescue stray dogs in downtown shelters'"
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl resize-none mb-3"
            />
            <Button
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold py-5 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all border-0"
            >
              {aiGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="bg-[#13131A] rounded-2xl border border-white/5 p-5 space-y-5 mb-6">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Campaign Title</label>
              {form.title && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI suggested
                </span>
              )}
            </div>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Plant 1000 Trees Together"
              maxLength={60}
              className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl h-12"
            />
            <div className="text-right text-xs text-slate-600 mt-1">{form.title.length}/60</div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat.value })}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                    form.category === cat.value
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                      : 'bg-white/5 text-slate-400 border border-white/5 hover:border-white/10'
                  }`}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white">Short Description</label>
              {form.description && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI suggested
                </span>
              )}
            </div>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 200) })}
              placeholder="Tell people about your cause..."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl resize-none"
            />
            <div className="text-right text-xs text-slate-600 mt-1">{form.description.length}/200</div>
          </div>

          {/* Goal + Duration Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                <DollarSign className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                Funding Goal
              </label>
              <Input
                type="number"
                min={100}
                max={100000}
                value={form.goal_amount}
                onChange={(e) => setForm({ ...form, goal_amount: Number(e.target.value) })}
                className="bg-white/5 border-white/10 text-white focus:border-violet-500/50 rounded-xl h-12"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                <Clock className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                Duration
              </label>
              <div className="relative">
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full h-12 bg-white/5 border border-white/10 text-white rounded-xl px-3 appearance-none focus:border-violet-500/50 focus:outline-none"
                >
                  {durations.map((d) => (
                    <option key={d.value} value={d.value} className="bg-[#13131A] text-white">
                      {d.label}
                    </option>
                  ))}
                </select>
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Visual story — URLs until upload ships */}
          <div className="rounded-xl border border-pink-500/15 bg-pink-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2 text-pink-200">
              <Film className="w-4 h-4" />
              <span className="text-sm font-semibold">Visual story</span>
            </div>
            <p className="text-xs text-slate-500">
              Strong cover art drives shares. Paste direct links (HTTPS). Video wins attention in feeds; GIF adds motion
              without sound.
            </p>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                <ImagePlus className="w-3.5 h-3.5 inline mr-1 text-blue-400" />
                Cover image (photo)
              </label>
              <div className="flex gap-2">
                <Input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://…jpg or png — fallback poster if you add video"
                  className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl h-12 flex-1"
                />
                <button
                  type="button"
                  className="h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">GIF (optional)</label>
              <Input
                value={form.gif_url}
                onChange={(e) => setForm({ ...form, gif_url: e.target.value })}
                placeholder="Direct .gif URL (e.g. from Giphy → copy image address)"
                className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl h-12"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Short video (optional)</label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="Direct .mp4 URL (shown above the fold; image used as poster)"
                className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl h-12"
              />
            </div>
          </div>
        </div>

        {/* Impact Section */}
        <div className="bg-[#13131A] rounded-2xl border border-emerald-500/20 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span className="text-sm font-semibold text-emerald-300">Impact Statement</span>
            {form.impact_statement && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1 ml-auto">
                <Sparkles className="w-2.5 h-2.5" /> AI suggested
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-2">What will $1 achieve?</p>
          <Input
            value={form.impact_statement}
            onChange={(e) => setForm({ ...form, impact_statement: e.target.value })}
            placeholder="e.g., Plants one tree seedling in a deforested area"
            maxLength={80}
            className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500/50 rounded-xl h-12"
          />
          <div className="text-right text-xs text-slate-600 mt-1">{form.impact_statement.length}/80</div>
        </div>

        <div className="bg-[#13131A] rounded-2xl border border-white/5 p-5 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_nsfw}
              onChange={(e) => setForm({ ...form, is_nsfw: e.target.checked })}
              className="mt-1 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/40"
            />
            <div>
              <span className="text-sm font-semibold text-white">Mature or sensitive content (NSFW)</span>
              <p className="text-xs text-slate-500 mt-1">
                Mark if this fundraiser includes nudity, graphic medical imagery, violence, or other material that
                should stay behind the NSFW filter for users who keep it on (default).
              </p>
            </div>
          </label>
        </div>

        {/* Live Preview Card */}
        {showPreview && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-300">Live Preview</span>
            </div>
            <div className="bg-[#13131A] rounded-2xl border border-white/5 overflow-hidden">
              <div className="relative h-40 overflow-hidden bg-black">
                {form.video_url.trim() ? (
                  <video
                    src={form.video_url.trim()}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                    poster={form.image_url || undefined}
                  />
                ) : form.gif_url.trim() ? (
                  <img
                    src={form.gif_url.trim()}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={
                      form.image_url ||
                      'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=1200&q=80'
                    }
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#13131A] via-transparent to-transparent pointer-events-none" />
                {selectedCategory && (
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r ${selectedCategory.gradient} text-white`}>
                      {selectedCategory.label}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-base font-bold text-white mb-1 line-clamp-1">
                  {form.title || 'Your Campaign Title'}
                </h3>
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                  {form.description || 'Your campaign description will appear here...'}
                </p>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-emerald-400">$0</span>
                    <span className="text-slate-500">of ${form.goal_amount.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> 0 donors
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="w-3 h-3" /> 0 shares
                  </span>
                  <span className="font-semibold text-violet-400">0%</span>
                </div>
                {form.impact_statement && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-emerald-400" />
                      $1 = {form.impact_statement}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="space-y-3">
          <Button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-lg py-7 rounded-2xl shadow-2xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all border-0"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isEditMode ? 'Publishing…' : 'Launching...'}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {isEditMode ? 'Publish' : 'Launch Campaign'}
              </div>
            )}
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            variant="outline"
            className="w-full !bg-transparent border-white/10 text-slate-300 hover:border-violet-500/30 hover:text-white py-6 rounded-2xl transition-all"
          >
            {isEditMode ? 'Save draft' : 'Save Draft'}
          </Button>
        </div>
      </div>
    </div>
  );
}

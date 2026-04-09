import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { toast } from 'sonner';
import {
  ArrowLeft, Sparkles, ImagePlus, Upload, Clock, DollarSign,
  Eye, User, Heart, Users, Share2,
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

const categories = [
  { value: 'environment', label: 'Environment', emoji: '🌱', gradient: 'from-emerald-500 to-green-600' },
  { value: 'health', label: 'Health', emoji: '❤️', gradient: 'from-rose-500 to-pink-600' },
  { value: 'education', label: 'Education', emoji: '📚', gradient: 'from-blue-500 to-indigo-600' },
  { value: 'food', label: 'Food', emoji: '🍲', gradient: 'from-amber-500 to-orange-600' },
  { value: 'animals', label: 'Animals', emoji: '🐾', gradient: 'from-purple-500 to-violet-600' },
];

const durations = [
  { value: 7, label: '1 Week' },
  { value: 14, label: '2 Weeks' },
  { value: 30, label: '1 Month' },
  { value: 60, label: '2 Months' },
  { value: 90, label: '3 Months' },
];

export default function CreateCampaign() {
  const { user: authUser, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    goal_amount: 1000,
    duration: 30,
    image_url: '',
    impact_statement: '',
  });

  const user = USE_MOCK_DATA ? MOCK_USER : authUser;
  const isLoading = USE_MOCK_DATA ? false : authLoading;

  // Auto-show preview when enough fields are filled
  useEffect(() => {
    if (form.title && form.description && form.category) {
      setShowPreview(true);
    }
  }, [form.title, form.description, form.category]);

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
      const result = await client.ai.gentxt({
        messages: [
          {
            role: 'system',
            content: `You are a campaign creation assistant for Dolli, a micro-donation platform. Generate campaign details based on the user's description. Return ONLY valid JSON with these fields:
{
  "title": "compelling campaign title (max 60 chars)",
  "description": "engaging description (max 200 chars)",
  "category": "one of: environment, health, education, food, animals",
  "goal_amount": number between 500 and 10000,
  "impact_statement": "what $1 will achieve (max 80 chars)"
}`,
          },
          {
            role: 'user',
            content: aiPrompt,
          },
        ],
        model: 'deepseek-v3.2',
        stream: false,
      });

      const content = result?.data?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setForm((prev) => ({
          ...prev,
          title: parsed.title || prev.title,
          description: parsed.description || prev.description,
          category: parsed.category || prev.category,
          goal_amount: parsed.goal_amount || prev.goal_amount,
          impact_statement: parsed.impact_statement || prev.impact_statement,
        }));
        toast.success('AI generated your campaign details!');
      }
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || 'AI generation failed';
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
          image_url: form.image_url || 'https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/7ca7266f-afd2-4e00-8277-3b67d9410f95.png',
          status: isDraft ? 'draft' : 'active',
          urgency_level: 'medium',
          featured: false,
        },
      });
      toast.success(isDraft ? 'Campaign saved as draft!' : 'Campaign launched successfully! 🚀');
      navigate(isDraft ? '/profile' : `/campaign/${response?.data?.id}`);
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || 'Failed to create campaign';
      toast.error(detail);
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
            <h1 className="text-2xl font-bold">Create Campaign</h1>
            <p className="text-sm text-slate-500">AI-assisted campaign builder</p>
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
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              <ImagePlus className="w-3.5 h-3.5 inline mr-1 text-blue-400" />
              Cover Image
            </label>
            <div className="flex gap-2">
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="Paste image URL or leave empty for default"
                className="bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-violet-500/50 rounded-xl h-12 flex-1"
              />
              <button className="h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all flex items-center gap-2 text-sm">
                <Upload className="w-4 h-4" />
              </button>
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

        {/* Live Preview Card */}
        {showPreview && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-300">Live Preview</span>
            </div>
            <div className="bg-[#13131A] rounded-2xl border border-white/5 overflow-hidden">
              <div className="relative h-40 overflow-hidden">
                <img
                  src={form.image_url || 'https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/7ca7266f-afd2-4e00-8277-3b67d9410f95.png'}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#13131A] via-transparent to-transparent" />
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
                Launching...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Launch Campaign
              </div>
            )}
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            variant="outline"
            className="w-full !bg-transparent border-white/10 text-slate-300 hover:border-violet-500/30 hover:text-white py-6 rounded-2xl transition-all"
          >
            Save Draft
          </Button>
        </div>
      </div>
    </div>
  );
}

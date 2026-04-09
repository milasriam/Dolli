import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { toast } from 'sonner';
import {
  Heart, Share2, Users, Clock, ArrowLeft, ExternalLink,
  Copy, CheckCircle2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    halyk?: {
      pay: (paymentObject: Record<string, unknown>) => void;
    };
  }
}

interface Campaign {
  id: number;
  title: string;
  description: string;
  category: string;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  share_count: number;
  click_count: number;
  image_url: string;
  status: string;
  urgency_level: string;
  featured: boolean;
  created_at: string;
}

type PaymentProvider = 'halyk_epay' | 'kaspi_pay';

const TIKTOK_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.28 8.28 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.28z" />
  </svg>
);

const INSTAGRAM_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load payment script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load payment script'));
    document.body.appendChild(script);
  });
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, login } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('halyk_epay');

  const referrer = searchParams.get('ref');

  useEffect(() => {
    loadCampaign();
    if (referrer) {
      trackClick();
    }
  }, [id]);

  const loadCampaign = async () => {
    try {
      const response = await client.entities.campaigns.get({ id: id! });
      setCampaign(response?.data);
    } catch (err) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  const trackClick = async () => {
    try {
      await client.apiCall.invoke({
        url: '/api/v1/analytics/track-click',
        method: 'POST',
        data: {},
        options: { params: { referral_token: referrer } },
      });
    } catch {
      // silent
    }
  };

  const handleDonate = async (amount: number = 1) => {
    if (!user) {
      login();
      return;
    }

    setDonating(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/payment/create_payment_session',
        method: 'POST',
        data: {
          campaign_id: Number(id),
          amount,
          referral_token: referrer || '',
          source_platform: referrer ? 'referral' : 'direct',
          provider: selectedProvider,
        },
      });

      const { action, url, payment_payload, invoice_id, provider, message } = response.data;

      if (message) {
        toast.success(message);
      }

      if (action === 'halyk_form') {
        const scriptUrl = payment_payload?.script_url;
        const paymentObject = payment_payload?.payment_object;

        if (!scriptUrl || !paymentObject) {
          throw new Error('Halyk payment payload is incomplete');
        }

        await loadScript(scriptUrl);
        if (!window.halyk?.pay) {
          throw new Error('Halyk payment form is unavailable');
        }

        window.halyk.pay(paymentObject);
        return;
      }

      if (url) {
        const destination = new URL(url, window.location.origin);
        if (invoice_id) {
          destination.searchParams.set('invoice_id', invoice_id);
        }
        if (provider) {
          destination.searchParams.set('provider', provider);
        }
        destination.searchParams.set('campaign_id', String(id));
        client.utils.openUrl(destination.toString());
        return;
      }

      throw new Error('Payment action was not returned by the server');
    } catch (err: any) {
      const detail = err?.data?.detail || err?.response?.data?.detail || err?.message || 'Payment failed';
      toast.error(detail);
    } finally {
      setDonating(false);
    }
  };

  const handleShare = async (platform: string) => {
    if (!user) {
      login();
      return;
    }
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/analytics/create-referral',
        method: 'POST',
        data: { campaign_id: Number(id), platform },
      });
      const { share_url } = response.data;
      const fullUrl = `${window.location.origin}${share_url}`;
      const text = `I just donated to "${campaign?.title}" on Dolli. Join me!`;

      if (platform === 'tiktok') {
        window.open(`https://www.tiktok.com/share?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(text)}`, '_blank');
      } else if (platform === 'instagram') {
        await navigator.clipboard.writeText(`${text}\n${fullUrl}`);
        toast.success('Link copied! Share it on Instagram Stories or your bio.');
      } else if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl)}`, '_blank');
      } else {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || 'Failed to create share link';
      toast.error(detail);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white">
        <Header />
        <div className="pt-24 text-center">
          <h2 className="text-2xl font-bold mb-4">Campaign Not Found</h2>
          <Link to="/" className="text-violet-400 hover:text-violet-300">Go Home</Link>
        </div>
      </div>
    );
  }

  const progress = Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      <div className="pt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </Link>

        {referrer && (
          <div className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <p className="text-sm text-violet-300">
              You were invited by a friend! Your donation helps reach the goal faster.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl overflow-hidden border border-white/5">
              <img
                src={campaign.image_url}
                alt={campaign.title}
                className="w-full h-64 sm:h-80 object-cover"
              />
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">{campaign.title}</h1>
              <p className="text-slate-400 leading-relaxed text-lg">{campaign.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#13131A] rounded-xl p-4 border border-white/5 text-center">
                <Users className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{campaign.donor_count.toLocaleString()}</div>
                <div className="text-xs text-slate-500">Donors</div>
              </div>
              <div className="bg-[#13131A] rounded-xl p-4 border border-white/5 text-center">
                <Share2 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{campaign.share_count.toLocaleString()}</div>
                <div className="text-xs text-slate-500">Shares</div>
              </div>
              <div className="bg-[#13131A] rounded-xl p-4 border border-white/5 text-center">
                <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{Math.round(progress)}%</div>
                <div className="text-xs text-slate-500">Funded</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24 bg-[#13131A] rounded-2xl border border-white/5 p-6 space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-2xl font-bold text-emerald-400">
                    ${campaign.raised_amount.toLocaleString()}
                  </span>
                  <span className="text-slate-500 text-sm mt-2">
                    of ${campaign.goal_amount.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {campaign.donor_count.toLocaleString()} people have donated
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Payment method</p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('halyk_epay')}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedProvider === 'halyk_epay'
                        ? 'border-emerald-400 bg-emerald-500/10 text-white'
                        : 'border-white/10 bg-[#1A1A25] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="font-medium">Halyk EPAY</div>
                    <div className="text-xs text-slate-400">Cards, Apple Pay and Google Pay through the payment gateway</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('kaspi_pay')}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      selectedProvider === 'kaspi_pay'
                        ? 'border-emerald-400 bg-emerald-500/10 text-white'
                        : 'border-white/10 bg-[#1A1A25] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="font-medium">Kaspi Pay</div>
                    <div className="text-xs text-slate-400">Remote Kaspi payment link for Kazakhstan-first checkout</div>
                  </button>
                </div>
              </div>

              <Button
                onClick={() => handleDonate(1)}
                disabled={donating}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-lg py-7 rounded-2xl shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all border-0"
              >
                {donating ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Heart className="w-5 h-5 mr-2 fill-white" />
                    Donate ${selectedProvider === 'kaspi_pay' ? 'with Kaspi' : '1'}
                  </>
                )}
              </Button>

              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 25].map((amount) => (
                  <Button
                    key={amount}
                    onClick={() => handleDonate(amount)}
                    disabled={donating}
                    variant="outline"
                    className="!bg-transparent border-white/10 text-white hover:border-emerald-500/50 hover:text-emerald-400 rounded-xl transition-all"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>

              <p className="text-xs text-slate-500">
                {selectedProvider === 'halyk_epay'
                  ? 'Halyk EPAY opens a secure hosted payment form and returns you to Dolli after payment.'
                  : 'Kaspi Pay currently opens a remote payment link. Final confirmation is handled after merchant-side payment confirmation.'}
              </p>

              <div className="border-t border-white/5 pt-5">
                <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-violet-400" />
                  Share & Help Reach Goal Faster
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleShare('tiktok')}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-all"
                  >
                    {TIKTOK_ICON}
                    TikTok
                  </button>
                  <button
                    onClick={() => handleShare('instagram')}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
                  >
                    {INSTAGRAM_ICON}
                    Instagram
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Twitter / X
                  </button>
                  <button
                    onClick={() => handleShare('copy')}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1A1A25] border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-all"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

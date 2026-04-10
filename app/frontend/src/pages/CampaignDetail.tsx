import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { isPaymentsEnabled } from '@/lib/featureFlags';
import { ShareCampaignDialog } from '@/components/ShareCampaignDialog';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { OwnerCampaignControls } from '@/components/OwnerCampaignControls';
import { fetchCampaignOrganizerInsights, type CampaignOrganizerInsights } from '@/lib/campaignOrganizerInsights';
import { toast } from 'sonner';
import {
  Heart, Share2, Users, Clock, ArrowLeft,
  Sparkles, UserCircle, Gift, Megaphone, ShieldCheck,
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
  user_id: string;
  title: string;
  description: string;
  category: string;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  share_count: number;
  click_count: number;
  image_url: string | null;
  gif_url?: string | null;
  video_url?: string | null;
  status: string;
  urgency_level: string;
  featured: boolean;
  created_at: string;
  is_nsfw?: boolean;
  nsfw_content_hidden?: boolean;
}

type PaymentProvider = 'halyk_epay' | 'kaspi_pay';

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
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('halyk_epay');
  const [organizerInsights, setOrganizerInsights] = useState<CampaignOrganizerInsights | null>(null);

  const referrer = searchParams.get('ref');

  useEffect(() => {
    void loadCampaign();
    if (referrer) {
      trackClick();
    }
  }, [id, user?.nsfw_filter_enabled]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const cid = Number(id);
    if (!Number.isFinite(cid)) return;
    fetchCampaignOrganizerInsights(cid).then((data) => {
      if (!cancelled) setOrganizerInsights(data);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadCampaign = async () => {
    try {
      const response = await client.entities.campaigns.get({ id: id! });
      setCampaign(response?.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) setCampaign(null);
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
    if (campaign?.nsfw_content_hidden) {
      toast.error('Turn off the NSFW filter in your profile to donate to this fundraiser.');
      return;
    }
    if (!isPaymentsEnabled()) {
      toast.info('Payments are not live yet', {
        description: 'We’re finishing checkout — try again soon.',
      });
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
  const nsfwBlocked = Boolean(campaign.nsfw_content_hidden);
  const paymentsLive = isPaymentsEnabled();
  const donateDisabled = donating || nsfwBlocked || !paymentsLive;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      <div className="pt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to campaigns
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShareOpen(true)}
            className="rounded-xl border-violet-500/35 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:text-white border"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>

        <ShareCampaignDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          campaignImageUrl={campaign.image_url}
          raisedAmount={campaign.raised_amount}
          goalAmount={campaign.goal_amount}
          donorCount={campaign.donor_count}
          context="support"
          isAuthenticated={!!user}
          onRequestLogin={login}
          afterTrackedShare={() => void loadCampaign()}
        />

        {referrer && (
          <div className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <p className="text-sm text-violet-300">
              You were invited by a friend! Your donation helps reach the goal faster.
            </p>
          </div>
        )}

        {user && campaign.user_id === user.id && (
          <OwnerCampaignControls
            layout="banner"
            campaign={{
              id: campaign.id,
              title: campaign.title,
              status: campaign.status,
              raised_amount: campaign.raised_amount,
              donor_count: campaign.donor_count,
            }}
            onChanged={() => {
              void loadCampaign();
            }}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl overflow-hidden border border-white/5 bg-black">
              {campaign.video_url ? (
                <video
                  src={campaign.video_url}
                  controls
                  playsInline
                  className="w-full h-64 sm:h-80 object-cover"
                  poster={campaign.image_url || undefined}
                />
              ) : campaign.gif_url ? (
                <img
                  src={campaign.gif_url}
                  alt=""
                  className="w-full h-64 sm:h-80 object-cover"
                />
              ) : campaign.image_url ? (
                <img
                  src={campaign.image_url}
                  alt={campaign.title}
                  className="w-full h-64 sm:h-80 object-cover"
                />
              ) : (
                <div className="w-full h-64 sm:h-80 flex items-center justify-center bg-[#13131A] text-slate-500 text-sm">
                  No preview image
                </div>
              )}
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">{campaign.title}</h1>
              <p className="text-slate-400 leading-relaxed text-lg">{campaign.description}</p>
            </div>

            {organizerInsights && (
              <div className="rounded-2xl border border-white/10 bg-[#13131A] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-7 h-7 text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Organizer
                    </p>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <p className="text-lg font-semibold text-white truncate">
                        {organizerInsights.display_name || 'Community member'}
                      </p>
                      {organizerInsights.is_verified_organization &&
                        organizerInsights.organization_badge_label && (
                          <span className="inline-flex items-center gap-1 shrink-0 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                            {organizerInsights.organization_badge_label}
                          </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {organizerInsights.is_verified_organization
                        ? 'This organizer is a verified organization on Dolli.'
                        : 'Public activity on Dolli — helps you see who is behind this fundraiser.'}
                    </p>
                    <div
                      className={`mt-4 grid grid-cols-1 gap-3 ${
                        organizerInsights.paid_donations_count != null ? 'sm:grid-cols-2' : ''
                      }`}
                    >
                      {organizerInsights.paid_donations_count != null && (
                        <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 flex gap-3">
                          <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center flex-shrink-0">
                            <Gift className="w-4 h-4 text-pink-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {organizerInsights.paid_donations_count === 0
                                ? 'No completed gifts yet'
                                : `${organizerInsights.paid_donations_count} completed gift${organizerInsights.paid_donations_count === 1 ? '' : 's'}`}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {organizerInsights.paid_donations_count === 0
                                ? 'They haven’t finished a paid donation on Dolli (yet).'
                                : 'Paid donations they’ve made to any campaign on Dolli.'}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 flex gap-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {organizerInsights.campaigns_created_total} fundraiser
                            {organizerInsights.campaigns_created_total === 1 ? '' : 's'} created
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            {organizerInsights.campaigns_active_count} live now
                            {organizerInsights.campaigns_created_total !== organizerInsights.campaigns_active_count
                              ? ` · ${organizerInsights.campaigns_created_total - organizerInsights.campaigns_active_count} draft or ended`
                              : ''}
                            .
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
              {nsfwBlocked && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <p className="font-semibold text-white mb-1">Sensitive fundraiser</p>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    Your NSFW filter is on. Open{' '}
                    <Link to="/profile" className="underline font-semibold text-white hover:text-amber-50">
                      profile settings
                    </Link>{' '}
                    and turn the filter off to see the full page and donate.
                  </p>
                </div>
              )}
              {!paymentsLive && (
                <div className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  <p className="font-semibold text-white mb-1">Checkout coming soon</p>
                  <p className="text-xs text-sky-200/90 leading-relaxed">
                    Card and wallet payments are not connected on this environment yet. You can still explore
                    campaigns and share them — donations will open here shortly.
                  </p>
                </div>
              )}
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

              <div
                className={`space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4 ${
                  !paymentsLive ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
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
                disabled={donateDisabled}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-lg py-7 rounded-2xl shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all border-0"
              >
                {donating ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Heart className="w-5 h-5 mr-2 fill-white" />
                    {!paymentsLive
                      ? 'Payments soon'
                      : selectedProvider === 'kaspi_pay'
                        ? 'Donate with Kaspi'
                        : 'Donate $1'}
                  </>
                )}
              </Button>

              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 25].map((amount) => (
                  <Button
                    key={amount}
                    onClick={() => handleDonate(amount)}
                    disabled={donateDisabled}
                    variant="outline"
                    className="!bg-transparent border-white/10 text-white hover:border-emerald-500/50 hover:text-emerald-400 rounded-xl transition-all"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>

              <p className="text-xs text-slate-500">
                {!paymentsLive
                  ? 'When payments go live, you’ll complete checkout in a few taps from this page.'
                  : selectedProvider === 'halyk_epay'
                    ? 'Halyk EPAY opens a secure hosted payment form and returns you to Dolli after payment.'
                    : 'Kaspi Pay currently opens a remote payment link. Final confirmation is handled after merchant-side payment confirmation.'}
              </p>

              <div className="border-t border-white/5 pt-5">
                <p className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-violet-400" />
                  Multiply the impact
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Native share, WhatsApp, Telegram, QR, and more — with a personal link when you’re signed in.
                </p>
                <Button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600/90 to-pink-600/90 hover:from-violet-500 hover:to-pink-500 text-white font-semibold border-0 py-6 shadow-lg shadow-violet-500/15"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Open share studio
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

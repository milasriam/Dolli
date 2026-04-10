import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { client } from '@/lib/api';
import { isPaymentsEnabled } from '@/lib/featureFlags';
import { ShareCampaignDialog } from '@/components/ShareCampaignDialog';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { OwnerCampaignControls } from '@/components/OwnerCampaignControls';
import { CampaignHeroMedia } from '@/components/CampaignHeroMedia';
import { fetchCampaignOrganizerInsights, type CampaignOrganizerInsights } from '@/lib/campaignOrganizerInsights';
import { fetchFollowStatus, setFollowing } from '@/lib/follows';
import { organizerPromoCardClass } from '@/lib/curatedHighlight';
import { trackClientEvent } from '@/lib/productAnalytics';
import { toast } from 'sonner';
import {
  Heart, Share2, Users, Clock, ArrowLeft,
  Sparkles, UserCircle, Gift, Megaphone, ShieldCheck,
  Smartphone, Copy, X,   UserPlus, UserCheck, HeartHandshake,
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

const GIFT_AMOUNTS = [1, 3, 5, 10, 25] as const;

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
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('halyk_epay');
  const [organizerInsights, setOrganizerInsights] = useState<CampaignOrganizerInsights | null>(null);
  const [lastFeeBps, setLastFeeBps] = useState<number | null>(null);
  const [showPostPublish, setShowPostPublish] = useState(false);
  const [followingOrganizer, setFollowingOrganizer] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [giftAmount, setGiftAmount] = useState(1);

  const referrer = searchParams.get('ref');
  const fromCreate = searchParams.get('from') === 'create';

  useEffect(() => {
    void loadCampaign();
    if (referrer) {
      trackClick();
    }
  }, [id, user?.nsfw_filter_enabled]);

  useEffect(() => {
    setGiftAmount(1);
  }, [id]);

  useEffect(() => {
    if (campaign && fromCreate && user?.id === campaign.user_id) {
      setShowPostPublish(true);
      trackClientEvent('campaign_post_publish_view', { campaign_id: campaign.id });
    } else {
      setShowPostPublish(false);
    }
  }, [campaign, fromCreate, user?.id]);

  useEffect(() => {
    if (campaign?.title) {
      document.title = `${campaign.title} · Dolli`;
    }
    return () => {
      document.title = 'Dolli — Social-Native Micro-Donation Engine';
    };
  }, [campaign?.title]);

  useEffect(() => {
    setLastFeeBps(null);
  }, [selectedProvider]);

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
  }, [id, user?.id]);

  useEffect(() => {
    if (!campaign || !user || user.id === campaign.user_id) {
      setFollowingOrganizer(null);
      return;
    }
    let cancelled = false;
    void fetchFollowStatus(campaign.user_id).then((r) => {
      if (!cancelled) setFollowingOrganizer(r?.following ?? false);
    });
    return () => {
      cancelled = true;
    };
  }, [campaign?.user_id, user?.id]);

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

  const toggleFollowOrganizer = async () => {
    if (!user || !campaign || followingOrganizer === null) return;
    setFollowBusy(true);
    try {
      const next = !followingOrganizer;
      await setFollowing(campaign.user_id, next);
      setFollowingOrganizer(next);
      toast.success(
        next
          ? 'You’ll see their new fundraisers in Following and notifications.'
          : 'Unfollowed this organizer.',
      );
      const cid = Number(id);
      if (Number.isFinite(cid)) {
        const data = await fetchCampaignOrganizerInsights(cid);
        if (data) setOrganizerInsights(data);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update subscription');
    } finally {
      setFollowBusy(false);
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

    trackClientEvent('donate_click', {
      campaign_id: Number(id),
      amount,
      provider: selectedProvider,
    });

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
      const bps = (response.data as { platform_fee_bps?: number }).platform_fee_bps;
      if (typeof bps === 'number') setLastFeeBps(bps);

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
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div id="main-content" tabIndex={-1} className="flex items-center justify-center pt-24 outline-none">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div id="main-content" tabIndex={-1} className="pt-24 text-center outline-none">
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
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pb-16 pt-20 outline-none sm:px-6 lg:px-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to campaigns
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShareOpen(true)}
            className="rounded-xl border-violet-500/35 bg-violet-500/10 text-violet-800 hover:bg-violet-500/15 hover:text-violet-950 dark:text-violet-200 dark:hover:bg-violet-500/20 dark:hover:text-white"
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

        {showPostPublish && campaign && (
          <div className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-muted/70 p-5 dark:border-emerald-500/35 dark:bg-gradient-to-br dark:from-emerald-950/40 dark:to-violet-950/30">
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                setShowPostPublish(false);
                navigate(`/campaign/${campaign.id}`, { replace: true });
              }}
              className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="pr-8 text-lg font-bold text-foreground">You’re live — now spread the word</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Share links use rich previews. Add a strong cover photo or short video if you haven’t yet.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 mb-4 list-disc list-inside">
              <li>Open “Share it your way” below for every social format</li>
              <li>Copy your public link from the share dialog</li>
              <li>On iPhone: Share → Add to Home Screen for an app-like shortcut (PWA)</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setShareOpen(true)}
                className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share it your way
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-border bg-background text-foreground hover:bg-muted/60"
                onClick={async () => {
                  const u = `${window.location.origin}/api/share/campaign/${campaign.id}`;
                  await navigator.clipboard.writeText(u);
                  toast.success('Share link copied — great for bios and DMs');
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy share link
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Smartphone className="w-3.5 h-3.5" />
              Tip: installed Dolli from the browser feels faster on the next visit.
            </p>
          </div>
        )}

        {referrer && (
          <div className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <p className="text-sm text-violet-800 dark:text-violet-300">
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
            <div className="rounded-2xl overflow-hidden border border-border bg-black">
              <CampaignHeroMedia
                videoUrl={campaign.video_url}
                gifUrl={campaign.gif_url}
                imageUrl={campaign.image_url}
                title={campaign.title}
              />
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">{campaign.title}</h1>
              <p className="text-muted-foreground leading-relaxed text-lg">{campaign.description}</p>
            </div>

            {organizerInsights && (
              <div
                className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${organizerPromoCardClass(
                  organizerInsights.curated_highlight as 'frame' | 'featured' | null | undefined,
                )}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-7 h-7 text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Organizer
                    </p>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">
                        {organizerInsights.display_name || 'Community member'}
                      </p>
                      {organizerInsights.is_verified_organization &&
                        organizerInsights.organization_badge_label && (
                          <span className="inline-flex items-center gap-1 shrink-0 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                            {organizerInsights.organization_badge_label}
                          </span>
                        )}
                      {organizerInsights.curated_badge_label && (
                        <span
                          className="inline-flex items-center gap-1 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200"
                          title="Recognized by Dolli for helping grow the platform."
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden />
                          {organizerInsights.curated_badge_label}
                        </span>
                      )}
                      {organizerInsights.viewer_friends_with_organizer && (
                        <span
                          className="inline-flex items-center gap-1 shrink-0 rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200"
                          title="You follow each other on Dolli."
                        >
                          <HeartHandshake className="w-3.5 h-3.5 text-sky-300" aria-hidden />
                          Friends
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {organizerInsights.is_verified_organization
                        ? 'This organizer is a verified organization on Dolli.'
                        : 'Public activity on Dolli — helps you see who is behind this fundraiser.'}
                      {organizerInsights.curated_badge_label
                        ? ' The platform badge highlights early partners and other supporters you can trust as Dolli grows.'
                        : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-muted-foreground">
                          {(organizerInsights.organizer_follower_count ?? 0).toLocaleString()}
                        </span>{' '}
                        follower{(organizerInsights.organizer_follower_count ?? 0) === 1 ? '' : 's'} on Dolli
                      </p>
                      {user && campaign.user_id !== user.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant={followingOrganizer ? 'outline' : 'default'}
                          disabled={followBusy || followingOrganizer === null}
                          onClick={() => void toggleFollowOrganizer()}
                          className={
                            followingOrganizer
                              ? 'h-9 rounded-lg border-border bg-transparent text-foreground hover:bg-muted/70'
                              : 'rounded-lg bg-violet-600 hover:bg-violet-500 text-white border-0 h-9'
                          }
                        >
                          {followingOrganizer ? (
                            <>
                              <UserCheck className="w-4 h-4 mr-1.5" />
                              Following
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-1.5" />
                              Follow
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <div
                      className={`mt-4 grid grid-cols-1 gap-3 ${
                        organizerInsights.paid_donations_count != null ? 'sm:grid-cols-2' : ''
                      }`}
                    >
                      {organizerInsights.paid_donations_count != null && (
                        <div className="flex gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
                          <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center flex-shrink-0">
                            <Gift className="w-4 h-4 text-pink-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {organizerInsights.paid_donations_count === 0
                                ? 'No completed gifts yet'
                                : `${organizerInsights.paid_donations_count} completed gift${organizerInsights.paid_donations_count === 1 ? '' : 's'}`}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {organizerInsights.paid_donations_count === 0
                                ? 'They haven’t finished a paid donation on Dolli (yet).'
                                : 'Paid donations they’ve made to any campaign on Dolli.'}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {organizerInsights.campaigns_created_total} fundraiser
                            {organizerInsights.campaigns_created_total === 1 ? '' : 's'} created
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
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
              <div className="bg-card rounded-xl p-4 border border-border text-center">
                <Users className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{campaign.donor_count.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Donors</div>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border text-center">
                <Share2 className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{campaign.share_count.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Shares</div>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border text-center">
                <Clock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <div className="text-xl font-bold">{Math.round(progress)}%</div>
                <div className="text-xs text-muted-foreground">Funded</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h2 id="give-panel-heading" className="sr-only">
              Donate and share this fundraiser
            </h2>
            <div
              className="sticky top-24 space-y-6 rounded-2xl border border-border bg-card p-6"
              aria-labelledby="give-panel-heading"
            >
              {nsfwBlocked && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="mb-1 font-semibold text-amber-950 dark:text-white">Sensitive fundraiser</p>
                  <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                    Your NSFW filter is on. Open{' '}
                    <Link
                      to="/profile"
                      className="font-semibold text-amber-950 underline hover:text-amber-800 dark:text-white dark:hover:text-amber-50"
                    >
                      profile settings
                    </Link>{' '}
                    and turn the filter off to see the full page and donate.
                  </p>
                </div>
              )}
              {!paymentsLive && (
                <div className="rounded-xl border border-sky-500/40 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100">
                  <p className="mb-1 font-semibold text-sky-950 dark:text-white">Checkout coming soon</p>
                  <p className="text-xs leading-relaxed text-sky-900/90 dark:text-sky-200/90">
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
                  <span className="text-muted-foreground text-sm mt-2">
                    of ${campaign.goal_amount.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {campaign.donor_count.toLocaleString()} people have donated
                </p>
              </div>

              {paymentsLive && lastFeeBps != null && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Transparency: a platform fee of up to {(lastFeeBps / 100).toFixed(1)}% is recorded on the organizer
                  side at checkout. The amount you choose to give is unchanged.
                </p>
              )}

              <div
                className={`space-y-3 rounded-2xl border border-border bg-muted/60 p-4 dark:bg-black/20 ${
                  !paymentsLive ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <p className="text-sm font-semibold text-foreground" id="gift-amount-label">
                  Choose amount
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Micro-gifts stay impulse-sized — like a super-like, but it funds real work. Change any time before you
                  pay.
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-labelledby="gift-amount-label"
                >
                  {GIFT_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      aria-checked={giftAmount === amt}
                      role="radio"
                      disabled={donateDisabled}
                      onClick={() => setGiftAmount(amt)}
                      className={`min-h-11 min-w-[3.25rem] rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50 ${
                        giftAmount === amt
                          ? 'border-emerald-500 bg-emerald-600/15 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-white'
                          : 'border-border bg-muted text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <p className="text-sm font-semibold text-foreground" id="payment-method-label">
                  Payment method
                </p>
                <div className="grid grid-cols-1 gap-2" role="group" aria-labelledby="payment-method-label">
                  <button
                    type="button"
                    aria-pressed={selectedProvider === 'halyk_epay'}
                    onClick={() => setSelectedProvider('halyk_epay')}
                    className={`min-h-12 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                      selectedProvider === 'halyk_epay'
                        ? 'border-emerald-500 bg-emerald-600/15 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-white'
                        : 'border-border bg-muted text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium">Halyk EPAY</div>
                    <div className="text-xs text-muted-foreground">Cards, Apple Pay and Google Pay through the payment gateway</div>
                  </button>
                  <button
                    type="button"
                    aria-pressed={selectedProvider === 'kaspi_pay'}
                    onClick={() => setSelectedProvider('kaspi_pay')}
                    className={`min-h-12 rounded-xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                      selectedProvider === 'kaspi_pay'
                        ? 'border-emerald-500 bg-emerald-600/15 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-500/10 dark:text-white'
                        : 'border-border bg-muted text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium">Kaspi Pay</div>
                    <div className="text-xs text-muted-foreground">Remote Kaspi payment link for Kazakhstan-first checkout</div>
                  </button>
                </div>
              </div>

              {campaign.donor_count > 0 && paymentsLive && !nsfwBlocked && (
                <p className="text-center text-[11px] text-muted-foreground">
                  <span className="font-semibold text-muted-foreground">
                    {campaign.donor_count.toLocaleString()} people
                  </span>{' '}
                  already chipped in — mostly small amounts. You’re not doing this alone.
                </p>
              )}

              <Button
                onClick={() => handleDonate(giftAmount)}
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
                        ? `Send $${giftAmount} · Kaspi`
                        : `Send $${giftAmount}`}
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                {paymentsLive
                  ? 'Checkout opens on your bank’s page — Dolli never stores your card. No subscription, no guilt-trip upsell.'
                  : 'When payments go live, you’ll finish in a few taps and land right back here.'}
              </p>

              <p className="text-xs text-muted-foreground">
                {!paymentsLive
                  ? 'When payments go live, you’ll complete checkout in a few taps from this page.'
                  : selectedProvider === 'halyk_epay'
                    ? 'Halyk EPAY opens a secure hosted payment form and returns you to Dolli after payment.'
                    : 'Kaspi Pay currently opens a remote payment link. Final confirmation is handled after merchant-side payment confirmation.'}
              </p>

              <div className="border-t border-border pt-5">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Share2 className="w-4 h-4 text-violet-400" />
                  Multiply the impact
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Same energy as reposting a story — but friends land with your link so impact can compound.
                </p>
                <Button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600/90 to-pink-600/90 hover:from-violet-500 hover:to-pink-500 text-white font-semibold border-0 py-6 shadow-lg shadow-violet-500/15"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share it your way
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

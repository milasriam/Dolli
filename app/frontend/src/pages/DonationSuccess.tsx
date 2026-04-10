import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';
import { ShareCampaignDialog } from '@/components/ShareCampaignDialog';
import { toast } from 'sonner';
import { Heart, Share2, Trophy, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';
import { trackClientEvent } from '@/lib/productAnalytics';

const MAX_VERIFY_ROUNDS = 20;

interface Campaign {
  id: number;
  title: string;
  image_url: string;
  raised_amount: number;
  goal_amount: number;
  donor_count: number;
}

type PaymentState = 'verifying' | 'paid' | 'pending' | 'failed' | 'error';

export default function DonationSuccess() {
  const [searchParams] = useSearchParams();
  const { user, login } = useAuth();
  const invoiceId = searchParams.get('invoice_id') || searchParams.get('session_id');
  const provider = searchParams.get('provider') || 'halyk_epay';
  const campaignId = searchParams.get('campaign_id');
  const initialStatus = searchParams.get('status');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentState>(() => {
    if (initialStatus === 'failed') return 'failed';
    if (invoiceId) return 'verifying';
    return 'error';
  });
  const [verifyStalled, setVerifyStalled] = useState(false);
  const [verifyAttempt, setVerifyAttempt] = useState(0);
  const [verifyPass, setVerifyPass] = useState(0);
  const paidTracked = useRef(false);

  useEffect(() => {
    if (campaignId) {
      void loadCampaign();
    }
    if (initialStatus === 'failed') {
      setPaymentStatus('failed');
    }
  }, [campaignId, initialStatus]);

  useEffect(() => {
    if (initialStatus === 'failed') {
      return;
    }
    if (!invoiceId) {
      setPaymentStatus('error');
      return;
    }

    let cancelled = false;

    void (async () => {
      setVerifyStalled(false);
      setPaymentStatus('verifying');
      for (let i = 0; i < MAX_VERIFY_ROUNDS && !cancelled; i++) {
        if (!cancelled) setVerifyAttempt(i + 1);
        try {
          const response = await client.apiCall.invoke({
            url: '/api/v1/payment/verify_payment',
            method: 'POST',
            data: { invoice_id: invoiceId, provider },
          });
          const st = (response.data.status as string) || 'pending';
          const rawWait = Number((response.data as { retry_after_seconds?: number }).retry_after_seconds);
          const waitMs = Math.min(30000, Math.max(2000, Number.isFinite(rawWait) ? rawWait * 1000 : 5000));

          if (st === 'paid' || st === 'failed') {
            if (!cancelled) setPaymentStatus(st as PaymentState);
            return;
          }

          if (!cancelled) setPaymentStatus('pending');

          if (i === MAX_VERIFY_ROUNDS - 1) {
            if (!cancelled) setVerifyStalled(true);
            return;
          }

          await new Promise((r) => setTimeout(r, waitMs));
        } catch (err: unknown) {
          const e = err as { data?: { detail?: string }; response?: { data?: { detail?: string } } };
          const detail = e?.data?.detail || e?.response?.data?.detail;
          if (detail) toast.error(String(detail));
          if (!cancelled) setPaymentStatus('error');
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoiceId, provider, initialStatus, verifyPass]);

  useEffect(() => {
    if (paymentStatus !== 'paid' || paidTracked.current) return;
    paidTracked.current = true;
    const cid = campaignId ? Number(campaignId) : NaN;
    trackClientEvent('donate_success', {
      ...(Number.isFinite(cid) ? { campaign_id: cid } : {}),
      ...(invoiceId ? { invoice_id: invoiceId } : {}),
      provider,
    });
  }, [paymentStatus, campaignId, invoiceId, provider]);

  useEffect(() => {
    if (paymentStatus === 'paid') {
      const duration = 3000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#8B5CF6', '#06D6A0', '#F472B6'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#8B5CF6', '#06D6A0', '#F472B6'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [paymentStatus]);

  const loadCampaign = async () => {
    try {
      const response = await client.entities.campaigns.get({ id: campaignId! });
      setCampaign(response?.data);
    } catch {
      // silent
    }
  };

  const progress = campaign ? Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100) : 0;
  const cid = campaignId ? Number(campaignId) : NaN;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-24 outline-none"
      >
        {paymentStatus === 'verifying' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Verifying your donation…</p>
            <p className="text-xs text-muted-foreground mt-2">
              Contacting the payment provider
              {verifyAttempt > 0 ? ` (round ${verifyAttempt} of ${MAX_VERIFY_ROUNDS})` : ''}.
            </p>
          </div>
        )}

        {paymentStatus === 'error' && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">😔</div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">We could not verify your payment yet. Please try again.</p>
            <Link to={`/campaign/${campaignId}`}>
              <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                Back to Campaign
              </Button>
            </Link>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💳</div>
            <h2 className="text-2xl font-bold mb-2">Payment Was Not Completed</h2>
            <p className="text-muted-foreground mb-6">You can return to the campaign and try again with another method.</p>
            <Link to={`/campaign/${campaignId}`}>
              <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                Return to Campaign
              </Button>
            </Link>
          </div>
        )}

        {paymentStatus === 'pending' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-2xl shadow-amber-500/30 mb-4">
                <Heart className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-black mb-2">Donation Is Processing</h1>
              <p className="text-muted-foreground">We are waiting for payment confirmation from {provider === 'kaspi_pay' ? 'Kaspi Pay' : 'Halyk EPAY'}.</p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 text-sm text-muted-foreground space-y-2">
              <p>Invoice: <span className="text-white font-medium">{invoiceId}</span></p>
              <p>Provider: <span className="text-white font-medium">{provider}</span></p>
              <p className="text-muted-foreground">
                {provider === 'kaspi_pay'
                  ? 'Kaspi Pay is currently confirmed manually after payment on the merchant side.'
                  : 'If you just completed the payment, refresh this page in a few seconds.'}
              </p>
            </div>

            {verifyStalled && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-semibold text-white mb-1">Still processing</p>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  We stopped auto-checking after several tries. If you completed payment, use “Check again” — it can take a
                  minute for the bank to confirm.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setVerifyStalled(false);
                  setVerifyPass((p) => p + 1);
                }}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white border-0"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Check again
              </Button>
              <Link to={`/campaign/${campaignId}`} className="flex-1">
                <Button variant="outline" className="w-full !bg-transparent border-border text-white">
                  Back
                </Button>
              </Link>
            </div>
          </div>
        )}

        {paymentStatus === 'paid' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl shadow-emerald-500/30 mb-4">
                <Heart className="w-10 h-10 text-white fill-white" />
              </div>
              <h1 className="text-3xl font-black mb-2">That actually landed 🎉</h1>
              <p className="text-muted-foreground">
                You turned a scroll-moment into fuel for this fundraiser — optional next step: let your people know so
                they can pile on.
              </p>
            </div>

            {campaign && (
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex gap-4">
                  <img
                    src={campaign.image_url}
                    alt={campaign.title}
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{campaign.title}</h3>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-emerald-400 font-bold">${campaign.raised_amount.toLocaleString()}</span>
                        <span className="text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Rewards Earned
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-white/5 border border-border">
                  <div className="text-2xl mb-1">*</div>
                  <div className="text-xs text-muted-foreground">First Dollar</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5 border border-border">
                  <div className="text-2xl mb-1">+</div>
                  <div className="text-xs text-muted-foreground">Streak +1</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5 border border-border">
                  <div className="text-2xl mb-1">KZT</div>
                  <div className="text-xs text-muted-foreground">Impact Added</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-2xl border border-violet-500/20 p-6 text-center">
              <Share2 className="w-8 h-8 text-violet-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">Pass the vibe</h3>
              <p className="text-sm text-muted-foreground mb-5">
                If you’re signed in, your link attributes the ripple to you — Stories, WhatsApp, Telegram, QR, native
                share.
              </p>
              <Button
                type="button"
                onClick={() => setShareOpen(true)}
                disabled={!Number.isFinite(cid)}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold py-6 border-0 shadow-lg shadow-violet-500/20"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share in one tap
              </Button>
            </div>

            {Number.isFinite(cid) && (
              <ShareCampaignDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                campaignId={cid}
                campaignTitle={campaign?.title || 'This fundraiser'}
                campaignImageUrl={campaign?.image_url}
                raisedAmount={campaign?.raised_amount}
                goalAmount={campaign?.goal_amount}
                donorCount={campaign?.donor_count}
                context="donated"
                isAuthenticated={!!user}
                onRequestLogin={login}
                afterTrackedShare={() => void loadCampaign()}
              />
            )}

            <div className="flex gap-3">
              <Link to="/explore" className="flex-1">
                <Button variant="outline" className="w-full !bg-transparent border-border text-white rounded-xl py-6">
                  Explore More
                </Button>
              </Link>
              <Link to="/profile" className="flex-1">
                <Button className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-6 border-0">
                  My Impact <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

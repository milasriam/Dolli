import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { client } from '@/lib/api';
import Header from '@/components/Header';
import { toast } from 'sonner';
import {
  Heart, Share2, Trophy, Copy, CheckCircle2,
  ExternalLink, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

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
  const invoiceId = searchParams.get('invoice_id') || searchParams.get('session_id');
  const provider = searchParams.get('provider') || 'halyk_epay';
  const campaignId = searchParams.get('campaign_id');
  const initialStatus = searchParams.get('status');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentState>('verifying');

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
    if (initialStatus === 'failed') {
      setPaymentStatus('failed');
      return;
    }
    if (invoiceId) {
      verifyPayment();
      return;
    }
    setPaymentStatus('error');
  }, []);

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

  const verifyPayment = async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/payment/verify_payment',
        method: 'POST',
        data: { invoice_id: invoiceId, provider },
      });
      setPaymentStatus((response.data.status as PaymentState) || 'pending');
    } catch (err: any) {
      const detail = err?.data?.detail || err?.response?.data?.detail;
      if (detail) {
        toast.error(detail);
      }
      setPaymentStatus('error');
      console.error('Payment verification failed:', err);
    }
  };

  const loadCampaign = async () => {
    try {
      const response = await client.entities.campaigns.get({ id: campaignId! });
      setCampaign(response?.data);
    } catch {
      // silent
    }
  };

  const handleShare = async (platform: string) => {
    const text = `I just donated to "${campaign?.title || 'a great cause'}" on Dolli. Join me!`;
    const url = `${window.location.origin}/campaign/${campaignId}`;

    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/analytics/create-referral',
        method: 'POST',
        data: { campaign_id: Number(campaignId), platform },
      });
      const shareUrl = `${window.location.origin}${response.data.share_url}`;

      if (platform === 'tiktok') {
        window.open(`https://www.tiktok.com/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank');
      } else if (platform === 'instagram') {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        toast.success('Copied! Share on Instagram Stories or bio.');
      } else if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const progress = campaign ? Math.min((campaign.raised_amount / campaign.goal_amount) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Header />

      <div className="pt-24 max-w-lg mx-auto px-4 pb-16">
        {paymentStatus === 'verifying' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Verifying your donation...</p>
          </div>
        )}

        {paymentStatus === 'error' && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">😔</div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-6">We could not verify your payment yet. Please try again.</p>
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
            <p className="text-slate-400 mb-6">You can return to the campaign and try again with another method.</p>
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
              <p className="text-slate-400">We are waiting for payment confirmation from {provider === 'kaspi_pay' ? 'Kaspi Pay' : 'Halyk EPAY'}.</p>
            </div>

            <div className="bg-[#13131A] rounded-2xl border border-white/5 p-5 text-sm text-slate-300 space-y-2">
              <p>Invoice: <span className="text-white font-medium">{invoiceId}</span></p>
              <p>Provider: <span className="text-white font-medium">{provider}</span></p>
              <p className="text-slate-400">
                {provider === 'kaspi_pay'
                  ? 'Kaspi Pay is currently confirmed manually after payment on the merchant side.'
                  : 'If you just completed the payment, refresh this page in a few seconds.'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={verifyPayment} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white border-0">
                Check Again
              </Button>
              <Link to={`/campaign/${campaignId}`} className="flex-1">
                <Button variant="outline" className="w-full !bg-transparent border-white/10 text-white">
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
              <h1 className="text-3xl font-black mb-2">You're Amazing! 🎉</h1>
              <p className="text-slate-400">Your donation is making a real difference</p>
            </div>

            {campaign && (
              <div className="bg-[#13131A] rounded-2xl border border-white/5 p-5">
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
                        <span className="text-slate-500">{Math.round(progress)}%</span>
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

            <div className="bg-[#13131A] rounded-2xl border border-white/5 p-5 space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Rewards Earned
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-2xl mb-1">*</div>
                  <div className="text-xs text-slate-400">First Dollar</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-2xl mb-1">+</div>
                  <div className="text-xs text-slate-400">Streak +1</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-2xl mb-1">KZT</div>
                  <div className="text-xs text-slate-400">Impact Added</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-2xl border border-violet-500/20 p-6 text-center">
              <Share2 className="w-8 h-8 text-violet-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">Share & Help Reach Goal Faster</h3>
              <p className="text-sm text-slate-400 mb-5">
                Every share creates a viral loop. Your friends can join with just one tap.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleShare('tiktok')}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-all"
                >
                  TikTok
                </button>
                <button
                  onClick={() => handleShare('instagram')}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
                >
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

            <div className="flex gap-3">
              <Link to="/explore" className="flex-1">
                <Button variant="outline" className="w-full !bg-transparent border-white/10 text-white rounded-xl py-6">
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
      </div>
    </div>
  );
}

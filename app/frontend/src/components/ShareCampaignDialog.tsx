import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createReferralShareUrl } from '@/lib/createReferralShareUrl';
import {
  openWhatsApp,
  openTelegramShare,
  openTwitterShare,
  openFacebookShare,
  openLinkedInShare,
  openTikTokShare,
  openThreadsShare,
  openSmsShare,
  qrCodeImageUrl,
} from '@/lib/shareOutbound';
import { copyForSurface, type ShareSurface, type ShareTone } from '@/lib/shareCopyTemplates';
import {
  renderShareCardPng,
  type ShareCardFormat,
  type ShareCardTheme,
} from '@/lib/shareCardCanvas';
import {
  Share2,
  Sparkles,
  Smartphone,
  MessageCircle,
  Copy,
  CheckCircle2,
  Loader2,
  Send,
  Mail,
  Youtube,
  ImageDown,
  Type,
} from 'lucide-react';

export type ShareCampaignContext = 'support' | 'donated';

type ShareCampaignDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  campaignTitle: string;
  campaignImageUrl?: string | null;
  raisedAmount?: number;
  goalAmount?: number;
  donorCount?: number;
  context: ShareCampaignContext;
  isAuthenticated: boolean;
  onRequestLogin: () => void;
  afterTrackedShare?: () => void;
};

const TIKTOK_GLYPH = (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.87a8.28 8.28 0 004.76 1.5v-3.4a4.85 4.85 0 01-1-.28z" />
  </svg>
);

const INSTAGRAM_GLYPH = (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const CARD_THEMES: { id: ShareCardTheme; label: string }[] = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'glacier', label: 'Glacier' },
];

const CARD_FORMATS: { id: ShareCardFormat; label: string; hint: string }[] = [
  { id: 'story', label: 'Story', hint: '9:16 · IG / TikTok' },
  { id: 'square', label: 'Square', hint: '1:1 · feed' },
  { id: 'wide', label: 'Wide', hint: '16:9 · Shorts thumb' },
];

const TONES: { id: ShareTone; label: string; hint: string }[] = [
  { id: 'warm', label: 'Warm', hint: 'friendly' },
  { id: 'punchy', label: 'Punchy', hint: 'bold' },
  { id: 'pro', label: 'Pro', hint: 'clear' },
];

export function ShareCampaignDialog({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  campaignImageUrl,
  raisedAmount,
  goalAmount,
  donorCount,
  context,
  isAuthenticated,
  onRequestLogin,
  afterTrackedShare,
}: ShareCampaignDialogProps) {
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tone, setTone] = useState<ShareTone>('warm');
  const [customLine, setCustomLine] = useState('');
  const [shareTab, setShareTab] = useState('captions');
  const [cardTheme, setCardTheme] = useState<ShareCardTheme>('aurora');
  const [cardFormat, setCardFormat] = useState<ShareCardFormat>('story');
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [cardPreviewBusy, setCardPreviewBusy] = useState(false);

  /** Social crawlers resolve OG tags via API share landing; humans redirect to /campaign/:id */
  const canonicalUrl = useMemo(
    () => `${window.location.origin}/api/share/campaign/${campaignId}`,
    [campaignId],
  );

  const progressPct =
    raisedAmount != null && goalAmount != null && goalAmount > 0
      ? Math.min((raisedAmount / goalAmount) * 100, 100)
      : null;

  const copyVars = useMemo(
    () => ({
      title: campaignTitle,
      context,
      raisedUsd: raisedAmount,
      goalUsd: goalAmount,
      pct: progressPct,
      donorCount,
      customNote: customLine.trim() || undefined,
    }),
    [campaignTitle, context, raisedAmount, goalAmount, progressPct, donorCount, customLine],
  );

  const nativeSupported = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    if (!open) {
      setShareTab('captions');
      setCustomLine('');
      setTone('warm');
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
    };
  }, [cardPreviewUrl]);

  async function resolveUrl(platform: string): Promise<string> {
    if (isAuthenticated) {
      const url = await createReferralShareUrl(campaignId, platform);
      afterTrackedShare?.();
      return url;
    }
    return canonicalUrl;
  }

  const refreshCardPreview = useCallback(async () => {
    setCardPreviewBusy(true);
    try {
      const blob = await renderShareCardPng({
        format: cardFormat,
        theme: cardTheme,
        title: campaignTitle,
        raised: raisedAmount,
        goal: goalAmount,
        pct: progressPct,
        donorCount,
        shareUrl: canonicalUrl,
        imageUrl: campaignImageUrl,
        customLine: customLine.trim() || undefined,
        scale: 0.22,
      });
      if (!blob) {
        toast.error('Could not render preview');
        return;
      }
      setCardPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      toast.error('Preview failed');
    } finally {
      setCardPreviewBusy(false);
    }
  }, [
    cardFormat,
    cardTheme,
    campaignTitle,
    raisedAmount,
    goalAmount,
    progressPct,
    donorCount,
    canonicalUrl,
    campaignImageUrl,
    customLine,
  ]);

  useEffect(() => {
    if (!open || shareTab !== 'visuals') return;
    void refreshCardPreview();
  }, [open, shareTab, refreshCardPreview]);

  async function handleNativeShare() {
    setWorking(true);
    try {
      const url = await resolveUrl('native');
      const body = copyForSurface('native', copyVars, tone);
      if (navigator.share) {
        try {
          await navigator.share({
            title: campaignTitle,
            text: `${body}\n\n${url}`,
            url,
          });
          toast.success('Thanks for spreading the word!');
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          throw e;
        }
      } else {
        await navigator.clipboard.writeText(`${body}\n\n${url}`);
        toast.success('Copied — paste into any app.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setWorking(false);
    }
  }

  async function channel(platform: string, openFn: (url: string, text: string) => void) {
    setWorking(true);
    try {
      const url = await resolveUrl(platform);
      const body = copyForSurface(platform as ShareSurface, copyVars, tone);
      openFn(url, body);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create link');
    } finally {
      setWorking(false);
    }
  }

  async function handleFacebookShare() {
    setWorking(true);
    try {
      const url = await resolveUrl('facebook');
      const body = copyForSurface('facebook', copyVars, tone);
      openFacebookShare(url);
      await navigator.clipboard.writeText(`${body}\n\n${url}`);
      toast.success('Facebook opened — long caption copied. Paste if you want it on the post.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setWorking(false);
    }
  }

  async function handleLinkedInShare() {
    setWorking(true);
    try {
      const url = await resolveUrl('linkedin');
      const body = copyForSurface('linkedin', copyVars, tone);
      openLinkedInShare(url);
      await navigator.clipboard.writeText(`${body}\n\n${url}`);
      toast.success('LinkedIn opened — suggested post copied.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setWorking(false);
    }
  }

  async function handleCopy() {
    setWorking(true);
    try {
      const url = await resolveUrl('copy');
      const body = copyForSurface('copy', copyVars, tone);
      await navigator.clipboard.writeText(`${body}\n\n${url}`);
      setCopied(true);
      toast.success('Copied — tuned for a general paste.');
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not copy');
    } finally {
      setWorking(false);
    }
  }

  async function copyForDestination(platform: ShareSurface, successMessage: string) {
    setWorking(true);
    try {
      const url = await resolveUrl(platform);
      const body = copyForSurface(platform, copyVars, tone);
      await navigator.clipboard.writeText(`${body}\n\n${url}`);
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not copy');
    } finally {
      setWorking(false);
    }
  }

  async function handleDownloadCard() {
    setWorking(true);
    try {
      const blob = await renderShareCardPng({
        format: cardFormat,
        theme: cardTheme,
        title: campaignTitle,
        raised: raisedAmount,
        goal: goalAmount,
        pct: progressPct,
        donorCount,
        shareUrl: canonicalUrl,
        imageUrl: campaignImageUrl,
        customLine: customLine.trim() || undefined,
        scale: 1,
      });
      if (!blob) {
        toast.error('Could not build image');
        return;
      }
      const a = document.createElement('a');
      const name = `dolli-${campaignTitle.slice(0, 32).replace(/\s+/g, '-') || 'share'}.png`;
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Saved — add to Stories, Reels, or Shorts as media.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setWorking(false);
    }
  }

  type ChannelBtn = {
    key: string;
    label: string;
    sub?: string;
    icon: ReactNode;
    onClick: () => void;
    className: string;
  };

  const channels: ChannelBtn[] = [
    {
      key: 'wa',
      label: 'WhatsApp',
      icon: <MessageCircle className="w-4 h-4 text-emerald-400" />,
      onClick: () => {
        void channel('whatsapp', openWhatsApp);
      },
      className:
        'border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15 text-white',
    },
    {
      key: 'tg',
      label: 'Telegram',
      icon: <Send className="w-4 h-4 text-sky-400" />,
      onClick: () => {
        void channel('telegram', openTelegramShare);
      },
      className: 'border-sky-500/25 bg-sky-500/10 hover:bg-sky-500/15 text-white',
    },
    {
      key: 'th',
      label: 'Threads',
      sub: 'composer',
      icon: <span className="text-[13px] font-bold text-white/90">@</span>,
      onClick: () => {
        void channel('threads', openThreadsShare);
      },
      className: 'border-white/15 bg-white/5 hover:bg-white/10 text-white',
    },
    {
      key: 'x',
      label: 'X / Twitter',
      sub: 'post',
      icon: <span className="text-[11px] font-black">𝕏</span>,
      onClick: () => {
        void channel('twitter', openTwitterShare);
      },
      className: 'border-white/15 bg-white/5 hover:bg-white/10 text-white',
    },
    {
      key: 'fb',
      label: 'Facebook',
      sub: 'caption copied',
      icon: <span className="text-sm font-bold text-blue-400">f</span>,
      onClick: () => {
        void handleFacebookShare();
      },
      className: 'border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/15 text-white',
    },
    {
      key: 'li',
      label: 'LinkedIn',
      sub: 'caption copied',
      icon: <span className="text-[10px] font-bold text-sky-300">in</span>,
      onClick: () => {
        void handleLinkedInShare();
      },
      className: 'border-sky-600/30 bg-sky-900/20 hover:bg-sky-900/30 text-white',
    },
    {
      key: 'tt',
      label: 'TikTok',
      sub: 'share sheet',
      icon: TIKTOK_GLYPH,
      onClick: () => {
        void channel('tiktok', openTikTokShare);
      },
      className: 'border-white/15 bg-black/60 hover:bg-black/80 text-white',
    },
    {
      key: 'tt_story',
      label: 'TikTok Story',
      sub: 'paste',
      icon: TIKTOK_GLYPH,
      onClick: () => {
        void copyForDestination(
          'tiktok_story',
          'Copied — TikTok Story: paste caption, add link sticker if you use one.',
        );
      },
      className: 'border-white/15 bg-black/40 hover:bg-black/55 text-white',
    },
    {
      key: 'ig_story',
      label: 'IG Stories',
      sub: 'sticker',
      icon: INSTAGRAM_GLYPH,
      onClick: () => {
        void copyForDestination(
          'instagram_stories',
          'Copied — short hook for on-screen text; put the URL in a link sticker.',
        );
      },
      className:
        'border-pink-500/30 bg-gradient-to-br from-purple-600/30 to-pink-600/25 hover:from-purple-600/40 hover:to-pink-600/35 text-white',
    },
    {
      key: 'ig_post',
      label: 'IG post',
      sub: 'caption',
      icon: INSTAGRAM_GLYPH,
      onClick: () => {
        void copyForDestination(
          'instagram_post',
          'Copied — full caption with hashtags, ready to paste.',
        );
      },
      className:
        'border-pink-500/30 bg-gradient-to-br from-purple-600/25 to-pink-600/20 hover:from-purple-600/35 hover:to-pink-600/30 text-white',
    },
    {
      key: 'ig_reels',
      label: 'IG Reels',
      sub: 'caption',
      icon: INSTAGRAM_GLYPH,
      onClick: () => {
        void copyForDestination(
          'instagram_reels',
          'Copied — Reels caption + tags.',
        );
      },
      className:
        'border-pink-500/30 bg-gradient-to-br from-fuchsia-600/25 to-orange-500/15 hover:from-fuchsia-600/35 hover:to-orange-500/25 text-white',
    },
    {
      key: 'yt_shorts',
      label: 'YouTube Shorts',
      sub: 'description',
      icon: <Youtube className="w-4 h-4 text-red-400" />,
      onClick: () => {
        void copyForDestination(
          'youtube_shorts',
          'Copied — paste into Shorts description when publishing.',
        );
      },
      className: 'border-red-500/25 bg-red-950/30 hover:bg-red-950/45 text-white',
    },
    {
      key: 'sms',
      label: 'SMS',
      icon: <Mail className="w-4 h-4 text-amber-300" />,
      onClick: () => {
        void channel('sms', openSmsShare);
      },
      className: 'border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15 text-white',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-md border-white/10 bg-[#0f0f14] text-white shadow-2xl shadow-violet-500/10 sm:max-w-lg',
          'max-h-[90vh] overflow-y-auto',
        )}
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-pink-500/20 border border-violet-500/30">
              <Share2 className="h-4 w-4 text-violet-300" />
            </span>
            Share studio
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm leading-relaxed">
            Dolli writes channel-specific copy from this campaign card. Tweak voice and add a personal line,
            then grab a polished image for Stories or Reels.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-white/10 bg-[#13131A] p-4 flex gap-3">
          {campaignImageUrl ? (
            <img
              src={campaignImageUrl}
              alt=""
              className="h-20 w-20 rounded-xl object-cover flex-shrink-0 border border-white/10"
            />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white leading-snug line-clamp-2">{campaignTitle}</p>
            {progressPct != null && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span className="text-emerald-400 font-medium">
                    ${raisedAmount!.toLocaleString()} raised
                  </span>
                  <span>{Math.round(progressPct)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-violet-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {!isAuthenticated && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/95">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onRequestLogin();
              }}
              className="font-semibold text-white underline underline-offset-2 hover:text-amber-50"
            >
              Sign in
            </button>{' '}
            for a personal tracking link on taps below. Cards and QR use the share link for richer previews.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Type className="w-3.5 h-3.5" />
            Voice
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  tone === t.id
                    ? 'border-violet-400/60 bg-violet-500/25 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                )}
              >
                {t.label}
                <span className="text-white/40 font-normal"> · {t.hint}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="share-custom-line" className="text-xs text-slate-400">
              Your line (optional, woven into captions)
            </Label>
            <Input
              id="share-custom-line"
              value={customLine}
              onChange={(e) => setCustomLine(e.target.value.slice(0, 120))}
              placeholder="e.g. In memory of dad — every dollar to meals."
              className="h-10 rounded-xl border-white/10 bg-black/30 text-white placeholder:text-slate-600"
              maxLength={120}
            />
          </div>
        </div>

        <Tabs value={shareTab} onValueChange={setShareTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl border border-white/10 bg-black/30 p-1">
            <TabsTrigger
              value="captions"
              className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-300"
            >
              Captions & taps
            </TabsTrigger>
            <TabsTrigger
              value="visuals"
              className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-300"
            >
              Share card
            </TabsTrigger>
          </TabsList>

          <TabsContent value="captions" className="mt-4 space-y-4">
            <Button
              type="button"
              disabled={working}
              onClick={() => void handleNativeShare()}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold border-0 shadow-lg shadow-violet-500/20"
            >
              {working ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  {nativeSupported ? 'Share via…' : 'Copy for any app'}
                </>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  disabled={working}
                  onClick={() => void ch.onClick()}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-all disabled:opacity-50',
                    ch.className,
                  )}
                >
                  {ch.icon}
                  <span className="flex flex-col min-w-0">
                    <span className="truncate">{ch.label}</span>
                    {ch.sub && <span className="text-[10px] font-normal text-white/50">{ch.sub}</span>}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={working}
                onClick={() => void handleCopy()}
                className="flex-1 h-11 rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copied ? 'Copied' : 'Copy best general paste'}
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Scan to open (public link)
              </p>
              <img
                src={qrCodeImageUrl(canonicalUrl)}
                alt=""
                width={180}
                height={180}
                className="mx-auto rounded-lg border border-white/10 bg-white p-1"
              />
              <p className="text-[10px] text-slate-500 mt-2">
                Great for screenshots or projecting. Tracked links stay in the buttons above when you’re signed in.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="visuals" className="mt-4 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              High-res PNG with title, progress, your optional line, and link block — like a year-in-review slide,
              tuned for this fundraiser.
            </p>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Palette</p>
              <div className="grid grid-cols-4 gap-1.5">
                {CARD_THEMES.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setCardTheme(th.id)}
                    className={cn(
                      'rounded-lg border py-2 text-[10px] font-medium transition-colors',
                      cardTheme === th.id
                        ? 'border-violet-400/70 bg-white/10 text-white'
                        : 'border-white/10 bg-black/30 text-slate-400 hover:bg-white/5',
                    )}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Shape</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CARD_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCardFormat(f.id)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-left transition-colors',
                      cardFormat === f.id
                        ? 'border-violet-400/70 bg-violet-500/15 text-white'
                        : 'border-white/10 bg-black/30 text-slate-400 hover:bg-white/5',
                    )}
                  >
                    <span className="block text-xs font-semibold">{f.label}</span>
                    <span className="block text-[10px] text-white/45">{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/50 p-3 flex flex-col items-center">
              <p className="text-[10px] text-slate-500 mb-2 self-start uppercase tracking-wider font-semibold">
                Live preview
              </p>
              <div className="relative w-full max-h-[280px] flex items-center justify-center rounded-xl bg-black/40 min-h-[160px]">
                {cardPreviewBusy && (
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400 absolute" />
                )}
                {cardPreviewUrl && !cardPreviewBusy && (
                  <img
                    src={cardPreviewUrl}
                    alt="Share card preview"
                    className="max-h-[260px] w-auto object-contain rounded-lg border border-white/10 shadow-lg"
                  />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-white/15 text-white hover:bg-white/10"
                onClick={() => void refreshCardPreview()}
                disabled={cardPreviewBusy}
              >
                Refresh preview
              </Button>
            </div>
            <Button
              type="button"
              disabled={working}
              onClick={() => void handleDownloadCard()}
              className="w-full h-12 rounded-xl border-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-900/30"
            >
              {working ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ImageDown className="w-4 h-4 mr-2" />
                  Download full-size PNG
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

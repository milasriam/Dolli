import { useCallback, useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'dolli_pwa_install_hint_dismissed_at';
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari (not Chrome/Firefox in-app) — Add to Home Screen is manual. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && notOther;
}

function dismissStillActive(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const t = parseInt(raw, 10);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Reduces “browser-only” friction: Android/Desktop install prompt + iOS Add to Home Screen hint.
 */
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<'chrome' | 'ios' | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  useEffect(() => {
    if (isStandalone() || dismissStillActive()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVariant('chrome');
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIosSafari()) {
      timer = setTimeout(() => {
        setVariant('ios');
        setVisible(true);
      }, 12000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible || !variant) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100] flex justify-center p-3',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none',
      )}
      role="region"
      aria-label="Install Dolli on your device"
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border border-violet-500/35',
          'bg-[#13131A]/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-md',
        )}
      >
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
          {variant === 'chrome' ? (
            <Download className="h-4 w-4 text-violet-300" />
          ) : (
            <Share2 className="h-4 w-4 text-violet-300" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm leading-snug text-slate-200">
          {variant === 'chrome' ? (
            <>
              <p className="font-semibold text-white">Install Dolli</p>
              <p className="mt-1 text-slate-400">
                Open from your home screen — faster return, app-like frame, same secure web app.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-white">Add Dolli to Home Screen</p>
              <p className="mt-1 text-slate-400">
                Tap <span className="font-medium text-white">Share</span>, then{' '}
                <span className="font-medium text-white">Add to Home Screen</span> — best experience on iPhone
                before the native app ships.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-500 hover:text-white"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
          {variant === 'chrome' && deferred && (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg bg-violet-600 px-3 text-xs hover:bg-violet-500"
              onClick={() => void install()}
            >
              Install
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

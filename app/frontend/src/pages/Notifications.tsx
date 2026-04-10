import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { PageHeader } from '@/components/PageHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type UserNotification,
} from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function Notifications() {
  const { user, login } = useAuth();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const pack = await fetchNotifications(0, 80);
      setItems(pack?.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);

  const markOneRead = async (n: UserNotification) => {
    if (!user || n.read_at) return;
    try {
      await markNotificationsRead([n.id]);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    } catch {
      toast.error('Could not update notification');
    }
  };

  const markAll = async () => {
    if (!user || unreadIds.length === 0) return;
    try {
      await markAllNotificationsRead();
      await load();
      toast.success('All marked read');
    } catch {
      toast.error('Could not mark all read');
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
        <Header />
        <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-16 pt-28 text-center">
          <Bell className="w-12 h-12 mx-auto text-violet-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sign in for notifications</h1>
          <p className="text-slate-400 mb-6 text-sm">Follow organizers and get alerts when they launch fundraisers.</p>
          <Button onClick={() => login()} className="rounded-xl bg-violet-600 hover:bg-violet-500">
            Log in
          </Button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <Header />
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-24 sm:px-6">
        <PageHeader
          title="Notifications"
          description="New campaigns from people you follow"
          actions={
            unreadIds.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void markAll()}
                className="shrink-0 border-white/15 text-slate-200"
              >
                <CheckCheck className="mr-1.5 h-4 w-4" />
                Mark all read
              </Button>
            ) : null
          }
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#13131A] p-10 text-center">
            <Bell className="w-10 h-10 mx-auto text-slate-500 mb-3" />
            <p className="text-slate-300 font-medium mb-1">You’re all caught up</p>
            <p className="text-sm text-slate-500">
              When someone you follow publishes a fundraiser or crosses a funding milestone (25% / 50% / 75% /
              100%), it shows up here. Open Explore → Network activity to see gifts and shares from people you follow.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id}>
                <div
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    n.read_at ? 'border-white/5 bg-[#13131A]/60' : 'border-violet-500/25 bg-violet-500/5'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{n.title}</p>
                  {n.body && <p className="text-sm text-slate-200 mb-2 line-clamp-2">{n.body}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    {n.campaign_id != null && (
                      <Link
                        to={`/campaign/${n.campaign_id}`}
                        onClick={() => void markOneRead(n)}
                        className="text-xs font-semibold text-violet-300 hover:text-violet-200"
                      >
                        Open campaign →
                      </Link>
                    )}
                    {!n.read_at && (
                      <button
                        type="button"
                        onClick={() => void markOneRead(n)}
                        className="text-xs text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

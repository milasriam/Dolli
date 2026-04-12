import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2, Undo2, Loader2, Rocket, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  campaignCanUndoPublicState,
  deleteCampaign,
  publishCampaignFromDraft,
  revertCampaignToDraft,
} from '@/lib/campaignMutations';

export type OwnerCampaignRow = {
  id: number;
  title: string;
  status: string;
  raised_amount?: number | null;
  donor_count?: number | null;
};

type Props = {
  campaign: OwnerCampaignRow;
  onChanged: () => void;
  layout?: 'row' | 'banner';
};

export function OwnerCampaignControls({ campaign, onChanged, layout = 'row' }: Props) {
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const can = campaignCanUndoPublicState(campaign);
  const status = (campaign.status || '').toLowerCase();
  const showRevert = can && status === 'active';
  const showPublish = can && status === 'draft';
  const showDelete = can && (status === 'active' || status === 'draft');

  const handlePublish = async () => {
    setBusy(true);
    try {
      await publishCampaignFromDraft(campaign.id);
      toast.success('Campaign is live in Explore again.');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async () => {
    setBusy(true);
    try {
      await revertCampaignToDraft(campaign.id);
      toast.success('Moved to drafts — hidden from Explore. Publish again from here when ready.');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update campaign');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteCampaign(campaign.id);
      toast.success('Campaign deleted.');
      setDeleteOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete campaign');
    } finally {
      setBusy(false);
    }
  };

  if (!can) return null;

  const actions = (
    <div className={`flex flex-wrap gap-2 ${layout === 'banner' ? 'mt-3' : ''}`}>
      {showPublish && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            asChild
            className="border-violet-500/30 text-violet-200 hover:bg-violet-500/10"
          >
            <Link to={`/campaign/${campaign.id}/edit`}>
              <Pencil className="w-4 h-4 mr-1.5" />
              Edit draft
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={handlePublish}
            className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4 mr-1.5" />}
            Publish
          </Button>
        </>
      )}
      {showRevert && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={handleRevert}
          className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4 mr-1.5" />}
          Back to drafts
        </Button>
      )}
      {showDelete && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
          className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          Delete
        </Button>
      )}
    </div>
  );

  if (layout === 'banner') {
    return (
      <>
        <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5">
          <p className="text-sm font-semibold text-amber-200">You’re the organizer</p>
          <p className="text-xs text-muted-foreground mt-1">
            No completed donations yet — you can unpublish to drafts, publish again, or delete this fundraiser.
          </p>
          {actions}
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent className="bg-card border-border text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This removes “{campaign.title}” permanently. You can’t undo this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border bg-transparent text-muted-foreground">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(ev) => {
                  ev.preventDefault();
                  handleDelete();
                }}
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <Link
          to={`/campaign/${campaign.id}`}
          className="text-sm font-medium text-white hover:text-violet-300 truncate flex-1 min-w-0"
        >
          {campaign.title}
        </Link>
        {actions}
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-card border-border text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes “{campaign.title}” permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-transparent text-muted-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                handleDelete();
              }}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

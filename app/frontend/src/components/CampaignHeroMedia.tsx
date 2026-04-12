import { parseVideoPresentation } from '@/lib/campaignVideoPresentation';

type Props = {
  videoUrl: string | null | undefined;
  gifUrl: string | null | undefined;
  imageUrl: string | null | undefined;
  title?: string;
  /** Tailwind height classes, e.g. h-64 sm:h-80 */
  className?: string;
};

/**
 * Hero block: prefers video (native or embed), then GIF, then still image.
 */
export function CampaignHeroMedia({
  videoUrl,
  gifUrl,
  imageUrl,
  title,
  className = 'w-full h-64 sm:h-80',
}: Props) {
  const v = (videoUrl || '').trim();
  if (v) {
    const pres = parseVideoPresentation(v);
    if (pres.kind === 'iframe') {
      return (
        <iframe
          src={pres.src}
          title={pres.title || title || 'Campaign video'}
          className={`${className} object-cover border-0 bg-black`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      );
    }
    if (pres.kind === 'native') {
      return (
        <video
          src={pres.src}
          controls
          playsInline
          className={`${className} object-cover`}
          poster={(imageUrl || '').trim() || undefined}
        />
      );
    }
  }

  const g = (gifUrl || '').trim();
  if (g) {
    return <img src={g} alt="" className={`${className} object-cover`} />;
  }

  const img = (imageUrl || '').trim();
  if (img) {
    return <img src={img} alt={title || ''} className={`${className} object-cover`} />;
  }

  return (
    <div className={`${className} flex items-center justify-center bg-card text-muted-foreground text-sm`}>
      No preview image
    </div>
  );
}

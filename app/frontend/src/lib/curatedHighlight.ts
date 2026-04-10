/** Admin / future-paid promo shell styles — keep keys stable for API (`frame`, `featured`). */

export type CuratedHighlight = 'frame' | 'featured' | null | undefined;

export function organizerPromoCardClass(h: CuratedHighlight): string {
  if (h === 'frame') {
    return 'ring-2 ring-amber-400/55 ring-offset-2 ring-offset-background border border-amber-500/30 shadow-[0_0_36px_-14px_rgba(251,191,36,0.25)]';
  }
  if (h === 'featured') {
    return 'ring-2 ring-fuchsia-500/50 ring-offset-2 ring-offset-background border border-fuchsia-500/35 shadow-[0_0_48px_-12px_rgba(192,38,211,0.4)]';
  }
  return '';
}

export function profileHeroPromoClass(h: CuratedHighlight): string {
  if (h === 'frame') {
    return 'ring-2 ring-amber-400/45 ring-offset-2 ring-offset-background border-amber-500/20';
  }
  if (h === 'featured') {
    return 'ring-2 ring-fuchsia-500/45 ring-offset-2 ring-offset-background border-fuchsia-500/25';
  }
  return '';
}

export function headerAvatarPromoClass(h: CuratedHighlight): string {
  if (h === 'frame') return 'ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background';
  if (h === 'featured') return 'ring-2 ring-fuchsia-500/55 ring-offset-2 ring-offset-background';
  return '';
}

/** Open external share targets with encoded URL + text (no new dependencies). */

export function shareTextForCampaign(title: string, context: 'support' | 'donated'): string {
  const safe = title.trim() || 'this fundraiser';
  if (context === 'donated') {
    return `I just supported "${safe}" on Dolli — chip in if you can. Every $1 counts.`;
  }
  return `Check out "${safe}" on Dolli — micro-donations that add up fast.`;
}

export function openWhatsApp(url: string, text: string): void {
  const u = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

export function openTelegramShare(url: string, text: string): void {
  const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

export function openTwitterShare(url: string, text: string): void {
  const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

export function openFacebookShare(url: string): void {
  const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(u, '_blank', 'noopener,noreferrer,width=600,height=400');
}

export function openLinkedInShare(url: string): void {
  const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

export function openTikTokShare(url: string, text: string): void {
  const u = `https://www.tiktok.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

/** Opens Threads composer with prefilled text + link (Meta web intents). */
export function openThreadsShare(url: string, text: string): void {
  const params = new URLSearchParams();
  params.set('text', text);
  params.set('url', url);
  const u = `https://www.threads.net/intent/post?${params.toString()}`;
  window.open(u, '_blank', 'noopener,noreferrer');
}

export function openSmsShare(url: string, text: string): void {
  window.location.href = `sms:?body=${encodeURIComponent(`${text} ${url}`)}`;
}

export function qrCodeImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(data)}`;
}

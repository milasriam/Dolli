export type ShareCardTheme = 'aurora' | 'midnight' | 'sunset' | 'glacier';
export type ShareCardFormat = 'story' | 'square' | 'wide';

const THEME_STOPS: Record<ShareCardTheme, [string, string, string]> = {
  aurora: ['#6d28d9', '#db2777', '#0f0f14'],
  midnight: ['#020617', '#312e81', '#1e1b4b'],
  sunset: ['#ea580c', '#db2777', '#4c1d95'],
  glacier: ['#0891b2', '#4f46e5', '#0c1929'],
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export type ShareCardRenderOpts = {
  format: ShareCardFormat;
  theme: ShareCardTheme;
  title: string;
  raised?: number;
  goal?: number;
  pct?: number | null;
  donorCount?: number;
  shareUrl: string;
  imageUrl?: string | null;
  customLine?: string;
  /** 0.2–1; lower = faster preview bitmap */
  scale?: number;
};

const DIM: Record<ShareCardFormat, [number, number]> = {
  story: [1080, 1920],
  square: [1080, 1080],
  wide: [1920, 1080],
};

/**
 * Renders a high-res “Wrapped”-style share card (PNG). No external QR (avoids canvas taint);
 * shows a clear link block instead. Campaign photo is best-effort (CORS).
 */
export async function renderShareCardPng(opts: ShareCardRenderOpts): Promise<Blob | null> {
  const [fullW, fullH] = DIM[opts.format];
  const scale = Math.min(1, Math.max(0.15, opts.scale ?? 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(fullW * scale);
  canvas.height = Math.round(fullH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  const W = fullW;
  const H = fullH;

  const [c0, c1, c2] = THEME_STOPS[opts.theme];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c0);
  g.addColorStop(0.45, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  let cover: HTMLImageElement | null = null;
  if (opts.imageUrl) {
    cover = await loadImage(opts.imageUrl, true);
    if (!cover) {
      cover = await loadImage(opts.imageUrl, false);
    }
  }

  const title = opts.title.trim() || 'Fundraiser';
  const note = opts.customLine?.trim();

  if (opts.format === 'story') {
    drawStoryLayout(ctx, W, H, title, note, opts, cover);
  } else if (opts.format === 'square') {
    drawSquareLayout(ctx, W, H, title, note, opts, cover);
  } else {
    drawWideLayout(ctx, W, H, title, note, opts, cover);
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 1);
  });
}

function drawStoryLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  title: string,
  note: string | undefined,
  opts: ShareCardRenderOpts,
  cover: HTMLImageElement | null,
): void {
  const pad = 72;
  const photoY = 100;
  const photoH = 780;
  const photoW = W - pad * 2;
  const photoX = pad;
  const r = 36;

  if (cover && cover.width > 0) {
    ctx.save();
    drawRoundRect(ctx, photoX, photoY, photoW, photoH, r);
    ctx.clip();
    const ar = cover.width / cover.height;
    const boxAr = photoW / photoH;
    let dw = photoW;
    let dh = photoH;
    let dx = photoX;
    let dy = photoY;
    if (ar > boxAr) {
      dh = photoW / ar;
      dy = photoY + (photoH - dh) / 2;
    } else {
      dw = photoH * ar;
      dx = photoX + (photoW - dw) / 2;
    }
    ctx.drawImage(cover, dx, dy, dw, dh);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, photoX, photoY, photoW, photoH, r);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    drawRoundRect(ctx, photoX, photoY, photoW, photoH, r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '500 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dolli', photoX + photoW / 2, photoY + photoH / 2 - 8);
    ctx.font = '26px system-ui, -apple-system, sans-serif';
    ctx.fillText('Your ripple starts here', photoX + photoW / 2, photoY + photoH / 2 + 36);
    ctx.textAlign = 'left';
  }

  const textTop = photoY + photoH + 56;
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 52px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  const titleLines = wrapLines(ctx, title, photoW);
  let y = textTop;
  const lh = 62;
  for (const ln of titleLines.slice(0, 4)) {
    ctx.fillText(ln, pad, y);
    y += lh;
  }

  const stats = buildStatsLine(opts);
  if (stats) {
    ctx.font = '500 30px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(stats, pad, y + 8);
    y += 48;
  }

  if (opts.goal != null && opts.goal > 0 && opts.pct != null) {
    const barY = y + 24;
    const barW = photoW;
    const barH = 14;
    const pct = Math.min(opts.pct, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawRoundRect(ctx, pad, barY, barW, barH, barH / 2);
    ctx.fill();
    const glow = ctx.createLinearGradient(pad, barY, pad + barW, barY);
    glow.addColorStop(0, '#34d399');
    glow.addColorStop(1, '#a78bfa');
    ctx.fillStyle = glow;
    drawRoundRect(ctx, pad, barY, (barW * pct) / 100, barH, barH / 2);
    ctx.fill();
    y = barY + barH + 40;
  } else {
    y += 36;
  }

  if (note) {
    ctx.font = 'italic 28px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const nl = wrapLines(ctx, note, photoW);
    for (const ln of nl.slice(0, 2)) {
      ctx.fillText(ln, pad, y);
      y += 36;
    }
    y += 16;
  }

  const panelY = H - 280;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  drawRoundRect(ctx, pad, panelY, photoW, 200, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  drawRoundRect(ctx, pad, panelY, photoW, 200, 28);
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('DOLLI', pad + 36, panelY + 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 26px ui-monospace, SFMono-Regular, Menlo, monospace';
  const urlLines = wrapLines(ctx, opts.shareUrl, photoW - 72);
  let uy = panelY + 96;
  for (const ul of urlLines.slice(0, 2)) {
    ctx.fillText(ul, pad + 36, uy);
    uy += 34;
  }
  ctx.font = '500 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('Tap the link to read the story and give in seconds.', pad + 36, panelY + 168);
}

function drawSquareLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  title: string,
  note: string | undefined,
  opts: ShareCardRenderOpts,
  cover: HTMLImageElement | null,
): void {
  const pad = 56;
  const photoH = 420;
  const photoW = W - pad * 2;
  const photoX = pad;
  const photoY = 56;
  const r = 28;
  if (cover && cover.width > 0) {
    ctx.save();
    drawRoundRect(ctx, photoX, photoY, photoW, photoH, r);
    ctx.clip();
    const ar = cover.width / cover.height;
    const boxAr = photoW / photoH;
    let dw = photoW;
    let dh = photoH;
    let dx = photoX;
    let dy = photoY;
    if (ar > boxAr) {
      dh = photoW / ar;
      dy = photoY + (photoH - dh) / 2;
    } else {
      dw = photoH * ar;
      dx = photoX + (photoW - dw) / 2;
    }
    ctx.drawImage(cover, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    drawRoundRect(ctx, photoX, photoY, photoW, photoH, r);
    ctx.fill();
  }

  let y = photoY + photoH + 44;
  ctx.fillStyle = '#fff';
  ctx.font = '800 44px system-ui, -apple-system, sans-serif';
  for (const ln of wrapLines(ctx, title, photoW).slice(0, 3)) {
    ctx.fillText(ln, pad, y);
    y += 52;
  }
  const stats = buildStatsLine(opts);
  if (stats) {
    ctx.font = '500 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(stats, pad, y + 12);
    y += 44;
  }
  if (opts.goal != null && opts.goal > 0 && opts.pct != null) {
    const barY = y + 16;
    const barW = photoW;
    const barH = 12;
    const pct = Math.min(opts.pct, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawRoundRect(ctx, pad, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = '#a78bfa';
    drawRoundRect(ctx, pad, barY, (barW * pct) / 100, barH, barH / 2);
    ctx.fill();
    y = barY + 40;
  }
  if (note) {
    ctx.font = 'italic 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (const ln of wrapLines(ctx, note, photoW).slice(0, 2)) {
      ctx.fillText(ln, pad, y);
      y += 30;
    }
  }
  const panelY = H - pad - 120;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  drawRoundRect(ctx, pad, panelY, photoW, 100, 20);
  ctx.fill();
  ctx.fillStyle = '#e9d5ff';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('DOLLI', pad + 24, panelY + 40);
  ctx.fillStyle = '#fff';
  ctx.font = '22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(truncateUrl(opts.shareUrl, 42), pad + 24, panelY + 78);
}

function drawWideLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  title: string,
  note: string | undefined,
  opts: ShareCardRenderOpts,
  cover: HTMLImageElement | null,
): void {
  const split = Math.round(W * 0.52);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, split, H);

  const pad = 64;
  let y = 100;
  ctx.fillStyle = '#fff';
  ctx.font = '800 48px system-ui, -apple-system, sans-serif';
  for (const ln of wrapLines(ctx, title, split - pad * 2).slice(0, 3)) {
    ctx.fillText(ln, pad, y);
    y += 56;
  }
  const stats = buildStatsLine(opts);
  if (stats) {
    ctx.font = '500 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(stats, pad, y + 16);
    y += 56;
  }
  if (opts.goal != null && opts.goal > 0 && opts.pct != null) {
    const barW = split - pad * 2;
    const barY = y + 20;
    const barH = 12;
    const pct = Math.min(opts.pct, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawRoundRect(ctx, pad, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = '#34d399';
    drawRoundRect(ctx, pad, barY, (barW * pct) / 100, barH, barH / 2);
    ctx.fill();
    y = barY + 48;
  }
  if (note) {
    ctx.font = 'italic 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (const ln of wrapLines(ctx, note, split - pad * 2).slice(0, 2)) {
      ctx.fillText(ln, pad, y);
      y += 32;
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  drawRoundRect(ctx, pad, H - 140, split - pad * 2, 88, 16);
  ctx.fill();
  ctx.fillStyle = '#c4b5fd';
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('DOLLI', pad + 24, H - 108);
  ctx.fillStyle = '#fff';
  ctx.font = '22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(truncateUrl(opts.shareUrl, 48), pad + 24, H - 72);

  const imgX = split + 32;
  const imgW = W - split - 64;
  const imgH = H - 64;
  const imgY = 32;
  const r = 24;
  if (cover && cover.width > 0) {
    ctx.save();
    drawRoundRect(ctx, imgX, imgY, imgW, imgH, r);
    ctx.clip();
    const ar = cover.width / cover.height;
    const boxAr = imgW / imgH;
    let dw = imgW;
    let dh = imgH;
    let dx = imgX;
    let dy = imgY;
    if (ar > boxAr) {
      dh = imgW / ar;
      dy = imgY + (imgH - dh) / 2;
    } else {
      dw = imgH * ar;
      dx = imgX + (imgW - dw) / 2;
    }
    ctx.drawImage(cover, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    drawRoundRect(ctx, imgX, imgY, imgW, imgH, r);
    ctx.fill();
  }
}

function buildStatsLine(opts: ShareCardRenderOpts): string | null {
  const parts: string[] = [];
  if (opts.raised != null && opts.goal != null && opts.goal > 0) {
    parts.push(`${money(opts.raised)} / ${money(opts.goal)}`);
    if (opts.pct != null) parts.push(`${Math.round(Math.min(opts.pct, 100))}%`);
  } else if (opts.raised != null) {
    parts.push(`${money(opts.raised)} raised`);
  }
  if (opts.donorCount != null && opts.donorCount > 0) {
    parts.push(`${opts.donorCount} donors`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function truncateUrl(u: string, max: number): string {
  if (u.length <= max) return u;
  return `${u.slice(0, max - 1)}…`;
}

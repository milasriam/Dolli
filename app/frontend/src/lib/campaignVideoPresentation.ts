/**
 * Map user-pasted video URLs to something the browser can play.
 * <video src> only works for direct media URLs; YouTube / Google Drive need an iframe embed.
 */

export type VideoPresentation =
  | { kind: 'native'; src: string }
  | { kind: 'iframe'; src: string; title?: string }
  | { kind: 'none' };

function extractYouTubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        const id = u.pathname.slice('/embed/'.length).split('/')[0];
        return id && /^[a-zA-Z0-9_-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) return v;
    }
  } catch {
    return null;
  }
  return null;
}

/** File id + optional resource key (required for some “anyone with the link” embeds). */
function extractDriveEmbed(raw: string): { fileId: string; resourceKey: string | null } | null {
  const s = raw.trim();
  if (!s) return null;

  let fileId: string | null = null;
  let resourceKey: string | null = null;

  const readResourceKey = (u: URL) =>
    u.searchParams.get('resourcekey') || u.searchParams.get('resourceKey');

  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    resourceKey = readResourceKey(u);

    if (host === 'drive.google.com') {
      const m = u.pathname.match(/^(?:\/u\/\d+)?\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m) fileId = m[1];
      else if (u.pathname === '/open' || u.pathname === '/open/') {
        const id = u.searchParams.get('id');
        if (id && /^[a-zA-Z0-9_-]+$/.test(id)) fileId = id;
      } else if (u.pathname === '/uc' || u.pathname === '/uc/') {
        const id = u.searchParams.get('id');
        if (id && /^[a-zA-Z0-9_-]+$/.test(id)) fileId = id;
      }
    } else if (host === 'docs.google.com') {
      const m = u.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m) fileId = m[1];
      else if (u.pathname === '/uc' || u.pathname === '/uc/') {
        const id = u.searchParams.get('id');
        if (id && /^[a-zA-Z0-9_-]+$/.test(id)) fileId = id;
      }
    }
  } catch {
    // ignore
  }

  if (!fileId) {
    const m = s.match(/drive\.google\.com(?:\/u\/\d+)?\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (m) fileId = m[1];
  }

  if (!fileId || !/^[a-zA-Z0-9_-]{6,}$/.test(fileId)) return null;

  if (!resourceKey) {
    try {
      resourceKey = readResourceKey(new URL(s));
    } catch {
      resourceKey = null;
    }
  }

  return { fileId, resourceKey };
}

function drivePreviewSrc(fileId: string, resourceKey: string | null): string {
  const base = `https://drive.google.com/file/d/${fileId}/preview`;
  if (!resourceKey) return base;
  const q = new URLSearchParams({ resourcekey: resourceKey });
  return `${base}?${q.toString()}`;
}

export function parseVideoPresentation(url: string): VideoPresentation {
  const u = url.trim();
  if (!u) return { kind: 'none' };

  const yt = extractYouTubeId(u);
  if (yt) {
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1`,
      title: 'YouTube video',
    };
  }

  const drive = extractDriveEmbed(u);
  if (drive) {
    return {
      kind: 'iframe',
      src: drivePreviewSrc(drive.fileId, drive.resourceKey),
      title: 'Google Drive video',
    };
  }

  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u)) {
    return { kind: 'native', src: u };
  }

  if (u.startsWith('https://') || u.startsWith('http://')) {
    return { kind: 'native', src: u };
  }

  return { kind: 'none' };
}

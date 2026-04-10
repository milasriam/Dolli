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

function extractDriveFileId(raw: string): string | null {
  const m = raw.trim().match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  return m ? m[1] : null;
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

  const driveId = extractDriveFileId(u);
  if (driveId) {
    return {
      kind: 'iframe',
      src: `https://drive.google.com/file/d/${driveId}/preview`,
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

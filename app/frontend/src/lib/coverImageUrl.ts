/**
 * Turn common “share” URLs into a direct-ish image URL where possible.
 * Google Drive “anyone with the link” pages are HTML — browsers need /uc?export=view&id=…
 */
export function normalizePastedCoverImageUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;

  const fileD = s.match(/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/[^?\s]*)?/i);
  if (fileD) {
    return `https://drive.google.com/uc?export=view&id=${fileD[1]}`;
  }

  const openId = s.match(/https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (openId) {
    return `https://drive.google.com/uc?export=view&id=${openId[1]}`;
  }

  return s;
}

/**
 * Platform-ready copy: body text only (no URL). Call sites append the share URL.
 * Tones map to different voice; surfaces map to length + formatting habits per app.
 */

export type ShareTone = 'warm' | 'punchy' | 'pro';

export type ShareSurface =
  | 'whatsapp'
  | 'telegram'
  | 'threads'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'sms'
  | 'native'
  | 'copy'
  | 'instagram_stories'
  | 'instagram_post'
  | 'instagram_reels'
  | 'tiktok_story'
  | 'youtube_shorts';

export type ShareCopyVars = {
  title: string;
  context: 'support' | 'donated';
  /** USD whole dollars */
  raisedUsd?: number;
  goalUsd?: number;
  /** 0–100 */
  pct?: number | null;
  donorCount?: number;
  /** User-written line; appended where space allows */
  customNote?: string;
};

function titleSafe(t: string): string {
  const s = t.trim();
  return s || 'this fundraiser';
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function statsFragment(v: ShareCopyVars): string | null {
  const { raisedUsd, goalUsd, pct, donorCount } = v;
  const parts: string[] = [];
  if (raisedUsd != null && goalUsd != null && goalUsd > 0) {
    parts.push(`${money(raisedUsd)} / ${money(goalUsd)} raised`);
    if (pct != null && Number.isFinite(pct)) {
      parts.push(`${Math.round(Math.min(pct, 100))}%`);
    }
  } else if (raisedUsd != null) {
    parts.push(`${money(raisedUsd)} raised so far`);
  }
  if (donorCount != null && donorCount > 0) {
    parts.push(`${donorCount.toLocaleString()} ${donorCount === 1 ? 'donor' : 'donors'}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function appendNote(body: string, note?: string): string {
  const n = note?.trim();
  if (!n) return body;
  return `${body}\n\n— ${n}`;
}

function donatedVerb(tone: ShareTone): string {
  if (tone === 'punchy') return 'I just threw in on';
  if (tone === 'pro') return 'I contributed to';
  return 'I just supported';
}

function supportVerb(tone: ShareTone): string {
  if (tone === 'punchy') return 'This needs eyes';
  if (tone === 'pro') return 'Worth amplifying';
  return 'Passing along';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

/** Body copy only — never include the tracking URL here. */
export function copyForSurface(surface: ShareSurface, vars: ShareCopyVars, tone: ShareTone = 'warm'): string {
  const title = titleSafe(vars.title);
  const stats = statsFragment(vars);
  const donated = vars.context === 'donated';
  const dv = donatedVerb(tone);
  const sv = supportVerb(tone);

  const baseDonated =
    tone === 'punchy'
      ? `${dv} "${title}" on Dolli. Micro-donations stack — your turn.`
      : tone === 'pro'
        ? `${dv} "${title}" on Dolli (micro-donations). Sharing in case it resonates with your network.`
        : `${dv} "${title}" on Dolli. If you can spare even a little, it genuinely helps.`;

  const baseSupport =
    tone === 'punchy'
      ? `${sv}: "${title}" on Dolli. Tap in — small $, loud impact.`
      : tone === 'pro'
        ? `Fundraising: "${title}" on Dolli — transparent progress, micro-donations welcome.`
        : `${sv} a fundraiser that stuck with me: "${title}" on Dolli. Small gifts add up fast.`;

  const core = donated ? baseDonated : baseSupport;

  switch (surface) {
    case 'twitter': {
      const withStats = stats ? `${core} (${stats})` : core;
      const withNote = appendNote(withStats, vars.customNote);
      return truncate(withNote, 230);
    }
    case 'threads': {
      const hook =
        tone === 'punchy'
          ? `Dolli drop-in 🎯\n\n`
          : tone === 'pro'
            ? `Quick share —\n\n`
            : `Something good on Dolli:\n\n`;
      const mid = stats ? `${core}\n\n${stats}` : core;
      return appendNote(`${hook}${mid}`, vars.customNote);
    }
    case 'linkedin': {
      const head = donated
        ? `Proud to support a grassroots fundraiser on Dolli.`
        : `Sharing a fundraiser built for small, repeated support (not one big check).`;
      const block = `${head}\n\n"${title}"\n${stats ? `${stats}\n` : ''}\nIf it aligns with your values, the link is a gentle way to help surface momentum.`;
      return appendNote(block, vars.customNote);
    }
    case 'facebook': {
      const para = stats
        ? `${core}\n\nProgress: ${stats}\n\nEvery share widens the circle.`
        : `${core}\n\nEvery share widens the circle.`;
      return appendNote(para, vars.customNote);
    }
    case 'instagram_stories': {
      // Short — user puts URL in sticker; on-image text is the hook
      const hook = donated ? `I backed this on Dolli ✨` : `This fundraiser hits`;
      const sub = truncate(title, 42);
      return appendNote(`${hook}\n"${sub}"\n\n👇 link sticker`, vars.customNote);
    }
    case 'instagram_post':
    case 'instagram_reels': {
      const emoji = tone === 'punchy' ? '⚡️' : tone === 'pro' ? '' : '💜';
      const head = donated
        ? `${emoji ? `${emoji} ` : ''}Backed "${title}" on Dolli — micro-donations that actually move the needle.`
        : `${emoji ? `${emoji} ` : ''}Found "${title}" on Dolli — chip in if you can, share if you can't.`;
      const mid = stats ? `\n\n${stats}` : '';
      const tags =
        surface === 'instagram_reels'
          ? '\n\n#fundraiser #community #dolli #giveback #reels'
          : '\n\n#fundraiser #community #dolli #giveback';
      return appendNote(`${head}${mid}${tags}`, vars.customNote);
    }
    case 'tiktok':
    case 'tiktok_story': {
      const cap =
        tone === 'punchy'
          ? `${donated ? 'I put $ behind this' : 'Algorithm do your thing'} — "${truncate(title, 60)}" on Dolli`
          : `${donated ? 'Supported this cause' : 'Sharing this'}: "${truncate(title, 60)}" — Dolli link in bio energy but it’s one tap 👇`;
      const tag = '\n\n#dolli #fyp #fundraiser #charity';
      return appendNote(`${cap}${tag}`, vars.customNote);
    }
    case 'youtube_shorts': {
      return appendNote(
        `${donated ? 'I donated to' : 'Quick signal boost for'} "${title}" on Dolli.${stats ? ` ${stats}.` : ''} Link below — even $1 helps.`,
        vars.customNote,
      );
    }
    case 'sms': {
      const short = donated
        ? `I gave to "${truncate(title, 50)}" on Dolli — thought of you:`
        : `Check "${truncate(title, 50)}" on Dolli:`;
      return appendNote(short, vars.customNote);
    }
    case 'telegram': {
      const mid = stats ? `${core}\n\n📊 ${stats}` : core;
      return appendNote(mid, vars.customNote);
    }
    case 'whatsapp': {
      const mid = stats ? `${core}\n\n${stats}` : core;
      return appendNote(mid, vars.customNote);
    }
    case 'native':
    case 'copy':
      return appendNote(stats ? `${core}\n\n${stats}` : core, vars.customNote);
    default:
      return appendNote(core, vars.customNote);
  }
}

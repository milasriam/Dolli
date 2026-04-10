/**
 * Generates PNG app icons from public/brand/dolli-mark.svg for the PWA manifest.
 * Run: node scripts/make-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public/brand/dolli-mark.svg');
const outDir = join(root, 'public/pwa');

mkdirSync(outDir, { recursive: true });
const svg = readFileSync(svgPath);
const bg = { r: 10, g: 10, b: 15, alpha: 1 };

async function writeSquare(size, filename) {
  await sharp(svg)
    .resize(size, size, { fit: 'contain', background: bg })
    .png()
    .toFile(join(outDir, filename));
}

/** Extra padding for maskable safe zone (circle crop on launchers). */
async function writeMaskable(size, filename) {
  const inner = Math.round(size * 0.72);
  const pad = Math.floor((size - inner) / 2);
  await sharp(svg)
    .resize(inner, inner, { fit: 'contain', background: bg })
    .extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: bg,
    })
    .png()
    .toFile(join(outDir, filename));
}

await writeSquare(192, 'icon-192.png');
await writeSquare(512, 'icon-512.png');
await writeMaskable(512, 'icon-512-maskable.png');

console.log('Wrote public/pwa/icon-192.png, icon-512.png, icon-512-maskable.png');

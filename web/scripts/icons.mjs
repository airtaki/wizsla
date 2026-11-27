/**
 * Draws the app icons and iOS startup images into public/ from the SVG
 * below. Run after changing the icon: `npm run icons`, then commit the PNGs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { SPLASH_SIZES, splashFile, THEMES } from './splash-sizes.mjs';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * The bulb on a 1024 square. Full bleed: iOS rounds the corners itself.
 * Everything stays inside the central 80% circle, so Android's masks
 * (maskable icons) never cut into it.
 */
const BULB = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#27272a"/>
      <stop offset="1" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="512" cy="416" r="440" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbbf24" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glass" cx="460" cy="350" r="260" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fef3c7"/>
      <stop offset="0.55" stop-color="#fcd34d"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="416" r="440" fill="url(#glow)"/>
  <circle cx="512" cy="416" r="208" fill="url(#glass)"/>
  <rect x="400" y="656" width="224" height="64" rx="32" fill="#fbbf24"/>
  <rect x="432" y="752" width="160" height="64" rx="32" fill="#d97706"/>
`;

const icon = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${BULB}</svg>`;

/** The icon, rounded like on the home screen, centred on a plain screen. */
function splash({ width, height, ratio }, background) {
  const w = width * ratio;
  const h = height * ratio;
  const size = Math.round(Math.min(w, h) * 0.3);
  const x = Math.round((w - size) / 2);
  const y = Math.round((h - size) / 2);
  const scale = size / 1024;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${background}"/>
    <clipPath id="round"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.225}"/></clipPath>
    <g clip-path="url(#round)">
      <g transform="translate(${x} ${y}) scale(${scale})">${BULB}</g>
    </g>
  </svg>`;
}

function write(file, svg) {
  const path = join(PUBLIC, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, new Resvg(svg).render().asPng());
  console.log(file);
}

write('apple-touch-icon.png', icon(180));
write('icons/icon-192.png', icon(192));
write('icons/icon-512.png', icon(512));
for (const size of SPLASH_SIZES) {
  for (const [theme, background] of Object.entries(THEMES)) {
    write(splashFile(size, theme), splash(size, background));
  }
}

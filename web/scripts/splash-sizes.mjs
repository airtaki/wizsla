/**
 * iPhone screens (portrait, CSS pixels and pixel ratio) that get their own
 * startup image. iOS shows one only when a media query matches exactly;
 * other models start on the plain background colour instead.
 */
export const SPLASH_SIZES = [
  { width: 440, height: 956, ratio: 3 }, // 16/17 Pro Max
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 402, height: 874, ratio: 3 }, // 16/17 Pro, 17
  { width: 430, height: 932, ratio: 3 }, // 14/15 Pro Max, 15/16 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 375, height: 667, ratio: 2 }, // 8, SE 2/3
];

export const THEMES = {
  light: '#fafafa',
  dark: '#09090b',
};

export function splashFile({ width, height, ratio }, theme) {
  return `splash/${width}x${height}@${ratio}x-${theme}.png`;
}

/** The `<link>` tags for index.html, relative to the app's base. */
export function splashLinks(base) {
  return SPLASH_SIZES.flatMap((size) =>
    Object.keys(THEMES).map((theme) => {
      const media = [
        `(device-width: ${size.width}px)`,
        `(device-height: ${size.height}px)`,
        `(-webkit-device-pixel-ratio: ${size.ratio})`,
        '(orientation: portrait)',
        `(prefers-color-scheme: ${theme})`,
      ].join(' and ');
      return `<link rel="apple-touch-startup-image" media="${media}" href="${base}${splashFile(size, theme)}" />`;
    }),
  ).join('\n    ');
}

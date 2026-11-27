/** Types for splash-sizes.mjs, which vite.config.ts imports. */
export interface SplashSize {
  width: number;
  height: number;
  ratio: number;
}
export declare const SPLASH_SIZES: SplashSize[];
export declare const THEMES: Record<'light' | 'dark', string>;
export declare function splashFile(size: SplashSize, theme: string): string;
export declare function splashLinks(base: string): string;

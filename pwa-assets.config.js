import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: combinePresetAndAppleSplashScreens(minimal2023Preset, {
    darkSplashScreen: { color: '#0a0a0f', offset: 0 },
    lightSplashScreen: { color: '#0a0a0f', offset: 0 },
    padding: 0.3,
    resizeOptions: { background: '#0a0a0f', fit: 'contain' },
    linkMediaOptions: {
      addMediaScreen: true,
      xhtml: false,
    },
    sizes: [
      { width: 2048, height: 2732 }, // 12.9" iPad Pro portrait
      { width: 1668, height: 2388 }, // 11" iPad Pro portrait
      { width: 1536, height: 2048 }, // iPad Mini or Air portrait
      { width: 1290, height: 2796 }, // iPhone 14 Pro Max
      { width: 1179, height: 2556 }, // iPhone 14 Pro
      { width: 1170, height: 2532 }, // iPhone 12/13/14
      { width: 1080, height: 2340 }, // iPhone SE 3rd gen
      { width: 828, height: 1792 },  // iPhone XR/11
      { width: 750, height: 1334 },  // iPhone 8/SE
    ],
  }),
  images: ['public/icon.svg'],
});

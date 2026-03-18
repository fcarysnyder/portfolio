// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.fcarysnyder.com',
  integrations: [react(), mdx()],
  vite: {
    resolve: {
      // `react-tweet` ships CSS modules that need to be processed by Vite
      // during build, not treated as external.
      noExternal: ['react-tweet'],
    },
    ssr: {
      noExternal: ['react-tweet'],
    },
  },
});

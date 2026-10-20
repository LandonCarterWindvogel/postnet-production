import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages hosts this repository below /postnet-production/.
// Netlify and local development serve it from the site root.
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
const base = isGitHubPagesBuild ? '/postnet-production/' : '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PostNet Production',
        short_name: 'Production',
        description: 'Production workflow management for PostNet.',
        theme_color: '#123b31',
        background_color: '#f6f7f4',
        display: 'standalone',
        start_url: base,
        icons: [{ src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      }
    })
  ]
});

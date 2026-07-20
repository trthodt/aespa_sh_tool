import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    crx({ manifest }),
    react({
      include: /\.(js|jsx|ts|tsx)$/,
      bundledDev: true,
    })
  ],
})

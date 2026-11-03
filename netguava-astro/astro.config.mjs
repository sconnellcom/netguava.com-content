import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://netguava.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
});

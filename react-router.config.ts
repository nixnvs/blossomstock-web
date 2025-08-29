import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: './src/app',

  // We’re deploying as a static Single-Page App
  ssr: false,

  // Don’t prerender anything (the SPA will hydrate at runtime)
  prerender: []
} satisfies Config;
// apps/web/react-router.config.ts
import type { Config } from '@react-router/dev/config';

export default {
  appDirectory: './src/app',
  ssr: false,          // SPA build (emits index.html)
  // no `prerender`
} satisfies Config;
import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { mobileTools } from '@e2e-dev/mobile/tools';
import { gateway } from 'ai';

const android = mobile({ platform: 'android' });

export default {
  tests: 'tests/**/*.e2e.ts',
  targets: [
    { name: 'android', engine: android, app: { bundleId: 'com.mtc.qlikanswersapp' } },
  ],
  workers: 1,
  agents: {
    default: {
      // Agent steps read AI_GATEWAY_API_KEY. Tests without agent steps need no model.
      model: gateway('openai/gpt-6-luna-fast'),
      tools: mobileTools(android),
    },
  },
} satisfies E2EConfig;

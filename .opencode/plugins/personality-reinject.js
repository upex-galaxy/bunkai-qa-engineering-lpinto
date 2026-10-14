import { Plugin } from '@opencode/plugin';
import { PERSONALITY_CONTRACT } from '../../.agents/hooks/personality-reinject.mjs';

export default Plugin.define({
  id: 'personality-reinject',
  async setup(ctx) {
    await ctx.session.hook('context', (event) => {
      const alreadyPresent = event.system.some(
        block => block.type === 'text' && block.text.includes(PERSONALITY_CONTRACT),
      );
      if (!alreadyPresent) {
        event.system.push({ type: 'text', text: PERSONALITY_CONTRACT });
      }
    });
  },
});

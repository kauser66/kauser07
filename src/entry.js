import worker from './index.js';
import { handleManifest, handleIcon } from './app.js';

/* প্রধান প্রবেশবিন্দু: অ্যাপের manifest ও আইকন এখানে, বাকি সব আগের index.js এ */
export default {
  async fetch(request, env, ctx) {
    const p = new URL(request.url).pathname;
    if (p === '/manifest.webmanifest') return handleManifest(request, env);
    if (p === '/app-icon.png') return handleIcon();
    return worker.fetch(request, env, ctx);
  },
};

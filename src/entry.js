import worker from './index.js';
import { handleManifest, handleIcon } from './app.js';

/* প্রধান প্রবেশবিন্দু: অ্যাপের manifest/আইকন, সাইটে লাইভ আপডেট স্ক্রিপ্ট যোগ, বাকি সব index.js এ */
export default {
  async fetch(request, env, ctx) {
    const p = new URL(request.url).pathname;
    if (p === '/manifest.webmanifest') return handleManifest(request, env);
    if (p === '/app-icon.png') return handleIcon();
    if (p === '/' || p === '/index.html') {
      const res = await env.ASSETS.fetch(request);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || ct.indexOf('text/html') === -1) return res;
      return new HTMLRewriter()
        .on('body', { element(el) { el.append("<script src='/live.js'></script>", { html: true }); } })
        .transform(res);
    }
    return worker.fetch(request, env, ctx);
  },
};

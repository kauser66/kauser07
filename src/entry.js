import worker from './index.js';
import { handleManifest, handleIcon } from './app.js';

/* Google অনুবাদের লোগো/স্পিনার লুকানোর স্টাইল */
const GT_CSS = '.goog-te-spinner-pos,.goog-te-spinner-animation,.goog-te-spinner,.goog-te-spinner-img{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}body>.skiptranslate,iframe.skiptranslate,.goog-te-banner-frame{display:none!important}.notranslate,[translate=no]{translate:no}';

/* প্রধান প্রবেশবিন্দু: অ্যাপের manifest/আইকন, সাইটে লাইভ আপডেট স্ক্রিপ্ট ও অনুবাদ সংশোধন */
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
        .on('head', { element(el) { el.append('<style>' + GT_CSS + '</style>', { html: true }); } })
        .on('#dynamic-date, #dynamic-time, [data-t]', {
          element(el) {
            el.setAttribute('translate', 'no');
            const c = el.getAttribute('class');
            el.setAttribute('class', (c ? c + ' ' : '') + 'notranslate');
          },
        })
        .on('body', { element(el) { el.append("<script src='/live.js'></script>", { html: true }); } })
        .transform(res);
    }
    return worker.fetch(request, env, ctx);
  },
};

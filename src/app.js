/* অ্যাপের নাম ও লোগো: CMS এর “অ্যাপের নাম ও লোগো” (data/app.json) থেকে manifest বানায়।
   লোগো খালি থাকলে ডিফল্ট আইকন (শাহবাজপুর পূর্ব পাড়ার লোগো) ব্যবহার হয়। */
const DEFAULT_ICON_B64 = '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';

function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}

export async function handleManifest(request, env) {
  let cfg = {};
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/data/app.json', request.url)));
    if (r.ok) cfg = await r.json();
  } catch (e) {
    /* ডিফল্ট মান ব্যবহার হবে */
  }
  const name = clip(cfg.app_name, 60) || 'শাহবাজপুর পূর্ব পাড়া';
  const shortName = clip(cfg.short_name, 16) || 'শাহবাজপুর';
  const logo = clip(cfg.logo, 200).replace(/^\/+/, '');

  let icons;
  if (logo) {
    const ext = (logo.split('.').pop() || '').toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
    const src = '/' + encodeURI(logo);
    icons = [
      { src, sizes: '192x192', type, purpose: 'any' },
      { src, sizes: '512x512', type, purpose: 'any' },
    ];
  } else {
    icons = [
      { src: '/app-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ];
  }

  const manifest = {
    name,
    short_name: shortName,
    description: 'শাহবাজপুর পূর্বপাড়া, জামালপুর সদর — গ্রামের খবর, মানুষ ও প্রতিষ্ঠান',
    lang: 'bn',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#025802',
    theme_color: '#d32f2f',
    icons,
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

export function handleIcon() {
  const bin = atob(DEFAULT_ICON_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
}

/* শাহবাজপুর পূর্বপাড়া — Cloudflare Worker
   রেটিং + দর্শকের পোস্ট (খবর / স্বেচ্ছাসেবক) + অনুমোদন প্যানেলের API
   D1 = DB, R2 = PHOTOS, গোপন পাসওয়ার্ড = ADMIN_KEY (Secret) */

const ENC = new TextEncoder();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^https?:\/\/\S{4,400}$/i;
const PHONE_RE = /^[0-9\u09E6-\u09EF+\-\s]{6,20}$/;
const KEY_RE = /^[0-9a-f-]{36}\.jpg$/;
const MAX_IMG = 1500000;
const DAYS_OK = [1, 3, 7, 15, 30];

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}
function err(error, status = 400) {
  return json({ ok: false, error }, status);
}
function clip(v, n) {
  return String(v == null ? '' : v).trim().slice(0, n);
}
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', ENC.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function ipHash(request) {
  return (await sha256('ip-v1:' + (request.headers.get('CF-Connecting-IP') || 'x'))).slice(0, 32);
}
function sameOrigin(request, url) {
  const o = request.headers.get('Origin');
  if (!o) return true;
  try {
    return new URL(o).host === url.host;
  } catch (e) {
    return false;
  }
}
function bnDate(s) {
  try {
    return new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('bn-BD', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka',
    });
  } catch (e) {
    return '';
  }
}

/* ===== স্বেচ্ছাসেবকের নামের তালিকা (CMS + অনুমোদিত দর্শকের পোস্ট) ===== */
async function volunteerNames(request, env) {
  const names = new Set();
  const res = await env.ASSETS.fetch(new Request(new URL('/data/volunteers.json', request.url)));
  if (res.ok) {
    const j = await res.json();
    const list = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : [];
    list.forEach((v) => v && v.name && names.add(v.name));
  }
  const { results } = await env.DB.prepare(`SELECT name FROM submissions WHERE kind = 'volunteer' AND status = 'approved'`).all();
  results.forEach((r) => r.name && names.add(r.name));
  return names;
}

/* ===== রেটিং ===== */
async function handleRatings(env) {
  const { results } = await env.DB.prepare(
    'SELECT volunteer, ROUND(AVG(stars), 1) AS avg, COUNT(*) AS count FROM ratings GROUP BY volunteer'
  ).all();
  const out = {};
  for (const r of results) out[r.volunteer] = { avg: r.avg, count: r.count };
  return json(out, 200, { 'Cache-Control': 'public, max-age=30' });
}

async function handleRate(request, env, url) {
  if (!sameOrigin(request, url)) return err('forbidden', 403);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return err('bad_request');
  }
  const volunteer = clip(body.volunteer, 120);
  const stars = Number(body.stars);
  const email = clip(body.email, 100).toLowerCase();
  if (!volunteer) return err('bad_request');
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return err('bad_stars');
  if (!EMAIL_RE.test(email)) return err('bad_email');
  const names = await volunteerNames(request, env);
  if (!names.has(volunteer)) return err('unknown_volunteer');
  const hash = await sha256('shahbajpur-ratings-v1:' + email);
  await env.DB.prepare(
    `INSERT INTO ratings (volunteer, stars, email_hash) VALUES (?1, ?2, ?3) ON CONFLICT (volunteer, email_hash) DO UPDATE SET stars = excluded.stars, created_at = datetime('now')`
  ).bind(volunteer, stars, hash).run();
  return json({ ok: true });
}

/* ===== দর্শকের পোস্ট জমা দেওয়া ===== */
async function handleSubmit(request, env) {
  if (Number(request.headers.get('Content-Length') || 0) > 4500000) return err('too_big', 413);
  let fd;
  try {
    fd = await request.formData();
  } catch (e) {
    return err('bad_request');
  }
  if (fd.get('website')) return json({ ok: true });
  const kind = fd.get('kind');
  if (kind !== 'news' && kind !== 'volunteer') return err('bad_request');
  const submitter = clip(fd.get('submitter'), 80);
  if (!submitter) return err('need_submitter');

  const ih = await ipHash(request);
  const mine = await env.DB.prepare(`SELECT COUNT(*) AS c FROM submissions WHERE ip_hash = ?1 AND created_at > datetime('now', '-1 day')`).bind(ih).first();
  if (mine && mine.c >= 5) return err('limit', 429);
  const pend = await env.DB.prepare(`SELECT COUNT(*) AS c FROM submissions WHERE status = 'pending'`).first();
  if (pend && pend.c >= 300) return err('busy', 503);

  const r = { name: null, title: null, body: null, house: null, address: null, phone: null, fb: null, map: null, cat: null, days: null };
  if (kind === 'volunteer') {
    r.name = clip(fd.get('name'), 80);
    if (!r.name) return err('need_name');
    r.house = clip(fd.get('house'), 80);
    r.address = clip(fd.get('address'), 120);
    r.body = clip(fd.get('about'), 500);
    r.phone = clip(fd.get('phone'), 20);
    r.fb = clip(fd.get('fb'), 400);
    r.map = clip(fd.get('map'), 400);
    if (r.phone && !PHONE_RE.test(r.phone)) return err('bad_phone');
    if (r.fb && !URL_RE.test(r.fb)) return err('bad_fb');
    if (r.map && !URL_RE.test(r.map)) return err('bad_map');
  } else {
    r.title = clip(fd.get('title'), 150);
    r.body = clip(fd.get('text'), 3000);
    r.cat = clip(fd.get('cat'), 40);
    if (!r.title || !r.body) return err('need_news');
    const d = parseInt(fd.get('days'), 10);
    r.days = DAYS_OK.includes(d) ? d : 7;
  }

  const files = fd.getAll('photo').filter((f) => f && typeof f === 'object' && f.size > 0).slice(0, kind === 'news' ? 2 : 1);
  if (kind === 'volunteer' && !files.length) return err('need_photo');
  const bufs = [];
  for (const f of files) {
    if (f.size > MAX_IMG) return err('img_big');
    const buf = await f.arrayBuffer();
    const b = new Uint8Array(buf);
    if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)) return err('img_type');
    bufs.push(buf);
  }
  const keys = [];
  for (const buf of bufs) {
    const key = crypto.randomUUID() + '.jpg';
    await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: 'image/jpeg' } });
    keys.push(key);
  }
  await env.DB.prepare(
    'INSERT INTO submissions (kind, submitter, name, title, body, house, address, phone, fb, map, cat, photo1, photo2, days, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)'
  ).bind(kind, submitter, r.name, r.title, r.body, r.house, r.address, r.phone, r.fb, r.map, r.cat, keys[0] || null, keys[1] || null, r.days, ih).run();
  return json({ ok: true });
}

/* ===== সাইটে দেখানোর জন্য অনুমোদিত পোস্ট ===== */
async function handleContent(env) {
  const v = await env.DB.prepare(`SELECT * FROM submissions WHERE kind = 'volunteer' AND status = 'approved' ORDER BY decided_at ASC, id ASC`).all();
  const n = await env.DB.prepare(`SELECT * FROM submissions WHERE kind = 'news' AND status = 'approved' AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY decided_at DESC, id DESC`).all();
  const ph = (k) => (k ? '/api/photo/' + k : '');
  return json({
    volunteers: v.results.map((x) => ({ name: x.name, photo: ph(x.photo1), house: x.house || '', address: x.address || '', about: x.body || '', phone: x.phone || '', fb: x.fb || '', map: x.map || '' })),
    news: n.results.map((x) => ({ title: x.title, text: x.body || '', cat: x.cat || '', date: bnDate(x.decided_at), photo: ph(x.photo1), photo2: ph(x.photo2) })),
  }, 200, { 'Cache-Control': 'public, max-age=20' });
}

async function handlePhoto(p, env) {
  const key = p.slice('/api/photo/'.length);
  if (!KEY_RE.test(key)) return err('not_found', 404);
  const row = await env.DB.prepare(`SELECT 1 AS ok FROM submissions WHERE status = 'approved' AND (photo1 = ?1 OR photo2 = ?1) LIMIT 1`).bind(key).first();
  if (!row) return err('not_found', 404);
  const obj = await env.PHOTOS.get(key);
  if (!obj) return err('not_found', 404);
  return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' } });
}

/* ===== অনুমোদন প্যানেল (পাসওয়ার্ড সুরক্ষিত) ===== */
async function adminGate(request, env) {
  if (!env.ADMIN_KEY) return err('not_configured', 503);
  const ih = await ipHash(request);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM admin_fails WHERE ip_hash = ?1 AND ts > ?2').bind(ih, now - 3600).first();
  if (row && row.c >= 10) return err('too_many', 429);
  const given = await crypto.subtle.digest('SHA-256', ENC.encode(request.headers.get('X-Admin-Key') || ''));
  const real = await crypto.subtle.digest('SHA-256', ENC.encode(env.ADMIN_KEY));
  if (!crypto.subtle.timingSafeEqual(given, real)) {
    await env.DB.prepare('DELETE FROM admin_fails WHERE ts < ?1').bind(now - 86400).run();
    await env.DB.prepare('INSERT INTO admin_fails (ip_hash, ts) VALUES (?1, ?2)').bind(ih, now).run();
    return err('unauthorized', 401);
  }
  return null;
}

const VIEWS = {
  pending: `status = 'pending' ORDER BY id ASC`,
  live: `status = 'approved' AND (kind = 'volunteer' OR expires_at IS NULL OR expires_at > datetime('now')) ORDER BY decided_at DESC`,
  archive: `status = 'approved' AND kind = 'news' AND expires_at IS NOT NULL AND expires_at <= datetime('now') ORDER BY expires_at DESC`,
  rejected: `status = 'rejected' ORDER BY decided_at DESC`,
};

async function handleAdmin(request, env, url) {
  const deny = await adminGate(request, env);
  if (deny) return deny;
  const p = url.pathname;

  if (p === '/api/admin/list' && request.method === 'GET') {
    const v = url.searchParams.get('view');
    if (!VIEWS[v]) return err('bad_request');
    const { results } = await env.DB.prepare(
      `SELECT id, kind, status, submitter, name, title, body, house, address, phone, fb, map, cat, photo1, photo2, days, created_at, decided_at, expires_at FROM submissions WHERE ${VIEWS[v]} LIMIT 200`
    ).all();
    const pc = await env.DB.prepare(`SELECT COUNT(*) AS c FROM submissions WHERE status = 'pending'`).first();
    return json({ items: results, pending: pc ? pc.c : 0 });
  }

  if (p.startsWith('/api/admin/photo/') && request.method === 'GET') {
    const key = p.slice('/api/admin/photo/'.length);
    if (!KEY_RE.test(key)) return err('not_found', 404);
    const obj = await env.PHOTOS.get(key);
    if (!obj) return err('not_found', 404);
    return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' } });
  }

  if ((p === '/api/admin/decide' || p === '/api/admin/delete') && request.method === 'POST') {
    let b;
    try {
      b = await request.json();
    } catch (e) {
      return err('bad_request');
    }
    const id = Number(b.id);
    const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?1').bind(id).first();
    if (!row) return err('not_found', 404);

    if (p === '/api/admin/delete') {
      const keys = [row.photo1, row.photo2].filter(Boolean);
      if (keys.length) await env.PHOTOS.delete(keys);
      await env.DB.prepare('DELETE FROM submissions WHERE id = ?1').bind(id).run();
      return json({ ok: true });
    }

    if (b.action === 'approve') {
      let days = null;
      if (row.kind === 'news') {
        days = parseInt(b.days, 10) || row.days || 7;
        days = Math.min(Math.max(days, 1), 365);
      }
      await env.DB.prepare(
        `UPDATE submissions SET status = 'approved', decided_at = datetime('now'), expires_at = CASE WHEN kind = 'news' THEN datetime('now', ?2) ELSE NULL END WHERE id = ?1`
      ).bind(id, '+' + (days || 7) + ' days').run();
      return json({ ok: true });
    }
    if (b.action === 'reject') {
      await env.DB.prepare(`UPDATE submissions SET status = 'rejected', decided_at = datetime('now'), expires_at = NULL WHERE id = ?1`).bind(id).run();
      return json({ ok: true });
    }
    return err('bad_request');
  }
  return err('not_found', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (p === '/api/ratings' && request.method === 'GET') return await handleRatings(env);
      if (p === '/api/rate' && request.method === 'POST') return await handleRate(request, env, url);
      if (p === '/api/content' && request.method === 'GET') return await handleContent(env);
      if (p === '/api/submit' && request.method === 'POST') {
        if (!sameOrigin(request, url)) return err('forbidden', 403);
        return await handleSubmit(request, env);
      }
      if (p.startsWith('/api/photo/') && request.method === 'GET') return await handlePhoto(p, env);
      if (p.startsWith('/api/admin/')) return await handleAdmin(request, env, url);
      return err('not_found', 404);
    } catch (e) {
      return err('server_error', 500);
    }
  },
};

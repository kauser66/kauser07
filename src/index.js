/* স্বেচ্ছাসেবকের রেটিং API (Cloudflare Worker + D1)
   /api/ratings  (GET)  -> প্রতিজনের গড় রেটিং ও সংখ্যা
   /api/rate     (POST) -> { volunteer, stars, email } জমা দেওয়া
   ইমেইল সরাসরি জমা হয় না, শুধু হ্যাশ (SHA-256) জমা হয়।
   একই ইমেইল এক স্বেচ্ছাসেবককে একবারই রেটিং দিতে পারে; আবার দিলে আগেরটা বদলে যায়। */

const ENC = new TextEncoder();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', ENC.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function volunteerNames(request, env) {
  const res = await env.ASSETS.fetch(new Request(new URL('/data/volunteers.json', request.url)));
  if (!res.ok) return null;
  const j = await res.json();
  const list = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : [];
  return new Set(list.map((v) => v && v.name).filter(Boolean));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        if (url.pathname === '/api/ratings' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT volunteer, ROUND(AVG(stars), 1) AS avg, COUNT(*) AS count FROM ratings GROUP BY volunteer'
          ).all();
          const out = {};
          for (const r of results) out[r.volunteer] = { avg: r.avg, count: r.count };
          return json(out, 200, { 'Cache-Control': 'public, max-age=30' });
        }

        if (url.pathname === '/api/rate' && request.method === 'POST') {
          const origin = request.headers.get('Origin');
          if (origin && new URL(origin).host !== url.host) return json({ ok: false, error: 'forbidden' }, 403);

          let body;
          try {
            body = await request.json();
          } catch (e) {
            return json({ ok: false, error: 'bad_request' }, 400);
          }

          const volunteer = String(body.volunteer || '').trim();
          const stars = Number(body.stars);
          const email = String(body.email || '').trim().toLowerCase();

          if (!volunteer || volunteer.length > 120) return json({ ok: false, error: 'bad_request' }, 400);
          if (!Number.isInteger(stars) || stars < 1 || stars > 5) return json({ ok: false, error: 'bad_stars' }, 400);
          if (email.length > 100 || !EMAIL_RE.test(email)) return json({ ok: false, error: 'bad_email' }, 400);

          const names = await volunteerNames(request, env);
          if (!names || !names.has(volunteer)) return json({ ok: false, error: 'unknown_volunteer' }, 400);

          const hash = await sha256('shahbajpur-ratings-v1:' + email);
          await env.DB.prepare(
            "INSERT INTO ratings (volunteer, stars, email_hash) VALUES (?1, ?2, ?3) ON CONFLICT (volunteer, email_hash) DO UPDATE SET stars = excluded.stars, created_at = datetime('now')"
          )
            .bind(volunteer, stars, hash)
            .run();

          return json({ ok: true });
        }

        return json({ ok: false, error: 'not_found' }, 404);
      } catch (e) {
        return json({ ok: false, error: 'server_error' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

/**
 * Shahbazpur East Para — Cloudflare Worker API.
 * Admin routes must be protected by Cloudflare Access; set ADMIN_EMAIL.
 * Never expose GITHUB_TOKEN or ADMIN_EMAIL credentials in browser code.
 */
const cors = (env) => ({
  "access-control-allow-origin": env.SITE_ORIGIN,
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "vary": "Origin"
});
const reply = (data, status = 200, env) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(env ? cors(env) : {}) }
});
const clean = (v, n = 5000) => String(v ?? "").trim().slice(0, n);
const safe = (v, n) => clean(v, n).replace(/[<>]/g, "");
const validUrl = (s) => { try { return new URL(s).protocol === "https:"; } catch { return false; } };
const id = () => crypto.randomUUID();
function isAdmin(req, env) {
  const email = (req.headers.get("cf-access-authenticated-user-email") || "").toLowerCase();
  return !!env.ADMIN_EMAIL && email === env.ADMIN_EMAIL.toLowerCase();
}
async function githubJson(env, path) {
  const r = await fetch("https://api.github.com/repos/" + env.GITHUB_REPO + "/contents/" + path, {
    headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "shahbazpur-submissions" }
  });
  if (!r.ok) throw new Error("GitHub read failed: " + r.status);
  const x = await r.json();
  return { sha: x.sha, data: JSON.parse(atob(x.content.replace(/\n/g, ""))) };
}
async function githubPut(env, path, data, message, sha) {
  const body = { message, content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2) + "\n"))), branch: env.GITHUB_BRANCH || "main" };
  if (sha) body.sha = sha;
  const r = await fetch("https://api.github.com/repos/" + env.GITHUB_REPO + "/contents/" + path, {
    method: "PUT", headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "shahbazpur-submissions" }, body: JSON.stringify(body)
  });
  if (r.status === 409 || r.status === 422) throw new Error("JSON changed concurrently; refresh and retry");
  if (!r.ok) throw new Error("GitHub write failed: " + r.status);
}
async function readForm(req, env, sid) {
  const form = await req.formData();
  const kind = clean(form.get("kind"), 20), submitter = safe(form.get("submitter"), 100);
  if (!["news", "volunteer"].includes(kind) || !submitter) throw new Error("জমাদানকারীর নাম ও বিভাগ আবশ্যক");
  const file = form.get("photo");
  let photo = "";
  if (file && typeof file !== "string" && file.size) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("ছবি JPG, PNG বা WebP হতে হবে এবং ৫ MB-এর মধ্যে হতে হবে");
    if (!env.PHOTOS || !env.PHOTO_PUBLIC_BASE) throw new Error("ছবি আপলোড সেবা এখনো প্রস্তুত নয়");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = "submissions/" + sid + "." + ext;
    await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    photo = env.PHOTO_PUBLIC_BASE.replace(/\/$/, "") + "/" + key;
  }
  const item = { id: sid, kind, submitter, photo, status: "pending", createdAt: new Date().toISOString() };
  if (kind === "news") {
    item.title = safe(form.get("title"), 180); item.text = safe(form.get("text"), 12000);
    if (!item.title || !item.text) throw new Error("শিরোনাম ও বিস্তারিত লিখুন");
  } else {
    item.name = safe(form.get("name"), 120); item.house = safe(form.get("house"), 120);
    item.address = safe(form.get("address"), 300); item.about = safe(form.get("about"), 3000);
    item.phone = safe(form.get("phone"), 40); item.fb = clean(form.get("fb"), 500); item.map = clean(form.get("map"), 500);
    if (!item.name || !photo) throw new Error("স্বেচ্ছাসেবকের নাম ও ছবি আবশ্যক");
    if ((item.fb && !validUrl(item.fb)) || (item.map && !validUrl(item.map))) throw new Error("সঠিক HTTPS লিংক দিন");
  }
  return item;
}
async function archiveExpired(env) {
  const current = await githubJson(env, "data/news.json"), now = Date.now();
  const expired = (current.data.items || []).filter(x => x.expiresAt && Date.parse(x.expiresAt) <= now);
  if (!expired.length) return 0;
  const archive = await githubJson(env, "data/news-archive.json").catch(() => ({ sha: null, data: { items: [] } }));
  archive.data.items = (archive.data.items || []).concat(expired);
  // Write archive first. If active update then conflicts, a later cron safely deduplicates by title/date/photo.
  const seen = new Set(archive.data.items.map(x => x.expiresAt + "|" + x.title + "|" + x.photo));
  archive.data.items = Array.from(new Map(archive.data.items.map(x => [x.expiresAt + "|" + x.title + "|" + x.photo, x])).values());
  await githubPut(env, "data/news-archive.json", archive.data, "Archive expired news", archive.sha);
  const active = (current.data.items || []).filter(x => !x.expiresAt || Date.parse(x.expiresAt) > now);
  await githubPut(env, "data/news.json", { items: active }, "Remove expired news", current.sha);
  return expired.length;
}
async function handle(req, env, ctx) {
  const url = new URL(req.url);
  if (req.headers.get("origin") && req.headers.get("origin") !== env.SITE_ORIGIN) return reply({ error: "Origin not allowed" }, 403, env);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
  if (url.pathname === "/api/submit" && req.method === "POST") {
    try {
      if (!env.DB) return reply({ error: "সাবমিশন সেবা প্রস্তুত নয়" }, 503, env);
      const sid = id(), item = await readForm(req, env, sid);
      await env.DB.prepare("INSERT INTO submissions (id, kind, status, payload, created_at) VALUES (?, ?, 'pending', ?, ?)")
        .bind(sid, item.kind, JSON.stringify(item), item.createdAt).run();
      return reply({ ok: true, message: "আপনার পোস্টটি জমা হয়েছে! আপনার পোস্টটি বর্তমানে অনুমোদনের অপেক্ষায় রয়েছে।" }, 201, env);
    } catch (e) { return reply({ error: e.message }, 400, env); }
  }
  if (url.pathname.startsWith("/api/admin/")) {
    if (!isAdmin(req, env)) return reply({ error: "অনুমতি নেই" }, 401, env);
    if (url.pathname === "/api/admin/pending" && req.method === "GET") {
      const rows = await env.DB.prepare("SELECT id, kind, payload, created_at FROM submissions WHERE status='pending' ORDER BY created_at ASC").all();
      return reply({ items: rows.results.map(x => ({ ...JSON.parse(x.payload), createdAt: x.created_at })) }, 200, env);
    }
    const match = url.pathname.match(/^\/api\/admin\/(approve|decline)\/([a-f0-9-]+)$/);
    if (match && req.method === "POST") {
      const row = await env.DB.prepare("SELECT * FROM submissions WHERE id=? AND status='pending'").bind(match[2]).first();
      if (!row) return reply({ error: "জমাটি পাওয়া যায়নি" }, 404, env);
      const item = JSON.parse(row.payload), now = new Date().toISOString();
      if (match[1] === "decline") {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO decisions (id, kind, payload, decision, decided_at) VALUES (?, ?, ?, 'rejected', ?)").bind(row.id, row.kind, row.payload, now),
          env.DB.prepare("UPDATE submissions SET status='rejected' WHERE id=? AND status='pending'").bind(row.id)
        ]);
        return reply({ ok: true }, 200, env);
      }
      if (row.kind === "news") {
        const body = await req.json(), days = Math.min(365, Math.max(1, Number(body.days || 7)));
        const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
        const current = await githubJson(env, "data/news.json");
        current.data.items = Array.isArray(current.data.items) ? current.data.items : [];
        current.data.items.unshift({ title: item.title, date: new Date().toLocaleDateString("bn-BD"), cat: "স্থানীয়", photo: item.photo, text: item.text, expiresAt });
        await githubPut(env, "data/news.json", current.data, "Approve visitor news", current.sha);
        await env.DB.prepare("UPDATE submissions SET status='approved' WHERE id=? AND status='pending'").bind(row.id).run();
        return reply({ ok: true, expiresAt }, 200, env);
      }
      const current = await githubJson(env, "data/volunteers.json");
      current.data.items = Array.isArray(current.data.items) ? current.data.items : [];
      current.data.items.push({ name: item.name, photo: item.photo, house: item.house, address: item.address, about: item.about, phone: item.phone, fb: item.fb, map: item.map });
      await githubPut(env, "data/volunteers.json", current.data, "Approve visitor volunteer", current.sha);
      await env.DB.prepare("UPDATE submissions SET status='approved' WHERE id=? AND status='pending'").bind(row.id).run();
      return reply({ ok: true }, 200, env);
    }
  }
  return reply({ error: "Not found" }, 404, env);
}
export default {
  fetch(req, env, ctx) { return handle(req, env, ctx).catch(e => { console.error(e); return reply({ error: "সার্ভারে সমস্যা হয়েছে" }, 500, env); }); },
  async scheduled(controller, env, ctx) { ctx.waitUntil(archiveExpired(env)); }
};

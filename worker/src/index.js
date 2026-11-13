/**
 * Shahbazpur East Para — visitor submission API
 * Cloudflare Worker + D1 + R2. Keep all secrets in Worker bindings.
 */
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const clean = (v, n = 5000) => String(v ?? "").trim().slice(0, n);
const esc = (s) => clean(s).replace(/[<>]/g, "");
const validUrl = (s) => { try { const u = new URL(s); return u.protocol === "https:"; } catch { return false; } };
const id = () => crypto.randomUUID();
async function admin(req, env) {
  const token = req.headers.get("authorization") || "";
  const expected = "Bearer " + env.ADMIN_TOKEN;
  if (!env.ADMIN_TOKEN || token.length !== expected.length) return false;
  let diff = 0; for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
async function githubJson(env, path) {
  const r = await fetch("https://api.github.com/repos/" + env.GITHUB_REPO + "/contents/" + path, {
    headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "shahbazpur-submissions" }
  });
  if (!r.ok) throw new Error("GitHub read failed: " + r.status);
  const x = await r.json();
  return { sha: x.sha, data: JSON.parse(atob(x.content.replace(/\n/g, ""))) };
}
async function githubPut(env, path, data, message) {
  const current = await githubJson(env, path);
  const body = { message, content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2) + "\n"))), sha: current.sha, branch: env.GITHUB_BRANCH || "main" };
  const r = await fetch("https://api.github.com/repos/" + env.GITHUB_REPO + "/contents/" + path, {
    method: "PUT", headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "shahbazpur-submissions" }, body: JSON.stringify(body)
  });
  if (r.status === 409 || r.status === 422) throw new Error("JSON changed concurrently; retry after refreshing");
  if (!r.ok) throw new Error("GitHub write failed: " + r.status);
}
async function uploadPhoto(req, env, submissionId) {
  const form = await req.formData();
  const file = form.get("photo");
  if (!file || typeof file === "string" || !file.size) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("ছবি JPG, PNG বা WebP হতে হবে এবং ৫ MB-এর মধ্যে হতে হবে");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = "submissions/" + submissionId + "." + ext;
  await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return env.PHOTO_PUBLIC_BASE.replace(/\/$/, "") + "/" + key;
}
async function handle(req, env) {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": env.SITE_ORIGIN, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization" } });
  if (url.pathname === "/api/submit" && req.method === "POST") {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) return reply({ error: "Invalid form" }, 400);
    const form = await req.formData();
    const kind = clean(form.get("kind"), 20);
    const submitter = esc(form.get("submitter"), 100);
    if (!["news", "volunteer"].includes(kind) || !submitter) return reply({ error: "জমাদানকারীর নাম ও বিভাগ আবশ্যক" }, 400);
    const sid = id();
    let photo = "";
    try { photo = await uploadPhoto(req, env, sid); } catch (e) { return reply({ error: e.message }, 400); }
    const item = { id: sid, kind, submitter, photo, status: "pending", createdAt: new Date().toISOString() };
    if (kind === "news") {
      item.title = esc(form.get("title"), 180); item.text = esc(form.get("text"), 12000);
      if (!item.title || !item.text) return reply({ error: "শিরোনাম ও বিস্তারিত লিখুন" }, 400);
    } else {
      item.name = esc(form.get("name"), 120); item.house = esc(form.get("house"), 120);
      item.address = esc(form.get("address"), 300); item.about = esc(form.get("about"), 3000);
      item.phone = esc(form.get("phone"), 40); item.fb = clean(form.get("fb"), 500); item.map = clean(form.get("map"), 500);
      if (!item.name || !photo) return reply({ error: "স্বেচ্ছাসেবকের নাম ও ছবি আবশ্যক" }, 400);
      if (item.fb && !validUrl(item.fb)) return reply({ error: "সঠিক Facebook লিংক দিন" }, 400);
    }
    await env.DB.prepare("INSERT INTO submissions (id, kind, status, payload, created_at) VALUES (?, ?, 'pending', ?, ?)")
      .bind(sid, kind, JSON.stringify(item), item.createdAt).run();
    return reply({ ok: true, message: "আপনার পোস্টটি জমা হয়েছে! অনুমোদনের পর প্রকাশ করা হবে।" }, 201);
  }
  if (url.pathname.startsWith("/api/admin/")) {
    if (!(await admin(req, env))) return reply({ error: "অনুমতি নেই" }, 401);
    if (url.pathname === "/api/admin/pending" && req.method === "GET") {
      const rows = await env.DB.prepare("SELECT id, kind, payload, created_at FROM submissions WHERE status='pending' ORDER BY created_at ASC").all();
      return reply({ items: rows.results.map(x => ({ ...JSON.parse(x.payload), createdAt: x.created_at })) });
    }
    const match = url.pathname.match(/^\/api\/admin\/(approve|decline)\/([a-f0-9-]+)$/);
    if (match && req.method === "POST") {
      const row = await env.DB.prepare("SELECT * FROM submissions WHERE id=? AND status='pending'").bind(match[2]).first();
      if (!row) return reply({ error: "জমাটি পাওয়া যায়নি" }, 404);
      const item = JSON.parse(row.payload);
      if (match[1] === "decline") {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO decisions (id, kind, payload, decision, decided_at) VALUES (?, ?, ?, 'rejected', ?)").bind(row.id, row.kind, row.payload, new Date().toISOString()),
          env.DB.prepare("UPDATE submissions SET status='rejected' WHERE id=?").bind(row.id)
        ]);
        return reply({ ok: true });
      }
      if (row.kind === "news") {
        const body = await req.json();
        const days = Math.min(365, Math.max(1, Number(body.days || 7)));
        const end = new Date(Date.now() + days * 86400000).toISOString();
        const current = await githubJson(env, "data/news.json");
        current.data.items = Array.isArray(current.data.items) ? current.data.items : [];
        current.data.items.unshift({ title: item.title, date: new Date().toLocaleDateString("bn-BD"), cat: "স্থানীয়", photo: item.photo, text: item.text, expiresAt: end });
        await githubPut(env, "data/news.json", current.data, "Approve visitor news");
        await env.DB.prepare("UPDATE submissions SET status='approved' WHERE id=?").bind(row.id).run();
        return reply({ ok: true, expiresAt: end });
      }
      const current = await githubJson(env, "data/volunteers.json");
      current.data.items = Array.isArray(current.data.items) ? current.data.items : [];
      current.data.items.push({ name: item.name, photo: item.photo, house: item.house, address: item.address, about: item.about, phone: item.phone, fb: item.fb, map: item.map });
      await githubPut(env, "data/volunteers.json", current.data, "Approve visitor volunteer");
      await env.DB.prepare("UPDATE submissions SET status='approved' WHERE id=?").bind(row.id).run();
      return reply({ ok: true });
    }
  }
  return reply({ error: "Not found" }, 404);
}
export default {
  fetch(req, env) { return handle(req, env).catch(e => { console.error(e); return reply({ error: "সার্ভারে সমস্যা হয়েছে" }, 500); }); },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const current = await githubJson(env, "data/news.json");
      const now = Date.now();
      const items = Array.isArray(current.data.items) ? current.data.items : [];
      const expired = items.filter(x => x.expiresAt && Date.parse(x.expiresAt) <= now);
      if (!expired.length) return;
      const active = items.filter(x => !expired.includes(x));
      const archive = await githubJson(env, "data/news-archive.json").catch(() => ({ sha: null, data: { items: [] } }));
      archive.data.items = (archive.data.items || []).concat(expired);
      await githubPut(env, "data/news.json", { items: active }, "Archive expired news");
      if (archive.sha) await githubPut(env, "data/news-archive.json", archive.data, "Update news archive");
      else {
        const r = await fetch("https://api.github.com/repos/" + env.GITHUB_REPO + "/contents/data/news-archive.json", {
          method: "PUT", headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28", "user-agent": "shahbazpur-submissions" },
          body: JSON.stringify({ message: "Create news archive", content: btoa(unescape(encodeURIComponent(JSON.stringify(archive.data, null, 2) + "\n"))), branch: env.GITHUB_BRANCH || "main" })
        });
        if (!r.ok) throw new Error("Archive create failed");
      }
    })());
  }
};

/* live.js — CMS এ কিছু বদলালে সাইট/অ্যাপ খোলা থাকার অবস্থাতেই নিজে থেকে বদলে যায়।
   প্রতি ২৫ সেকেন্ডে ডাটা ফাইলগুলো দেখে; বদলে থাকলে পেজ স্ক্রল ঠিক রেখে নতুন তথ্য দেখায়।
   পপআপ খোলা থাকলে (যেমন ফর্ম ভরছেন) সেটা নষ্ট না করে পরে দেখায়। */
(function () {
  var FILES = ['village', 'member', 'dev', 'news', 'people', 'mosque', 'school', 'madrasa', 'graveyard', 'bazar', 'mor', 'volunteers', 'community'];
  var last = null, busy = false;

  function overlayOpen() {
    var ids = ['modal', 'vr-ov', 'vp-ov'];
    for (var i = 0; i < ids.length; i++) {
      var e = document.getElementById(ids[i]);
      if (e && e.classList.contains('on')) return true;
    }
    return !!document.getElementById('wl-ov');
  }

  function signature() {
    return Promise.all(FILES.map(function (k) {
      return fetchJ('data/' + k + '.json').then(function (j) { return j ? JSON.stringify(j) : ''; }).catch(function () { return ''; });
    })).then(function (a) { return a.join('|'); });
  }

  function check() {
    if (busy || document.hidden) return;
    if (typeof fetchJ !== 'function' || typeof load !== 'function' || typeof render !== 'function') return;
    busy = true;
    signature().then(function (s) {
      if (last === null) { last = s; return; }
      if (s === last || overlayOpen()) return;
      last = s;
      var y = window.scrollY;
      return load().then(function () {
        render();
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      });
    }).catch(function () {}).then(function () { busy = false; });
  }

  setTimeout(check, 8000);
  setInterval(check, 25000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
})();

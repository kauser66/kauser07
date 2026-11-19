/* live.js — (ক) CMS এ কিছু বদলালে সাইট/অ্যাপ খোলা থাকার অবস্থাতেই নিজে থেকে বদলে যায় (প্রতি ২৫ সেকেন্ড)
   (খ) Google অনুবাদ চালু থাকলেও পপআপের × বাটন যেন কাজ করে ও অনুবাদে নষ্ট না হয় */
(function () {
  /* ===== (খ) অনুবাদের সময় বাটন নষ্ট না হওয়ার ব্যবস্থা ===== */
  var KEEP = '.vr-x,.vp-x,.vp-no,.vp-go,#vp-fab,#vp-ib,#wl-ov,#vp-inst';
  function mark(root) {
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll(KEEP);
    for (var i = 0; i < list.length; i++) {
      if (list[i].getAttribute('translate') !== 'no') list[i].setAttribute('translate', 'no');
    }
    if (root.matches && root.matches(KEEP) && root.getAttribute('translate') !== 'no') root.setAttribute('translate', 'no');
  }
  mark(document);
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var a = muts[i].addedNodes;
        for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) mark(a[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* অনুবাদের <font> উপাদানে ক্লিক পড়লেও সেটা আসল বাটনে পাঠানো */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b = t.closest('.vr-x,.vp-x,.vp-no,.vp-go');
    if (b && b !== t) {
      e.stopPropagation();
      e.preventDefault();
      b.click();
    }
  }, true);

  /* ===== (ক) লাইভ আপডেট ===== */
  var FILES = ['village', 'member', 'dev', 'news', 'people', 'mosque', 'school', 'madrasa', 'graveyard', 'bazar', 'mor', 'volunteers', 'community', 'gallery', 'events', 'settings'];
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

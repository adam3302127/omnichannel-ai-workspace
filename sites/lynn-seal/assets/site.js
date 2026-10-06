/* Lynn Seal shared behavior: nav menu, scroll reveal, copy buttons, lead forms, video slot, lead dialogs. */
(function () {
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  var btn = document.getElementById('menuBtn'), menu = document.getElementById('menu');
  if (btn && menu) {
    btn.addEventListener('click', function () { var o = menu.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }

  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else { els.forEach(function (el) { el.classList.add('in'); }); }

  document.querySelectorAll('.copybtn').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy'), done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); };
      function fallback() { var el = b.previousElementSibling; if (el) { var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } done(); }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(done, fallback); } else { fallback(); }
    });
  });

  /* Lead forms: any <form data-lead>. Emails Lynn through FormSubmit (free), optionally logs to a
     Google Sheet through data-log, and falls back to the visitor's email app if neither reaches. */
  document.querySelectorAll('form[data-lead]').forEach(function (form) {
    var status = form.querySelector('.status'), submit = form.querySelector('button[type=submit]');
    var endpoint = form.getAttribute('data-endpoint'), log = form.getAttribute('data-log');
    function show(html) { status.innerHTML = html; status.hidden = false; status.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = Array.prototype.filter.call(form.querySelectorAll('[data-req]'), function (el) { return !el.value.trim() || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value)); });
      if (bad.length) { bad[0].focus(); show('<b>Please add your name, a valid email, and your question.</b>'); return; }
      if (form.querySelector('.honey') && form.querySelector('.honey').value) return;
      var data = new FormData(form), payload = {}; data.forEach(function (v, k) { if (k !== '_honey') payload[k] = v; });
      payload.name = (payload.first_name || '') + ' ' + (payload.last_name || ''); payload.page = location.href;
      var label = submit.textContent; submit.disabled = true; submit.textContent = 'Sending…';
      var controller = ('AbortController' in window) ? new AbortController() : null, timer = controller ? setTimeout(function () { controller.abort(); }, 9000) : null;
      if (log) { try { fetch(log, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) }); } catch (err) {} }
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: controller ? controller.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function () { if (timer) clearTimeout(timer); show('<b>Sent. Lynn has your message.</b><span> She replies personally, usually the same day. Urgent? Call or text (810) 691-6829.</span>'); form.reset(); submit.disabled = false; submit.textContent = label; })
        .catch(function () {
          if (timer) clearTimeout(timer);
          var body = encodeURIComponent(Object.keys(payload).filter(function (k) { return k[0] !== '_' && k !== 'page'; }).map(function (k) { return k.replace(/_/g, ' ') + ': ' + payload[k]; }).join('\n'));
          show('<b>The form could not reach the mail service from here.</b><span> Send the same note directly: <a href="mailto:lynnsealnaples@gmail.com?subject=' + encodeURIComponent(payload._subject || 'Inquiry') + '&body=' + body + '">open in your email app</a>, or copy <b>lynnsealnaples@gmail.com</b>. You can also call or text (810) 691-6829.</span>');
          submit.disabled = false; submit.textContent = label;
        });
    });
  });

  /* Lead shortcuts: any [data-open-lead] scrolls to the form and preselects the intent. */
  document.querySelectorAll('[data-open-lead]').forEach(function (a) {
    a.addEventListener('click', function () {
      var form = document.querySelector('form[data-lead]'); if (!form) return;
      var sel = form.querySelector('select[name=interest]'), want = a.getAttribute('data-open-lead');
      if (sel) { Array.prototype.forEach.call(sel.options, function (o) { if ((want === 'showing' && /showing/i.test(o.text)) || (want === 'question' && /question/i.test(o.text))) sel.value = o.text; }); }
      setTimeout(function () { var first = form.querySelector('input[name=first_name]'); if (first) first.focus({ preventScroll: true }); }, 500);
    });
  });

  /* Home-page video slot: self-hosted reel if present, else Facebook's player on the live site. */
  var reel = document.getElementById('reel'), vw = document.getElementById('video'), poster = document.getElementById('poster');
  if (reel && vw && poster) {
    function embed() {
      if (vw.querySelector('iframe')) return;
      var f = document.createElement('iframe'); f.title = 'Lynn Seal on Facebook'; f.allow = 'autoplay; encrypted-media; picture-in-picture; web-share'; f.allowFullscreen = true;
      f.src = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(poster.href) + '&show_text=false&autoplay=true&mute=true';
      vw.appendChild(f); vw.classList.add('playing');
      var open = document.createElement('a'); open.href = poster.href; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Open on Facebook'; open.className = 'video-open'; vw.appendChild(open);
    }
    var preview = location.protocol === 'file:' || /claude|localhost|127\.0\.0\.1/.test(location.hostname);
    var sound = document.getElementById('sound');
    function show() { reel.hidden = false; vw.classList.add('playing'); if (sound) sound.hidden = false; reel.play().catch(function () {}); }
    reel.addEventListener('loadeddata', show);
    if (reel.readyState >= 2) show(); /* already loaded before this script ran */
    if (sound) sound.addEventListener('click', function () {
      reel.muted = !reel.muted; var on = !reel.muted;
      sound.setAttribute('aria-pressed', on ? 'true' : 'false'); sound.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); sound.textContent = on ? 'Sound on' : 'Sound off';
      if (on) reel.play().catch(function () {});
    });
    function fail() { reel.remove(); if (sound) sound.remove(); if (!preview) embed(); }
    reel.addEventListener('error', function () { if (reel.error) fail(); });
    var srcs = reel.querySelectorAll('source'); if (srcs.length) srcs[srcs.length - 1].addEventListener('error', fail); /* last source failed: nothing playable */
    poster.addEventListener('click', function (e) { if (reel.parentNode && reel.readyState > 0) return; e.preventDefault(); embed(); });
  }
})();
/* Featured carousel arrows. */
(function () {
  var car = document.getElementById('featured'); if (!car) return;
  document.querySelectorAll('[data-car]').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = car.querySelector('.flyer'); var step = card ? card.getBoundingClientRect().width + 22 : car.clientWidth * .8;
      car.scrollBy({ left: b.getAttribute('data-car') === 'next' ? step : -step, behavior: 'smooth' });
    });
  });
})();

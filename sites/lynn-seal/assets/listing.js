/* Listing page behavior: hero gallery with slow pan and zoom, swipe, lightbox; room walkthrough fallback;
   compare slider; floor-plan hotspots; map with nearby places and drive times; sticky lead bar. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- gallery ---- */
  var gal = document.getElementById('gal');
  var slides = gal ? Array.prototype.slice.call(gal.querySelectorAll('.slide')) : [];
  var cur = 0, timer = null;
  function hydrate(k) {
    var s = slides[(k + slides.length) % slides.length]; if (!s) return;
    var src = s.querySelector('source[data-srcset]'), img = s.querySelector('img[data-src]');
    if (src) { src.srcset = src.getAttribute('data-srcset'); src.removeAttribute('data-srcset'); }
    if (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
  }
  function go(i, user) {
    if (!slides.length) return;
    cur = (i + slides.length) % slides.length;
    hydrate(cur); hydrate(cur + 1);
    slides.forEach(function (s, k) { s.classList.toggle('active', k === cur); });
    var dots = gal.querySelectorAll('.gal-dots button');
    dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === cur ? 'true' : 'false'); });
    if (user) restart();
  }
  function restart() { if (timer) clearInterval(timer); if (!reduce && slides.length > 1) timer = setInterval(function () { go(cur + 1); }, 7000); }
  if (gal && slides.length) {
    var dots = gal.querySelector('.gal-dots');
    slides.forEach(function (s, k) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Photo ' + (k + 1)); b.setAttribute('aria-selected', k === 0 ? 'true' : 'false'); b.addEventListener('click', function () { go(k, true); }); dots.appendChild(b); });
    gal.querySelector('.gal-btn.prev').addEventListener('click', function () { go(cur - 1, true); });
    gal.querySelector('.gal-btn.next').addEventListener('click', function () { go(cur + 1, true); });
    gal.addEventListener('mouseenter', function () { if (timer) clearInterval(timer); });
    gal.addEventListener('mouseleave', restart);
    gal.setAttribute('tabindex', '0');
    gal.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(cur - 1, true); if (e.key === 'ArrowRight') go(cur + 1, true); if (e.key === 'Enter') openBox(cur); });
    var x0 = null;
    gal.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    gal.addEventListener('pointerup', function (e) { if (x0 === null) return; var dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1), true); });
    slides.forEach(function (s, k) { s.addEventListener('click', function () { openBox(k); }); });
    gal.querySelector('.gal-open').addEventListener('click', function () { openBox(cur); });
    hydrate(1); restart();
  }

  /* ---- lightbox ---- */
  var box = document.getElementById('lightbox'), bi = 0;
  function showBox(i) {
    bi = (i + slides.length) % slides.length;
    var src = slides[bi].querySelector('img'); box.querySelector('img').src = src.currentSrc || src.src; box.querySelector('img').alt = src.alt;
    box.querySelector('figcaption').textContent = (bi + 1) + ' / ' + slides.length + ' · ' + slides[bi].querySelector('figcaption').textContent;
  }
  function openBox(i) { if (!box || !slides.length) return; slides.forEach(function (_, k) { hydrate(k); }); showBox(i); if (box.showModal) box.showModal(); else box.setAttribute('open', ''); if (timer) clearInterval(timer); }
  if (box) {
    box.querySelector('.lb-close').addEventListener('click', function () { box.close ? box.close() : box.removeAttribute('open'); });
    box.querySelector('.gal-btn.prev').addEventListener('click', function () { showBox(bi - 1); });
    box.querySelector('.gal-btn.next').addEventListener('click', function () { showBox(bi + 1); });
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') showBox(bi - 1); if (e.key === 'ArrowRight') showBox(bi + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    box.addEventListener('close', function () { go(bi); restart(); });
    var bx0 = null;
    box.addEventListener('pointerdown', function (e) { bx0 = e.clientX; });
    box.addEventListener('pointerup', function (e) { if (bx0 === null) return; var dx = e.clientX - bx0; bx0 = null; if (Math.abs(dx) > 40) showBox(bi + (dx < 0 ? 1 : -1)); });
  }

  /* ---- walkthrough fallback for browsers without scroll-driven animations ---- */
  if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()')) && 'IntersectionObserver' in window) {
    var wo = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('in'); }); }, { threshold: 0.35 });
    document.querySelectorAll('.room').forEach(function (r) { wo.observe(r); });
  }

  /* ---- compare slider ---- */
  var cmp = document.getElementById('compare');
  if (cmp) { var r = cmp.querySelector('input'); var set = function () { cmp.style.setProperty('--pos', r.value + '%'); }; r.addEventListener('input', set); set(); }

  /* ---- floor plan hotspots ---- */
  document.querySelectorAll('.plan .hot').forEach(function (h) {
    h.addEventListener('click', function () {
      var want = (h.getAttribute('data-room') || '').toLowerCase();
      var rooms = document.querySelectorAll('.room');
      for (var i = 0; i < rooms.length; i++) { if (rooms[i].querySelector('h3').textContent.toLowerCase().indexOf(want) > -1) { rooms[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); return; } }
    });
  });

  /* ---- map, nearby, drive times (OpenStreetMap tiles, Overpass, OSRM: all free, no keys) ---- */
  var main = document.querySelector('main.listing'), mapEl = document.getElementById('map');
  var lat = main && parseFloat(main.getAttribute('data-lat')), lng = main && parseFloat(main.getAttribute('data-lng'));
  function km(a, b, c, d) { var R = 6371, dLat = (c - a) * Math.PI / 180, dLng = (d - b) * Math.PI / 180, x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
  function miles(k) { return (k * 0.621371).toFixed(1) + ' mi'; }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  function loadLeaflet(cb) {
    if (window.L) return cb();
    var base = mapEl.getAttribute('data-leaflet') || '';
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'leaflet.css'; document.head.appendChild(css);
    var s = document.createElement('script'); s.src = base + 'leaflet.js'; s.onload = cb; document.head.appendChild(s);
  }
  function initMap() {
    if (!(mapEl && window.L && isFinite(lat) && isFinite(lng))) return;
    try {
      var map = L.map(mapEl, { scrollWheelZoom: false }).setView([lat, lng], 14);
      var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
      tiles.on('load', function () { mapEl.classList.add('ready'); });
      tiles.addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup(main.getAttribute('data-address')).openPopup();
      var list = document.getElementById('nearby-list');
      var q = '[out:json][timeout:12];(nwr["amenity"="school"](around:4500,' + lat + ',' + lng + ');nwr["shop"="supermarket"](around:4500,' + lat + ',' + lng + ');nwr["amenity"="hospital"](around:8000,' + lat + ',' + lng + '););out center 30;';
      withTimeout(fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) }).then(function (r) { return r.json(); }), 12000)
        .then(function (d) {
          var items = (d.elements || []).map(function (e) { var la = e.lat || (e.center && e.center.lat), lo = e.lon || (e.center && e.center.lon); return { name: e.tags && e.tags.name, kind: e.tags.amenity === 'school' ? 'School' : e.tags.shop === 'supermarket' ? 'Grocery' : 'Hospital', la: la, lo: lo, d: km(lat, lng, la, lo) }; })
            .filter(function (i) { return i.name && isFinite(i.d); }).sort(function (a, b) { return a.d - b.d; });
          var seen = {}, out = [];
          items.forEach(function (i) { var key = i.kind + i.name; if (seen[key]) return; seen[key] = 1; if (out.filter(function (o) { return o.kind === i.kind; }).length < 3) out.push(i); });
          if (!out.length) return;
          list.innerHTML = '';
          out.forEach(function (i) { var li = document.createElement('li'); li.innerHTML = '<b></b><span></span>'; li.querySelector('b').textContent = i.name; li.querySelector('span').textContent = i.kind + ' · ' + miles(i.d); list.appendChild(li); L.circleMarker([i.la, i.lo], { radius: 5, color: '#B08D57', fillColor: '#B08D57', fillOpacity: .9 }).addTo(map).bindPopup(i.name); });
        }).catch(function () {});
      var cl = document.getElementById('commute-list'), targets = [];
      try { targets = JSON.parse(cl.getAttribute('data-targets') || '[]'); } catch (e) {}
      Promise.all(targets.map(function (t) {
        return withTimeout(fetch('https://router.project-osrm.org/route/v1/driving/' + lng + ',' + lat + ';' + t.lng + ',' + t.lat + '?overview=false').then(function (r) { return r.json(); }), 10000)
          .then(function (d) { var r = d.routes && d.routes[0]; return r ? { name: t.name, min: Math.round(r.duration / 60), mi: miles(r.distance / 1000) } : null; }).catch(function () { return null; });
      })).then(function (rows) {
        rows = rows.filter(Boolean); if (!rows.length) { cl.innerHTML = '<li><span>Drive times unavailable right now.</span></li>'; return; }
        cl.innerHTML = ''; rows.forEach(function (r) { var li = document.createElement('li'); li.innerHTML = '<b></b><span></span>'; li.querySelector('b').textContent = r.name; li.querySelector('span').textContent = r.min + ' min · ' + r.mi; cl.appendChild(li); });
      });
    } catch (e) {}
  }
  if (mapEl && isFinite(lat) && isFinite(lng)) {
    var startMap = function () { loadLeaflet(initMap); };
    if ('IntersectionObserver' in window) { var mo = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { mo.disconnect(); startMap(); } }, { rootMargin: '400px 0px' }); mo.observe(mapEl); } else { startMap(); }
  }

  /* ---- sticky lead bar appears once the gallery scrolls away ---- */
  var bar = document.getElementById('leadBar'), hero = document.querySelector('.gal-wrap'), ask = document.getElementById('ask');
  if (bar && hero && 'IntersectionObserver' in window) {
    var past = false, atForm = false, upd = function () { bar.classList.toggle('show', past && !atForm); };
    new IntersectionObserver(function (en) { past = !en[0].isIntersecting && en[0].boundingClientRect.top < 0; upd(); }, { threshold: 0 }).observe(hero);
    if (ask) new IntersectionObserver(function (en) { atForm = en[0].isIntersecting; upd(); }, { threshold: 0.2 }).observe(ask);
  }
})();

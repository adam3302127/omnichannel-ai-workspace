#!/usr/bin/env node
/* Lynn Seal site builder. No dependencies. Run: node build.js
   Reads data/*.json and templates/, writes listings/<slug>/index.html, neighborhoods/<slug>/index.html,
   refreshes the generated blocks in index.html, and writes sitemap.xml.
   node build.js --inline out/   writes a copy of every page with CSS and JS inlined (used for previews). */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = p => JSON.parse(read(p));
const site = json('data/site.json'), listings = json('data/listings.json'), hoods = json('data/neighborhoods.json');
const esc = s => String(s ?? '').replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const partials = {};
for (const f of fs.readdirSync(path.join(ROOT, 'templates/partials'))) partials[f.replace('.html', '')] = read('templates/partials/' + f);

function get(ctx, key) {
  if (key === 'this') return ctx.this !== undefined ? ctx.this : ctx;
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}
function render(tpl, ctx) {
  tpl = tpl.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, n) => render(partials[n] || '', ctx));
  tpl = tpl.replace(/\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
    const arr = get(ctx, key) || [];
    return arr.map((item, i) => {
      const sub = (item !== null && typeof item === 'object') ? { ...ctx, ...item, this: item } : { ...ctx, this: item };
      sub.i = i; sub.n = i + 1; sub.first = i === 0; sub.last = i === arr.length - 1;
      return render(body, sub);
    }).join('');
  });
  tpl = tpl.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_, key, a, b) => {
    const v = get(ctx, key); const truthy = Array.isArray(v) ? v.length > 0 : !!v;
    return render(truthy ? a : (b || ''), ctx);
  });
  tpl = tpl.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => String(get(ctx, key) ?? ''));
  tpl = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => esc(get(ctx, key)));
  return tpl;
}
function imgSize(p) { // minimal JPEG/PNG/WebP dimension reader
  try {
    const b = fs.readFileSync(path.join(ROOT, p));
    if (b[0] === 0xFF && b[1] === 0xD8) { let i = 2; while (i < b.length) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + b.readUInt16BE(i + 2); } }
    if (b.toString('ascii', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch (e) {}
  return { w: 1200, h: 800 };
}
const flyerFoot = `<div class="foot"><img src="{{root}}assets/lynn-seal-thumb.jpg" alt="" width="38" height="38" loading="lazy"><div><b>Lynn Seal, PA</b><span>Downing-Frye Realty · (810) 691-6829</span></div></div>`;
function flyerHtml(l, root) {
  const photo = l.page ? `assets/listings/${l.slug}/${l.photos[0].file}` : l.photo;
  const webp = photo.replace(/\.jpe?g$/, '.webp'), webp480 = photo.replace(/\.jpe?g$/, '-480.webp');
  const { w, h } = imgSize(photo);
  const status = l.status === 'sold' ? l.soldDate : l.statusLabel;
  const meta = l.page ? `${l.beds} bed · ${l.baths} bath · ${l.sqft} sq ft${l.garage ? ' · ' + l.garage + ' garage' : ''}` : l.meta;
  const pts = l.page ? (l.highlights || []).slice(0, 2).join(' · ') : l.pts;
  const price = l.priceLabel + (l.priceSuffix ? ` <span style="font-family:var(--body);font-size:.85rem;color:var(--muted)">${l.priceSuffix}</span>` : '');
  const open = l.page ? `<a class="flyer-link" href="${root}listings/${l.slug}/" aria-label="View ${esc(l.address)}"></a>` : '';
  const alt = l.page ? `${l.photos[0].room}, ${l.address}` : l.address;
  return `      <article class="flyer${l.status === 'sold' ? ' sold' : ''} reveal">${open}
        <div class="ribbon"><div class="script"><em>${esc(l.ribbon.small)}</em>${esc(l.ribbon.script)}</div><div class="in">${l.in}</div></div>
        <div class="photo"><picture><source type="image/webp" srcset="${root}${webp480} 480w, ${root}${webp} 960w" sizes="(max-width:620px) 100vw, (max-width:1000px) 50vw, 33vw"><img src="${root}${photo}" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy"></picture><span class="status">${esc(status)}</span></div>
        <div class="body"><div class="price num">${price}</div><div class="addr">${esc(l.address)}</div><div class="meta">${esc(meta)}</div><div class="pts">${esc(pts)}</div></div>
        ${flyerFoot.replace('{{root}}', root)}
      </article>`;
}
function leadForm(opts) {
  return render(partials.leadform, { ...opts, site: site.site, agent: site.agent });
}
const askFields = `<div class="f2">
    <label>I would like to
      <select name="interest"><option>Book a showing</option><option>Ask a question</option><option>Get the fee and membership details</option><option>Talk about selling a similar home</option></select>
    </label>
    <label>Preferred day
      <input name="timeframe" placeholder="Any day this week">
    </label>
  </div>`;
const baseUrl = site.site.baseUrl.replace(/\/$/, '');
const written = [];
function write(rel, html) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); written.push(rel); }

// listing pages
for (const l of listings.filter(x => x.page)) {
  const root = '../../';
  const photos = l.photos.map(p => { const { w, h } = imgSize(`assets/listings/${l.slug}/${p.file}`); return { ...p, slug: l.slug, w, h, webp: p.file.replace(/\.jpe?g$/, '.webp'), webp480: p.file.replace(/\.jpe?g$/, '-480.webp') }; });
  const compare = l.compare ? { ...l.compare, ratio: (() => { const s = imgSize(`assets/listings/${l.slug}/${l.compare.before}`); return `${s.w}/${s.h}`; })() } : null;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'RealEstateListing', name: l.address, url: `${baseUrl}/listings/${l.slug}/`,
    description: l.summary, image: photos.map(p => `${baseUrl}/assets/listings/${l.slug}/${p.file}`),
    offers: { '@type': 'Offer', price: l.price, priceCurrency: 'USD', availability: l.status === 'active' || l.status === 'rental' ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability' },
    about: { '@type': 'Residence', name: l.address, address: { '@type': 'PostalAddress', streetAddress: l.address, addressLocality: l.city, addressRegion: l.state, postalCode: l.zip, addressCountry: 'US' }, geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng }, numberOfRooms: l.beds, floorSize: { '@type': 'QuantitativeValue', value: l.sqft.replace(/,/g, ''), unitCode: 'FTK' } },
    provider: { '@type': 'RealEstateAgent', name: 'Lynn Seal, PA', telephone: site.agent.phoneRaw, email: site.agent.email, url: baseUrl, worksFor: { '@type': 'Organization', name: site.agent.brokerage } }
  });
  const ctx = {
    ...l, root, site: site.site, agent: site.agent, photos, photoCount: photos.length, compare,
    metaDescription: l.summary, canonical: `${baseUrl}/listings/${l.slug}/`, ogType: 'place', ogImage: `${baseUrl}/assets/listings/${l.slug}/${photos[0].file}`,
    jsonld, nearbyJson: JSON.stringify(l.nearbyFallback || []), commuteJson: JSON.stringify(site.commuteTargets),
    leadForm: leadForm({ formId: 'askForm', subject: `Inquiry: ${l.address}`, source: 'listing page', listingRef: `${l.address} (MLS ${l.mls})`, extraFields: askFields, placeholder: 'Anything you want to know about this home.', buttonLabel: 'Send to Lynn' })
  };
  write(`listings/${l.slug}/index.html`, render(read('templates/listing.html'), ctx));
}

// neighborhood pages
for (const n of hoods.filter(x => x.page)) {
  const root = '../../';
  const here = listings.filter(l => l.community === n.name);
  const jsonld = JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Place', name: n.name, description: n.tagline, geo: { '@type': 'GeoCoordinates', latitude: n.lat, longitude: n.lng }, address: { '@type': 'PostalAddress', addressLocality: 'Naples', addressRegion: 'FL', postalCode: '34113', addressCountry: 'US' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: n.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'RealEstateAgent', name: 'Lynn Seal, PA', telephone: site.agent.phoneRaw, email: site.agent.email, url: baseUrl, areaServed: n.name, worksFor: { '@type': 'Organization', name: site.agent.brokerage } }
  ]);
  const ctx = { ...n, root, site: site.site, agent: site.agent, canonical: `${baseUrl}/neighborhoods/${n.slug}/`, ogType: 'website', ogImage: `${baseUrl}/assets/listings/${here.find(l => l.page)?.slug || ''}/01.jpg`, jsonld,
    flyers: here.map(l => flyerHtml(l, root)).join('\n'),
    leadForm: leadForm({ formId: 'hoodForm', subject: `Inquiry: ${n.name}`, source: 'neighborhood guide', listingRef: n.name, extraFields: `<div class="f2"><label>I am interested in<select name="interest"><option>Buying in ${n.name}</option><option>Selling in ${n.name}</option><option>Membership and fee details</option><option>Seasonal rental</option></select></label><label>Timeframe<select name="timeframe"><option>Within 3 months</option><option>3 to 6 months</option><option>6 to 12 months</option><option>Just exploring</option></select></label></div>`, placeholder: 'What you are looking for, or the address you own.', buttonLabel: 'Send to Lynn' }) };
  write(`neighborhoods/${n.slug}/index.html`, render(read('templates/neighborhood.html'), ctx));
}

// home page generated blocks
let home = read('index.html');
function inject(name, html) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  if (!re.test(home)) throw new Error('marker missing: ' + name);
  home = home.replace(re, function (_, a, z) { return a + '\n' + html + '\n' + z; });
}
inject('listings', listings.filter(l => l.page && l.featured).map(l => flyerHtml(l, '')).join('\n'));
inject('sold', listings.filter(l => l.status === 'sold').map(l => flyerHtml(l, '')).join('\n'));
inject('communities', hoods.map(n => n.page
  ? `      <a class="comm reveal" href="neighborhoods/${n.slug}/"><span class="where">${n.where}</span><h3>${n.name} <span class="arrow">→</span></h3><p>${n.tagline} Read the guide.</p></a>`
  : `      <article class="comm reveal"><span class="where">${n.where}</span><h3>${n.name}</h3><p>${n.d}</p></article>`).join('\n'));
write('index.html', home);

// sitemap and robots
const pages = ['', ...listings.filter(l => l.page).map(l => `listings/${l.slug}/`), ...hoods.filter(n => n.page).map(n => `neighborhoods/${n.slug}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${baseUrl}/${p}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);

// optional inlined copies for previews
const inlineIdx = process.argv.indexOf('--inline');
if (inlineIdx > -1) {
  const out = process.argv[inlineIdx + 1] || 'dist-preview';
  const cssCache = {};
  const css = p => cssCache[p] ??= read(p);
  for (const rel of written.filter(w => w.endsWith('.html'))) {
    let html = read(rel);
    const root = rel === 'index.html' ? '' : '../../';
    html = html.replace(/<link rel="stylesheet" href="(?:\.\.\/\.\.\/)?(assets\/[^"]+\.css)">/g, (_, p) => `<style>${css(p).replace(/url\("\.\//g, `url("${root}assets/`).replace(/url\(images\//g, `url(${root}assets/vendor/leaflet/images/`)}</style>`);
    html = html.replace(/<script src="(?:\.\.\/\.\.\/)?(assets\/[^"]+\.js)" defer><\/script>/g, (_, p) => `<script>${read(p)}</script>`);
    if (rel === 'index.html') { html = html.replace(/^<!doctype html>\s*<html lang="en">\s*<head>/i, '').replace(/<\/head>\s*<body>/i, '').replace(/<\/body>\s*<\/html>\s*$/i, ''); html = html.replace(/<meta charset="utf-8">\n|<meta name="viewport"[^>]*>\n|<link rel="canonical"[^>]*>\n|<meta property="og:[^>]*>\n|<link rel="preconnect"[^>]*>\n/g, ''); }
    const dest = path.join(ROOT, out, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, html);
  }
  console.log('inlined preview copies in', out);
}
console.log('built:', written.join(', '));

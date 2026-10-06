# Change log · Lynn Seal site

## 5 Oct 2026 · Interactive, visual, conversion-focused build

**Design system.** `assets/tokens.css` holds every color, type and spacing token with light and dark values. `assets/site.css` and `assets/site.js` are shared by every page. The home page look did not change except for two contrast fixes (brass eyebrow text darkened to 4.5:1; status badges darkened).

**Data-driven pages.** `data/listings.json` and `data/neighborhoods.json` are the single source of truth. `node build.js` renders `listings/<slug>/index.html` and `neighborhoods/<slug>/index.html` from `templates/`, regenerates the home page's listing carousel, sold strip and community cards between build markers, and writes `sitemap.xml` and `robots.txt`. No dependencies.

**Listing page template** (`templates/listing.html`, `assets/listing.css`, `assets/listing.js`), all free and open source:
- Hero gallery with a slow pan-and-zoom on the active photo (CSS keyframes), arrows, dots, keyboard arrows, swipe on touch, click-to-open lightbox with swipe and Esc. Photos after the first load only when they are about to show.
- Room-by-room walkthrough in walk order. Each room pins while its name, square footage field and one line of copy settle in, using native scroll-driven animations with an IntersectionObserver fallback. A clearly marked video slot sits at the end of the walk; paste a video URL into the listing record and it renders.
- Day/twilight compare slider (CSS clip-path plus a range input, so it is keyboard-accessible). Shown only when a listing has two photos to compare; 9546 Firenze has one.
- Floor plan with clickable hotspots that jump to the matching room section. Shown only when a listing record has a floor plan; none do yet.
- Location map: Leaflet 1.9.4 (vendored, BSD) with OpenStreetMap tiles, loaded only when the map scrolls near. Nearby schools, grocery and hospitals from Overpass with straight-line distance; drive times to Naples Pier, Fifth Avenue South and RSW from the public OSRM router. Each listing carries a hand-written fallback list for when those free services are slow or offline.
- Sticky "Book a showing / Ask a question" bar that appears once the gallery scrolls away and hides at the form. Lead form captures name, phone, email, intent, preferred day and the listing, emails Lynn through FormSubmit, optionally logs to a Google Sheet (see `tools/lead-logger.gs`), and falls back to the visitor's email app.
- Schema: RealEstateListing with Residence, Offer, GeoCoordinates and RealEstateAgent.

**Four listing pages built from real listings:** 9529 Avellino Way #2815, 9546 Firenze Cir, 9502 Napoli Ln #26201, 195 Peppermint Ln W #881. Photos are the actual MLS photos at web resolution; replace with originals.

**Neighborhood guide template** (`templates/neighborhood.html`) and the first guide, Treviso Bay: stats, intro, sub-neighborhood grid, fee and amenity sheet, Lynn's listings and sales inside the community, FAQ with Place, FAQPage and RealEstateAgent schema, lead form.

**Home page.** Featured listings carousel with arrows and scroll-snap; sold proof strip; one seller CTA (free valuation form with address, timeframe and membership fields) and one buyer CTA (listings and contact); bio, reviews and the Treviso Bay guide link. Antilles card removed: the unit shows off-market and no property photo exists. "Relocating families" became "relocating buyers" (Fair Housing). Treviso Bay card and nav item link to the guide.

**Performance and access.** WebP variants with 480px sizes for every image via `tools/images.py`; `<picture>` with srcset; width and height on every image; lazy loading below the fold; reduced-motion disables the pan-zoom, walkthrough motion and reveals; every control keyboard-reachable; alt text on every photo; gallery dots enlarged to 28px targets; links in text underlined.

**Lighthouse, mobile, simulated throttling (Google Fonts blocked in the test sandbox):**

| Page | Before | After |
| --- | --- | --- |
| Home | 96 / 96 / 96 / 100 | 96 / 100 / 96 / 100 |
| Listing (9546 Firenze) | did not exist | 98 / 97 / 96 / 100 |
| Treviso Bay guide | did not exist | 97 / 100 / 96 / 100 |

Order: performance / accessibility / best practices / SEO. Remaining performance notes are hosting-level: text compression and long cache headers come from the host, not the files.

**Not done, on purpose.**
- No live MLS feed. See the IDX note in `LAUNCH-GUIDE.md`.
- No new hosting, domain or DNS changes.
- No AI-enhanced or virtually staged images. None were used, so no labels were needed; the template carries a `label` field on photos for when one is.
- The Facebook reel still plays through Facebook's player until `assets/lynn-reel.mp4` is dropped in.

## 2026-10-06 — v9
- Fixed the home page cards: an earlier build had written broken duplicate card fragments after each generated block, leaving unstyled text under the listings, sold and communities grids. Cleaned the source and changed the build script to splice between the first opening and last closing marker so it cannot happen again.
- Fresh home-page screenshots (phone and desktop), plus close-ups of the listings and sold sections.

## 2026-10-06 — v10
- Lynn's Facebook reel is now self-hosted (`assets/lynn-reel.mp4`, 720x1280 H.264, 2.3 MB) so it plays in the preview and on any host without Facebook's player. Autoplays muted and loops, with a Sound on/off button and the reel's first frame as the poster. Facebook embed remains the fallback.
- Found and fixed: the home page was still running an old inline copy of the page script instead of the shared `assets/site.js`, so the carousel arrows and the valuation form were not wired up. The home page now loads the shared script like every other page. Verified menu, carousel, both forms and the reel in a headless phone browser.

## 2026-10-06 — v11
- Every listing photo replaced with the full-size MLS image (1024 px wide, up from 253 to 516 px). The three active Treviso Bay listings now carry 11 photos each in walk order with fresh captions; the Glades rental has 7. Sold flyers use the full-size exterior. 9446 Piacere Way had been showing the community entrance instead of the house; it now shows the house.
- Naples pier and beach photos replaced with 1600 px originals from Wikimedia Commons; footer credits updated to match the files in use.
- Video slot removed from the listing-page walkthrough; the photo slideshow stands on its own.
- "Back to all listings" bar under the nav on every listing page, and "Back to home" on the neighborhood guide.
- Removed stale low-resolution duplicates from assets/listings.
- Contact-section beach photo restored to the original view (Marc Ryckaert, Naples Beach3), now at 1600 px.
- "Your Home?" card pier photo restored to the original view (800 px, the prior file); Commons credits restored to the original three photographers.
- Contact-section photo is now downtown Naples at dusk from Naples Bay (Charles Patrick Ewing, CC BY 2.0, Wikimedia Commons), 1600 px, replacing the beach photo at Adam's request.

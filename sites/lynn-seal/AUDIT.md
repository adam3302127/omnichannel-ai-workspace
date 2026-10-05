# Lynn Seal site · Audit before the interactive build (5 Oct 2026)

## What was here

| Item | Finding |
| --- | --- |
| Framework | None. One static `index.html` with all CSS and JS inline. No build step, no dependencies. |
| Hosting target | Not chosen. The file runs on any static host. Domain `lynnsealnaples.com` not yet purchased. |
| Pages | One: the home page. |
| Listings storage | Hardcoded HTML flyer cards (17 of them). No JSON, no CMS, no MLS or IDX feed. |
| Lead capture | One contact form posting to FormSubmit (free), email to Lynn only, no log. Not yet activated (first live submission triggers the activation email). |
| Mobile Lighthouse, baseline | Performance 96 · Accessibility 96 · Best practices 96 · SEO 100. LCP 2.3 s, TBT 0 ms, CLS 0. |
| Broken or weak | Brass eyebrow text failed 4.5:1 contrast. Images shipped as JPEG only with no responsive sizes. Antilles listing card used a Naples beach photo, not the property. Video block depended on Facebook's player. "Relocating families" in the communities copy touched familial status. |

## Skills inventory for this task

| Requested | Status here |
| --- | --- |
| apple-design-review | Installed. Run on the home page and the Firenze listing page; findings applied as visual-only changes. |
| cro | Installed. |
| copywriting | Installed. |
| seo-audit | Installed. |
| design-critique | Absent. |
| accessibility-review | Absent. Used Lighthouse accessibility audits and manual keyboard checks instead. |
| design-system | Absent. Tokens were written by hand into `assets/tokens.css`. |
| ux-copy | Absent. |
| on-page-seo | Absent. |
| schema-markup | Absent. Schema written by hand: RealEstateListing + Residence + Offer on listing pages, Place + FAQPage + RealEstateAgent on the guide, RealEstateAgent on the home page. |

## The site on a phone, as a buyer

**Converts:** the card header with Lynn's number one tap away, the "Just Listed" flyers with real photos, the Treviso Bay band with hard numbers, the sticky Call and Message bar.

**Leaks:** no listing had its own page, so a buyer who liked a flyer had nowhere to go except the contact form. No map, no photos beyond one per listing, no way to book a showing from the listing itself. The Antilles card showed a beach, which reads as a stock image. Reviews were three cards but no star rating signal.

**Slow:** nothing material. Baseline LCP 2.3 s on simulated mobile. Google Fonts is the only third-party request.

## The site on a phone, as a seller

**Converts:** "Just Sold" flyers with prices, days on market and sale sides; the brokerage credentials; Lynn's Treviso Bay volume.

**Leaks:** no seller-specific call to action. The "Your Home?" card pointed at the general contact form, which opened with "Buying" selected. No place to enter an address. Nothing explained what a valuation meeting involves.

## What this build changed

See `CHANGELOG.md`. Short version: a design-system file every page shares, a data file that drives listing pages and the home page, four interactive listing pages, a Treviso Bay guide with schema, a seller valuation form, WebP images with responsive sizes, contrast and tap-target fixes, and a carousel. Lighthouse after: home 96 / 100 / 96 / 100, listing page 97 / 97 / 96 / 100 (mobile, simulated throttling, fonts blocked in the test sandbox).

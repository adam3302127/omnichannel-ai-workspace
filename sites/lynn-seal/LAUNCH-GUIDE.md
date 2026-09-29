# Lynn Seal site · Launch guide and recommendations

## What is in this folder

| File | Purpose |
| --- | --- |
| `index.html` | The complete site. One file, no build step, no framework. Inline CSS and JS, Google Fonts only. |
| `assets/` | Drop photos here. See `assets/README.md` for exact filenames and sizes. |
| `RESEARCH.md` | Every fact on the site with its source, plus the items to verify with Lynn. |
| `LAUNCH-GUIDE.md` | This file. |

## Go-live in one afternoon

1. **Domain.** Register `lynnsealnaples.com` (matches her email handle and every listing post she already publishes). Also grab `lynnsealnaples.realtor` if you want the REALTOR® TLD. Check availability at any registrar.
2. **Hosting.** This is a static site. Cloudflare Pages, Netlify, Vercel, or GitHub Pages will host it free. Point the domain, upload the `lynn-seal` folder, done. If you would rather keep it on WordPress.com or SiteGround alongside your other properties, upload `index.html` as a static page.
3. **Contact form activation.** The form posts to FormSubmit (formsubmit.co) addressed to `lynnsealnaples@gmail.com`. The first submission from the live domain triggers a one-time activation email to Lynn's Gmail. She clicks "Activate", and every later submission lands in her inbox as a clean table. Nothing to configure, no account needed. If the mail service is ever unreachable, the page falls back to opening the visitor's email app pre-filled, and shows her email and phone as text.
   - Optional upgrade: replace FormSubmit with a GoHighLevel or Close webhook so every inquiry becomes a CRM lead with an automatic text-back. I can wire that in about ten lines.
4. **Photos.** Add her headshot and five listing photos per `assets/README.md`. The page is complete without them (every image slot has a designed fallback), but her portrait is the single highest-impact addition.
5. **Update the canonical URL.** If the domain is not `lynnsealnaples.com`, search-and-replace that string in `index.html` (canonical link, Open Graph tags, JSON-LD, and the form's `_next` redirect).

## Verify with Lynn before publishing

- Which phone number to publish. Downing-Frye and her own posts use (810) 691-6829; Homes.com shows (810) 777-7386.
- Her Florida DBPR license number (format SL#######) for the footer disclosure. The 249524674 shown on portals is her MLS agent ID.
- Whether she wants Cheryl Rauch named as a partner throughout, or only on co-listed properties. The site currently names Cheryl where she co-listed.
- Any awards, designations, or Downing-Frye production recognition not found online. There is a slot for them in the About facts panel.
- Confirmation that "Lynn Seal, PA" is her preferred legal marketing name (it appears on her own Facebook listing posts).
- The full text and client name from the Downing-Frye "difficult transition" success story, if the client consented to be quoted.

## Recommendations, ranked by payoff

### 1. Fix the review gap first. It is the whole game for a solo agent.
Lynn has 60+ closings and exactly one written testimonial online. Zillow shows zero reviews. A buyer comparing her to another Treviso Bay agent with 40 five-star reviews will pick the other agent regardless of production.
- Send a review request to her last 25 closed clients this week. Ask for Google first (once the Business Profile below exists), Zillow second.
- Script: "You were a pleasure to work with. Would you take two minutes to leave a review? It is how most of my new clients find me." Include the direct link.
- Target: 15 Google reviews and 10 Zillow reviews within 60 days. Then embed a live Google review widget on this site.

### 2. Create a Google Business Profile.
"Lynn Seal, REALTOR® · Downing-Frye Realty" as a service-area business covering Naples, Bonita Springs, Estero, Marco Island. Category: Real Estate Agent. Link it to this site and her phone. This is the only thing that gets her into the Google Maps pack for "Treviso Bay realtor," and it is free.

### 3. Own the Treviso Bay search.
She has 40 transactions in one community. Nobody else can say that. Build on it:
- Add a page or section per neighborhood (Firenze, Piacere, Napoli, Giaveno, Avellino, Venezia, Acqua, Trevi, Veneto, Corso Bello, Italia Way, Vercelli) with floor plans, recent sale prices, membership type, and HOA figures. These rank for "[neighborhood] Treviso Bay" with almost no competition.
- A "Treviso Bay Golf vs. Social Membership" explainer with real dollar figures. Buyers search this constantly and every current answer online is a listing-portal fragment.
- A quarterly Treviso Bay market report emailed to owners. Sellers list with the agent who has been mailing them data for a year.

### 4. Add IDX search when the domain is live.
Downing-Frye uses iHomefinder for its IDX. Ask the brokerage to issue Lynn an agent IDX embed so visitors can search live MLS listings on her own domain rather than bouncing to downingfrye.com. Until then, the "Current listings" section is hand-maintained.

### 5. Michigan relocation funnel.
Her origin story is a lead magnet. An 810 area code on every sign in Naples already tells Michiganders she is one of them.
- A downloadable "Michigan to Naples relocation guide" (homestead, insurance, flood zones, seasonal timing, what $1M buys in each community) gated behind the contact form.
- Run a small Facebook and Instagram campaign targeting Genesee, Oakland, and Livingston County residents aged 55 to 70 with interests in golf and Florida. Budget $300 to $500 a month. Send them to this page.

### 6. Build a lead-capture and follow-up spine.
Form submission → CRM lead → instant text ("Hi, it's Lynn. Got your note, I'll call you today.") → 7-day email drip → task for Lynn. Tools you already run (GoHighLevel or Close plus n8n) do this in an afternoon. Speed-to-lead is where solo agents lose deals.

### 7. Content that fits her actual strengths.
- Short vertical videos walking a Treviso Bay listing and explaining one membership or HOA fact per clip. She is on-site daily; production cost is zero.
- A seasonal rental page. She already lists rentals and the audience overlaps perfectly with future buyers.
- Sold-property case studies: "Listed Friday, under contract Saturday: 9446 Piacere Way." Three of her 2026 sales went under contract in a week or less.

### 8. Housekeeping.
- Claim and unify her profiles: Zillow, Realtor.com, Homes.com, Downing-Frye. Same headshot, same bio, same phone. Homes.com currently links to a dead website and a personal Facebook page.
- Add a professional signature block and this URL to her email and her MLS remarks.
- Set up Google Analytics 4 or Plausible on the domain before launch so the first campaign has a baseline.

## Design notes

Coastal editorial. Sea-salt white ground, deep gulf-teal accent, brass reserved for numbers. Marcellus for headlines (a Roman inscriptional face that suits the Tuscan and Mediterranean architecture of Treviso Bay) with Mulish for body text. Dark mode follows the viewer's system setting. Fully responsive to 400 px, with a fixed call-and-message bar on phones.

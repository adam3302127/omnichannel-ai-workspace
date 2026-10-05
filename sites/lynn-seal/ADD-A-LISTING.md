# How Lynn adds a listing

Plain-English version. The site builds its listing pages, the home-page carousel and the sold strip from one file, so adding a listing is three steps.

## 1. Put the photos in a folder

Make a folder under `assets/listings/` named after the address, lowercase, with dashes:

```
assets/listings/9999-example-way/
  01.jpg   (the shot you want first: usually the front or the best lanai view)
  02.jpg
  03.jpg   ...
```

Name them in the order you would walk someone through the home: entry, foyer, great room, kitchen, primary, lanai, pool, aerial. JPEG, at least 1600px wide, under 500 KB each. If a day and a twilight exterior both exist, include both; they power the slider.

## 2. Add the listing to `data/listings.json`

Copy an existing entry (9529 Avellino Way is a good model) and change the fields. Every field is plain text:

| Field | What to put |
| --- | --- |
| `slug` | The folder name from step 1. |
| `status` | `active`, `pending`, `rental` or `sold`. |
| `ribbon` | The script headline, e.g. `{"small":"Just","script":"Listed!"}` or `{"small":"Under","script":"Contract!"}`. |
| `priceLabel` / `price` | `"$539,000"` and `539000`. Add `"priceSuffix":"/ month"` for rentals. |
| `address`, `city`, `zip`, `community`, `neighborhood` | As on the MLS sheet. |
| `beds`, `baths`, `sqft`, `garage`, `yearBuilt`, `floor`, `lot` | Text. Leave `""` to hide a fact. |
| `hoa`, `taxes`, `mls`, `membership`, `furnished`, `view` | Text. Leave `""` to hide. |
| `lat`, `lng` | From the MLS or Google Maps (right-click the pin, copy the numbers). |
| `summary` | One sentence. It becomes the page's meta description and the big line under "The home". |
| `description` | A list of paragraphs. The MLS remarks, split at natural breaks. |
| `highlights` | Up to eight short bullets. The first two appear on the flyer card. |
| `photos` | One entry per photo, in walk order: `{"file":"01.jpg","room":"Great room","sqft":"","caption":"One line about the room."}`. `sqft` is optional. |
| `compare` | `null`, or `{"before":"01.jpg","after":"02.jpg","beforeLabel":"Day","afterLabel":"Twilight"}`. |
| `floorplan` | `null`, or `{"file":"plan.jpg","hotspots":[{"x":30,"y":40,"room":"Kitchen","label":"Kitchen"}]}` where x and y are percentages across the plan image. |
| `video` | `""`, or the embed URL of a YouTube, Vimeo or Matterport tour. It fills the video slot at the end of the walkthrough. |
| `featured` | `true` to show in the home-page carousel. |
| `nearbyFallback` | Two or three nearby things to list if the live map lookup is slow. |

For a **sold** listing, use the short form (see the Corso Bello entry): status `sold`, `soldDate`, `meta`, `pts` and a single `photo` path. Sold homes get a flyer card, not a page.

When a listing goes under contract, change `status` to `pending` and the ribbon to Under Contract. When it closes, switch it to the short sold form and move its photo to `assets/listings/<slug>.jpg`.

## 3. Build

In a terminal, inside the `sites/lynn-seal` folder:

```
python3 tools/images.py     # makes the fast WebP copies of any new photos
node build.js               # writes the pages, carousel, sold strip and sitemap
```

Then upload the folder to the host (or push the branch if the host deploys from Git). If Lynn does not run a terminal, she sends the photos and the filled-in fields to Adam, who runs the two commands. A GitHub Action can run them automatically on every push once hosting is chosen.

## Rules the template enforces

- Describe the property, never the buyer. Nothing about who the home is "perfect for."
- Only real photos of the listing. If an image is virtually staged or AI-enhanced, add `"label":"Virtually staged"` to that photo entry and the page prints the label on it.
- No placeholders. Any field left `""` is hidden, not shown blank.

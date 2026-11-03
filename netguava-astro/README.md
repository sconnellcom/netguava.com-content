# Netguava (Astro)

Static Astro rebuild of [netguava.com](https://netguava.com), imported from the live WordPress site.

## Commands

| Command           | Action                              |
| ----------------- | ----------------------------------- |
| `npm install`     | Install dependencies                |
| `npm run dev`     | Dev server at `localhost:4321`      |
| `npm run build`   | Build static site to `./dist/`      |
| `npm run preview` | Preview the production build        |

## Structure

- `src/pages/[...slug].astro` – renders every imported page from `src/data/pages.json` (title, meta, styles) and `src/content/*.html` (page body).
- `src/pages/campaign-url-builder.astro` – hand-ported UTM builder tool (vanilla JS).
- `src/layouts/Layout.astro` – document shell; `src/components/Header.html` / `Footer.html` hold the site chrome.
- `public/wp-content/**` – CSS, fonts and images mirrored from the live site at their original paths.
- `public/js/site.js`, `public/css/site.css` – replacements for the WordPress plugin behaviour (nav, accordion, portfolio filter/modals, slideshows, plan toggles).
- `scripts/scrape.py` – the one-time importer (`pip install beautifulsoup4 lxml requests`). Re-running re-pulls pages and regenerates `src/content`, `src/data` and the chrome.

## Forms (placeholders)

The Gravity Forms were replaced with plain HTML forms marked `data-placeholder-form` with `action="#"`.
Submitting currently only shows a "not connected yet" notice (see `public/js/site.js`).
To wire one up, set the form's `action`/`method` in the page's file under `src/content/` and remove the `data-placeholder-form` attribute (or replace the handler at the bottom of `site.js`).
Forms live in: `contact`, `custom-web-app-development`, `online-marketing`, `wordpress-support`, `wordpress-support__plan-comparison`, `website-builds-for-designers`.

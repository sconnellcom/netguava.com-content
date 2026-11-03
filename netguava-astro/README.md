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

## Contact forms

All six forms submit multipart POST requests to `/send-contact.php`, using the
PHP/Mailgun pattern from the sewerandseptic.com site. Submissions go to
`support@netguava.com` by default, with the visitor's email as Reply-To. Emails
include the originating page, phone number, service and plan where applicable.
The designer estimate form supports one optional attachment up to 8 MB.

The shared handler in `public/js/site.js` prevents duplicate submissions, shows
accessible sending/success/error feedback, and preserves input on failure. Plan
selection is required. The importer also produces connected forms when re-run.

### Deployment

1. Run `npm run build` and deploy the **contents** of `dist/` to a PHP-enabled
   document root (`/home/sitefolder/wwwroot`). PHP 8+ with cURL and outbound HTTPS access is required.
   `send-contact.php` is copied into the build automatically.
2. Set `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL` and optionally
   `MAILGUN_TO_EMAIL` in the PHP server environment. Use a verified Mailgun sending
   domain and authorized recipient. This endpoint uses Mailgun's US API.
   Alternatively, copy `send-contact-config.example.php` to
   `/home/sitefolder/data/send-contact-config.php` (in the sibling `data/` folder,
   outside the document root) and fill in
   the values there. Never put credentials in `public/`, `dist/`, client-side
   variables, or Git.
3. Configure PHP with `upload_max_filesize = 8M` and `post_max_size = 10M` or
   greater, and allow at least 10 MB request bodies in the web server.
4. Optionally set `CONTACT_RATE_LIMIT_FILE` to a persistent, PHP-writable file
   outside the document root. By default a site-specific file in PHP's temporary
   directory is used. This shared file enforces 15 delivery attempts per rolling
   hour and 25 per rolling day (including failed attempts); keep it persistent
   across deployments. Multiple servers must share this file with working locks.
   Only timestamps are stored; operational events go to the PHP error log.
5. Test a real submission on the deployed host and verify receipt in the inbox.
   A successful response means Mailgun accepted the message, not guaranteed inbox
   delivery. Missing configuration, rejected mail, honeypot submissions, and quota
   exhaustion return explicit errors rather than false success.

Astro's dev/preview servers and static-only hosts do **not** execute PHP. For a
local end-to-end check, build, then run `php -S 127.0.0.1:8080 -t dist` from this
directory with the server-side configuration in place.

### Tests

`npm test` checks all six forms and the shared browser handler.
`npm run test:php` runs HTTP integration tests using PHP's built-in server and a
mocked Mailgun transport; it sends no real emails. PHP with cURL must be on PATH,
or set `PHP_BIN` to the executable and optionally `PHP_EXTENSION_DIR` to its
extension directory. Tests cover validation, delivery errors, plan details,
the exact 8 MB attachment boundary, and hourly/daily quotas.

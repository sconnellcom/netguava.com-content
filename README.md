# netguava.com-content

Content repository for Netguava website. This repository contains static content files that are proxied by the main netguava.com website.

## Business Consulting Landing Page

The business consulting pages provide professional landing pages for Netguava's business technology consulting services.

### Files:

- **`business-consulting.html`** - Content-only version (proxy: false)
  - Contains only the main content (hero, services, features, CTA sections)
  - No navigation header or footer
  - Intended to be proxied by netguava.com which will wrap it with its own header/footer

- **`business-consulting-proxy.html`** - Standalone version (proxy: true)
  - Complete standalone HTML page
  - Includes full navigation header and footer
  - Can be used independently or proxied as a complete page

### Features:
- Business automation consulting focus
- Database and web-based technology solutions
- Responsive design for all devices
- Professional green color scheme matching Netguava branding
- Accessible with ARIA labels for screen readers
- SEO optimized with proper meta tags

### Usage:
These files are configured in `index.json` and accessed by configuring the netguava.com website to proxy content from this GitHub repository.
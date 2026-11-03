#!/usr/bin/env python3
"""One-time importer: pulls pages, styles, fonts and images from the live
netguava.com WordPress site and writes them into this Astro project.

Output:
  public/<same path as origin>      mirrored CSS, fonts, images
  public/_ext/<host>/<path>         assets hosted on other domains
  src/data/pages.json               per-page metadata
  src/content/<slug>.html           cleaned page body fragments
  src/components/Header.html / Footer.html   cleaned site chrome

Usage: pip install beautifulsoup4 lxml requests && python3 scripts/scrape.py
"""
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ORIGIN = "https://netguava.com"
ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SRC = ROOT / "src"
UA = {"User-Agent": "Mozilla/5.0 (netguava-astro importer)"}

session = requests.Session()
session.headers.update(UA)
asset_cache: dict[str, str] = {}


def get(url: str):
    try:
        r = session.get(url, timeout=60)
        if r.status_code == 200:
            return r
        print("  ! HTTP", r.status_code, url, file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print("  ! ERR", e, url, file=sys.stderr)
    return None


def local_path(url: str) -> str:
    u = urlparse(url)
    if u.netloc in ("netguava.com", "www.netguava.com", ""):
        return u.path
    return f"/_ext/{u.netloc}{u.path}"


def fetch_asset(url: str) -> str:
    """Download an asset (once) and return its root-relative local path."""
    url = url.split("#")[0].split("?")[0]
    if url in asset_cache:
        return asset_cache[url]
    lp = local_path(url)
    dest = PUBLIC / lp.lstrip("/")
    asset_cache[url] = lp
    if not dest.exists():
        r = get(url)
        if r is None:
            return lp
        dest.parent.mkdir(parents=True, exist_ok=True)
        data = r.content
        if lp.endswith(".css"):
            data = process_css(r.text, url).encode()
        dest.write_bytes(data)
    return lp


URL_RE = re.compile(r"url\(\s*(['\"]?)([^)'\"]+)\1\s*\)")
IMPORT_RE = re.compile(r"@import\s+(['\"])([^'\"]+)\1")


def process_css(css: str, base: str) -> str:
    def repl(m):
        ref = m.group(2).strip()
        if ref.startswith(("data:", "#")):
            return m.group(0)
        full = urljoin(base, ref)
        suffix = ""
        mm = re.search(r"[?#].*$", ref)
        if mm:
            suffix = mm.group(0)
        return f"url('{fetch_asset(full)}{suffix}')"

    css = URL_RE.sub(repl, css)
    css = IMPORT_RE.sub(lambda m: f"@import '{fetch_asset(urljoin(base, m.group(2)))}'", css)
    return css


PAGE_SLUGS: set[str] = set()


def fix_href(href: str) -> str:
    if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
        return href
    full = urljoin(ORIGIN + "/", href)
    u = urlparse(full)
    if u.netloc not in ("netguava.com", "www.netguava.com"):
        return href
    path = u.path
    if path.startswith("/wp-content/"):
        return fetch_asset(ORIGIN + path)
    norm = path.strip("/")
    if norm in PAGE_SLUGS or norm == "":
        return ("/" + norm + "/" if norm else "/") + (f"#{u.fragment}" if u.fragment else "")
    return full  # exists on the live site only (redirects etc.)


def srcset_fix(value: str) -> str:
    out = []
    for part in value.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        bits[0] = fetch_asset(urljoin(ORIGIN + "/", bits[0]))
        out.append(" ".join(bits))
    return ", ".join(out)


def convert_form(soup: BeautifulSoup, wrapper) -> None:
    form = wrapper.find("form")
    if form is None:
        return
    form["action"] = "#"
    form["method"] = "post"
    form["data-placeholder-form"] = form.get("id", "form")
    for attr in ("target", "novalidate", "data-formid", "enctype"):
        form.attrs.pop(attr, None)
    for el in form.select("input[type=hidden]"):
        n = el.get("name", "")
        if n.startswith(("gform_", "is_submit", "state_", "version_hash")):
            el.decompose()
    for el in form.select(".gform_validation_container, .gform_ajax_spinner"):
        el.decompose()
    for el in form.select("[aria-required=true]"):
        el["required"] = ""
    for el in form.select("[onclick], [onkeypress]"):
        el.attrs.pop("onclick", None)
        el.attrs.pop("onkeypress", None)
    note = soup.new_tag("p", attrs={"class": "form-placeholder-note", "hidden": "", "role": "status"})
    note.string = "Thanks! This form isn't connected yet. Please call (800) 861-8784 in the meantime."
    form.append(note)


def clean_fragment(soup: BeautifulSoup, root) -> None:
    for t in root.select("script, noscript, style, link"):
        t.decompose()
    for t in root.select("iframe[src='about:blank']:not([data-lazy-src])"):
        t.decompose()
    for t in root.select("iframe[name^=gform_ajax_frame], .gform_heading, .gform_validation_errors"):
        t.decompose()

    for el in root.find_all(True):
        for k in list(el.attrs):
            if k.startswith("data-rocket") or k == "data-node":
                del el.attrs[k]
        if el.get("data-lazy-src"):
            el["src"] = el.attrs.pop("data-lazy-src")
        if el.get("data-lazy-srcset"):
            el["srcset"] = el.attrs.pop("data-lazy-srcset")
        if el.get("data-lazy-sizes"):
            el["sizes"] = el.attrs.pop("data-lazy-sizes")
        if el.get("loading") == "false":
            del el.attrs["loading"]
        el.attrs.pop("fetchpriority", None)
        cls = el.get("class")
        if cls and "rocket-lazyload" in cls:
            cls.remove("rocket-lazyload")
        if el.name == "img":
            if el.get("src"):
                el["src"] = fetch_asset(urljoin(ORIGIN + "/", el["src"]))
            if el.get("srcset"):
                el["srcset"] = srcset_fix(el["srcset"])
            if not el.get("loading"):
                el["loading"] = "lazy"
        elif el.name == "iframe":
            el["loading"] = "lazy"
        elif el.name == "a" and el.get("href"):
            el["href"] = fix_href(el["href"])
        if el.get("data-parallax-image"):
            lp = fetch_asset(el["data-parallax-image"])
            el["style"] = (el.get("style", "") + f";--bg:url('{lp}')").lstrip(";")
        style = el.get("style")
        if style and "url(" in style:
            el["style"] = process_css(style, ORIGIN + "/")

    for w in root.select(".gform_wrapper"):
        convert_form(soup, w)


def extract_slideshows(layout_js: str) -> dict:
    """Slideshow photo lists live in the BB layout JS, keyed by node id."""
    result = {}
    for m in re.finditer(r"render\(['\"]\.fl-node-([0-9a-f]+) \.fl-slideshow-container['\"]\)", layout_js):
        node = m.group(1)
        before = layout_js[: m.start()]
        start = before.rfind("new Y.FL.Slideshow")
        block = before[start:]
        photos = re.findall(r'largeURL:"([^"]+)"[^}]*?alt:"([^"]*)"', block)
        result[node] = [{"src": fetch_asset(u), "alt": html.unescape(a)} for u, a in photos]
    return result


def build_slideshows(soup: BeautifulSoup, root, slides: dict) -> None:
    for mod in root.select(".fl-module-slideshow"):
        node = next((c[8:] for c in mod.get("class", []) if c.startswith("fl-node-")), None)
        photos = slides.get(node or "", [])
        container = mod.select_one(".fl-slideshow-container")
        if not container or not photos:
            continue
        container.clear()
        container["class"] = ["ng-slideshow"]
        for i, p in enumerate(photos):
            img = soup.new_tag("img", src=p["src"], alt=p["alt"], loading="lazy")
            if i == 0:
                img["class"] = "active"
            container.append(img)


def save_chrome(soup: BeautifulSoup) -> None:
    hd = soup.select_one(".navigation-header")
    for t in hd.select(".nav-search-widget"):
        t.find_parent("li").decompose()
    for a in hd.find_all("a"):
        if a.get("href"):
            a["href"] = fix_href(a["href"])
    for sm in hd.select(".sub-menu[style]"):
        del sm.attrs["style"]
    ft = soup.select_one("footer.footer")
    clean_fragment(soup, ft)
    comp = SRC / "components"
    comp.mkdir(parents=True, exist_ok=True)
    (comp / "Header.html").write_text(hd.decode().strip() + "\n")
    (comp / "Footer.html").write_text(ft.decode().strip() + "\n")


def main() -> None:
    sm = get(ORIGIN + "/page-sitemap.xml")
    urls = re.findall(r"<loc>([^<]+)</loc>", sm.text)
    for u in urls:
        PAGE_SLUGS.add(urlparse(u).path.strip("/"))
    print("pages:", sorted(PAGE_SLUGS))

    pages = []
    common_ids = {
        "wp-img-auto-sizes-contain-inline-css",
        "classic-theme-styles-inline-css",
        "global-styles-inline-css",
        "wp-custom-css",
    }
    common_inline = {}
    chrome_done = False

    for u in urls:
        slug = urlparse(u).path.strip("/")
        print("==", slug or "home")
        r = get(u)
        if r is None:
            continue
        soup = BeautifulSoup(r.text, "lxml")

        styles = []
        for link in soup.select("link[rel=stylesheet]"):
            if link.get("href"):
                styles.append(fetch_asset(urljoin(u, link["href"])))

        page_inline = []
        for s in soup.select("style"):
            sid = s.get("id", "")
            css = s.get_text()
            if sid in common_ids:
                common_inline.setdefault(sid, process_css(css, u))
            elif sid != "rocket-lazyload-nojs-css" and not s.find_parent(class_="entry-content") and css.strip():
                page_inline.append(process_css(css, u))

        def meta(sel):
            e = soup.select_one(sel)
            return e.get("content") if e else None

        art = soup.select_one("article")
        info = {
            "slug": slug,
            "title": soup.title.get_text(strip=True) if soup.title else "Netguava",
            "description": meta("meta[name=description]") or "",
            "robots": meta("meta[name=robots]") or "",
            "ogImage": meta("meta[property='og:image']") or "",
            "bodyClass": " ".join(c for c in soup.body.get("class", []) if c != "fl-no-js"),
            "styles": styles,
            "inlineStyles": page_inline,
            "articleClass": " ".join(art.get("class", [])) if art else "",
            "articleId": art.get("id", "") if art else "",
        }

        if not chrome_done:
            chrome_done = True
            save_chrome(soup)

        content = soup.select_one(".entry-content")
        if content is not None:
            slides = {}
            for sc in soup.select("script[src*='-layout.js']"):
                js = get(urljoin(u, sc["src"]))
                if js:
                    slides = extract_slideshows(js.text)
            build_slideshows(soup, content, slides)
            clean_fragment(soup, content)
            out = SRC / "content" / f"{slug.replace('/', '__') or 'home'}.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(content.decode_contents().strip() + "\n")
        info["hasContent"] = content is not None
        pages.append(info)

    (PUBLIC / "css").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "css" / "wp-inline.css").write_text("\n".join(common_inline.values()))
    (SRC / "data").mkdir(parents=True, exist_ok=True)
    (SRC / "data" / "pages.json").write_text(json.dumps(pages, indent=2) + "\n")

    for f in ("/apple-touch-icon.png", "/favicon-32x32.png", "/favicon-16x16.png", "/safari-pinned-tab.svg", "/favicon.ico"):
        fetch_asset(ORIGIN + f)
    print("done:", len(pages), "pages,", len(asset_cache), "assets")


if __name__ == "__main__":
    main()

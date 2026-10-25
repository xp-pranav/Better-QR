# Better QR — Production Release

> **Make Every Scan Better.**  
> Self-contained, offline-first production build of Better QR.

This directory contains the production-ready standalone distribution of Better QR. It is completely pre-compiled, local-first, privacy-respecting, and requires zero build tools or external network connections to run.

---

## Quick Start & Running Locally

Better QR runs directly in any modern web browser (Chrome, Edge, Safari, Firefox).

### Option 1: Direct File Access
Simply double-click `index.html` or open it directly in your browser:
```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

### Option 2: Local HTTP Server (Recommended)
While direct file access is supported, running a lightweight local HTTP server provides optimal performance for canvas operations and modern font loading:

- **Python 3:**
  ```bash
  python3 -m http.server 8080
  # Open http://localhost:8080 in your browser
  ```

- **Node.js (`npx`):**
  ```bash
  npx serve .
  # or
  npx http-server -p 8080
  ```

- **PHP:**
  ```bash
  php -S localhost:8080
  ```

- **VS Code:**
  Right-click `index.html` and select **"Open with Live Server"**.

---

## Deploying to Production

Because Better QR is 100% static, you can deploy this directory to any static web host or CDN:

- **GitHub Pages:** Upload this directory to your repository branch (e.g. `main` or `gh-pages`) and enable Pages in repository settings.
- **Netlify / Vercel / Cloudflare Pages:** Drag-and-drop this folder or point your deployment build path to this folder (no build command needed).
- **Self-Hosted (NGINX / Apache / Caddy):** Point your server's root directory (`DocumentRoot`) directly to this folder.

---

## Production Contents

- `index.html`: Main application entry point with high-contrast neo-brutalist UI.
- `site.webmanifest`: Web App Manifest for progressive web app installation and home screen bookmarks.
- `favicon.ico`: Multi-resolution Windows/browser icon container (16x16, 32x32, 48x48).
- `assets/icons/`: High-resolution SVG, PNG (16px, 32px, 180px, 192px, 512px) icons and Apple Touch Icons.
- `css/`: Production design system (tokens, base reset, layout, neo-brutalist components, responsive rules).
- `js/`: Modular JavaScript engines (QR generator, payload validators, universal export studio, bulk workflow, print engine, and editor UI).
- `vendor/`: Embedded local QR library (`qrcode.js`).
- `LICENSE` & `THIRD_PARTY_LICENSES.md`: Software licenses.

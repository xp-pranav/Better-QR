# Third-party licenses and notices

This repository bundles the following third-party open source dependencies for local-first, offline execution:

## 1. qrcode-generator

- **Name and Version:** `qrcode-generator` v1.4.4
- **Author:** Kazuhiko Arase (http://www.d-project.com/)
- **Repository / Source:** https://github.com/kazuhikoarase/qrcode-generator
- **Retrieval Date:** 2026-10-23
- **License:** MIT License (`MIT`)
- **License File:** [`vendor/qrcode.LICENSE`](vendor/qrcode.LICENSE)
- **Redistribution & Offline Bundling:** Permitted under the MIT license without restriction.
- **Bundled File(s):**
  - `vendor/qrcode.js` (unminified standalone library)
  - `vendor/qrcode.LICENSE` (MIT license text)
- **Why Needed:** Provides zero-dependency ISO/IEC 18004 QR Code Model 2 matrix generation with automatic version detection (1–40), error correction level support (L, M, Q, H), and multi-byte UTF-8 character encoding. Runs completely client-side in vanilla JavaScript with 100% `file://` compatibility without requiring build tools or remote CDNs.
- **Vulnerabilities / Maintenance:** Standalone algorithmic matrix generation library; no network or DOM access; no known security advisories.

---

### Notice & Copyright

```text
QR Code Generator for JavaScript
Copyright (c) 2009 Kazuhiko Arase
Licensed under the MIT license: http://www.opensource.org/licenses/mit-license.php
The word 'QR Code' is a registered trademark of DENSO WAVE INCORPORATED.
```

---

## 2. Zero-Dependency Custom Local Encoders & Architecture

To satisfy strict offline and `file://` constraints without introducing bulky, unvetted, or GPL/restrictive third-party npm libraries, the Universal Export Studio relies on bespoke, pure-vanilla ECMAScript 5/6 zero-dependency encoders authored natively for this project:

- **`js/export/zip-builder.js`**: Pure JavaScript implementation of the PKWARE ZIP File Format Specification (ISO/IEC 21320-1) utilizing uncompressed Store (Method 0) and IEEE 802.3 32-bit CRC polynomials. Produces standard, cross-platform ZIP archives compatible with macOS Archive Utility, Windows File Explorer, Linux `unzip`, Microsoft Word, Microsoft Excel, and LibreOffice.
- **`js/export/image-encoders.js`**: Custom binary encoders for Windows 3.0 BMP (BITMAPINFOHEADER 24-bit/32-bit RGBA), TIFF 6.0 Baseline uncompressed little-endian (with DPI/resolution tags and planar configuration), and Windows Icon (ICO) multi-resolution container format.
- **`js/export/vector-encoders.js`**:
  - *EPS*: Adobe PostScript Level 3 Document Structuring Conventions (DSC 3.0) compliant vector generator with accurate `%%BoundingBox` calculations and vector path fills.
  - *DXF*: AutoCAD Release 12 (R12) ASCII Drawing Exchange Format generator utilizing `SECTION ENTITIES` with 2D `SOLID` module coordinates for precise CAD, laser-cutting, CNC, and vinyl-cutter plotting.
  - *PDF*: Portable Document Format 1.4 (`%PDF-1.4`) vector generator supporting single card posters, 4-up cut sheets, and 9-up batch grids with embedded typography, crop marks, and cross-reference tables.
- **`js/export/document-encoders.js`**:
  - *DOCX*: Genuine Microsoft Word Open XML package (.docx) with `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, XML-escaped typography, and embedded high-resolution PNG image relationship.
  - *RTF*: Rich Text Format 1.5 specification generator with embedded hexadecimal PNG pict blip (`\pict\pngblip`).
  - *HTML*: Standalone responsive HTML5 printable card with embedded base64 data URI and `@media print` layout styles.
  - *TXT*: UTF-8 formatted specification sheet with design metadata and ASCII/Unicode matrix preview.
- **`js/export/spreadsheet-encoders.js`**:
  - *XLSX*: Genuine Microsoft Excel Open XML package (.xlsx) with `workbook.xml`, worksheet XML, cell formatting, column widths, and sanitized values.
  - *ODS*: OASIS OpenDocument Spreadsheet format (.ods) with `mimetype`, `META-INF/manifest.xml`, and `content.xml`.
  - *CSV & TSV*: RFC 4180 compliant comma- and tab-separated values with UTF-8 Byte Order Mark (`\uFEFF`) and CWE-1236 spreadsheet formula-injection protection (all cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are safely escaped).
- **`js/bulk/bulk-engine.js` & `js/ui/bulk-ui.js`**:
  - *Bulk Ingestion & Parsing*: Bespoke pure-vanilla ECMAScript parsers for RFC 4180 CSV, TSV, key-value and delimited TXT, and pasted spreadsheet tables.
  - *Client-Side XLSX Unpacker*: Native browser decompression using the W3C `DecompressionStream('deflate-raw')` API paired with ISO 21320-1 ZIP header parsing and XML DOM extraction, enabling full Excel workbook parsing completely locally under `file://` with zero external npm dependencies.
  - *CWE-1236 Formula Defense & Filename Sanitization*: Standalone security filters for formula escaping and path traversal (`..`) elimination.


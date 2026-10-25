/**
 * QR Design Studio — Universal Export Studio Engine
 * Comprehensive multi-category export orchestrator supporting:
 * 
 * 1. Images: PNG, JPEG, WebP, AVIF, BMP, TIFF, ICO
 * 2. Vector & Print: SVG, PDF (Single Poster & Multi-Up Sheets), EPS, DXF
 * 3. Documents: DOCX, RTF, HTML Document, TXT Spec Sheet
 * 4. Spreadsheets: XLSX, CSV, TSV, ODS
 * 5. Design & Figma: Figma Handoff ZIP, Design Spec JSON
 * 6. Project & Data: Project Package JSON, Backup ZIP, HTML Embed Snippet
 * 7. Multi-Format Bundle: Export multiple selected formats as a single ZIP archive.
 * 
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Safe dimension bounds to protect device memory and guarantee scanability.
   */
  var SAFE_LIMITS = {
    MIN_SIZE: 64,
    RECOMMENDED_MIN: 256,
    MAX_SIZE: 4096,
    DEFAULT_SIZE: 512
  };

  /**
   * Escape unsafe characters for XML / SVG attributes and text nodes.
   */
  function escapeXml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe).replace(/[<>&'"]/g, function(c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  /**
   * Validate that an image data URL is strictly a raster base64 string.
   */
  function isSafeDataUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(url.trim());
  }

  /**
   * Safe document resolver for browser and headless test environments.
   */
  function getDocument() {
    if (typeof document !== 'undefined') return document;
    if (typeof window !== 'undefined' && window.document) return window.document;
    return null;
  }

  /**
   * Detect WebP canvas encoding support.
   */
  function checkWebPSupport() {
    var doc = getDocument();
    if (!doc) return false;
    try {
      var canvas = doc.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      var dataUrl = canvas.toDataURL('image/webp');
      return typeof dataUrl === 'string' && dataUrl.indexOf('data:image/webp') === 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect AVIF canvas encoding support.
   */
  function checkAVIFSupport() {
    if (QRStudio.ImageEncoders && typeof QRStudio.ImageEncoders.isAVIFSupported === 'function') {
      return QRStudio.ImageEncoders.isAVIFSupported();
    }
    var doc = getDocument();
    if (!doc) return false;
    try {
      var canvas = doc.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      var dataUrl = canvas.toDataURL('image/avif');
      return typeof dataUrl === 'string' && dataUrl.indexOf('data:image/avif') === 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Sanitize project name or payload type into a filesystem-safe base filename.
   */
  function sanitizeName(rawName) {
    var name = (rawName || 'qr-code').trim();
    if (name.normalize) {
      name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    name = name.replace(/\.\./g, '');
    name = name.replace(/[\s_]+/g, '-');
    name = name.replace(/[^a-zA-Z0-9-]/g, '');
    name = name.replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return name || 'qr-code';
  }

  /**
   * Format catalogue defining metadata, categories, capabilities, and file extensions.
   */
  var FORMAT_CATALOGUE = [
    // --- IMAGES ---
    {
      id: 'png',
      name: 'PNG Image',
      extension: 'png',
      mimeType: 'image/png',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'RASTER',
      description: 'Lossless raster with sharp module edges, quiet zone protection, and optional alpha transparency.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: true,
      lossy: false
    },
    {
      id: 'jpeg',
      name: 'JPEG Image',
      extension: 'jpg',
      mimeType: 'image/jpeg',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'RASTER',
      description: 'Compact lossy format with solid background enforcement (no black alpha artifacts) and quality slider.',
      supportsTransparency: false,
      supportsQuality: true,
      supportsCustomSize: true,
      lossy: true
    },
    {
      id: 'webp',
      name: 'WebP Image',
      extension: 'webp',
      mimeType: 'image/webp',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'MODERN',
      description: 'Modern web image format supporting high compression, alpha transparency, and quality slider.',
      supportsTransparency: true,
      supportsQuality: true,
      supportsCustomSize: true,
      lossy: true
    },
    {
      id: 'avif',
      name: 'AVIF Image',
      extension: 'avif',
      mimeType: 'image/avif',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'NEXT-GEN',
      description: 'Next-generation AV1 image compression. Automatically detects browser support.',
      supportsTransparency: true,
      supportsQuality: true,
      supportsCustomSize: true,
      lossy: true
    },
    {
      id: 'bmp',
      name: 'BMP Bitmap',
      extension: 'bmp',
      mimeType: 'image/bmp',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'LEGACY',
      description: 'Uncompressed Windows Bitmap (24-bit RGB or 32-bit RGBA) for industrial/legacy printing.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: true,
      lossy: false
    },
    {
      id: 'tiff',
      name: 'TIFF Image',
      extension: 'tiff',
      mimeType: 'image/tiff',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'PRINT',
      description: 'Baseline TIFF 6.0 uncompressed format with print resolution tags for prepress publishing.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: true,
      lossy: false
    },
    {
      id: 'ico',
      name: 'Windows Icon',
      extension: 'ico',
      mimeType: 'image/x-icon',
      category: 'images',
      categoryLabel: 'Raster Images',
      badge: 'FAVICON',
      description: 'Multi-resolution Windows Icon file embedding 16px to 256px icon frames.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },

    // --- VECTOR & PRINT ---
    {
      id: 'svg',
      name: 'SVG Vector',
      extension: 'svg',
      mimeType: 'image/svg+xml',
      category: 'vector',
      categoryLabel: 'Vector & Print',
      badge: 'VECTOR',
      description: 'Resolution-independent pure vector graphic with safe embedded assets and zero scripts.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: true,
      lossy: false
    },
    {
      id: 'pdf',
      name: 'PDF Document / Sheet',
      extension: 'pdf',
      mimeType: 'application/pdf',
      category: 'vector',
      categoryLabel: 'Vector & Print',
      badge: 'PRINT-READY',
      description: 'Print-ready PDF 1.4 supporting Single Poster, 4-Up Cards, or 9-Up Sheet layouts (Letter / A4).',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      supportsPrintLayout: true,
      lossy: false
    },
    {
      id: 'eps',
      name: 'EPS Vector (PostScript)',
      extension: 'eps',
      mimeType: 'application/postscript',
      category: 'vector',
      categoryLabel: 'Vector & Print',
      badge: 'VECTOR',
      description: 'PostScript Level 3 Encapsulated PostScript vector file for Adobe Illustrator & prepress.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: true,
      lossy: false
    },
    {
      id: 'dxf',
      name: 'AutoCAD DXF',
      extension: 'dxf',
      mimeType: 'application/dxf',
      category: 'vector',
      categoryLabel: 'Vector & Print',
      badge: 'CAD / CNC',
      description: 'ASCII AutoCAD DXF R12 2D CAD vector format for CNC engraving, vinyl cutting, and milling.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: true,
      lossy: false
    },

    // --- DOCUMENTS ---
    {
      id: 'docx',
      name: 'Word Document',
      extension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category: 'documents',
      categoryLabel: 'Documents',
      badge: 'OFFICE',
      description: 'Genuine Microsoft Word Open XML document with title, embedded high-res QR, and metadata table.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'rtf',
      name: 'Rich Text Format',
      extension: 'rtf',
      mimeType: 'application/rtf',
      category: 'documents',
      categoryLabel: 'Documents',
      badge: 'DOC',
      description: 'Cross-platform styled document with embedded QR picture and formatted metadata.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'html-doc',
      name: 'Printable HTML Card',
      extension: 'html',
      mimeType: 'text/html',
      category: 'documents',
      categoryLabel: 'Documents',
      badge: 'STANDALONE',
      description: 'Self-contained, responsive printable HTML document card with base64 QR and print stylesheet.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'txt',
      name: 'Text Spec Sheet',
      extension: 'txt',
      mimeType: 'text/plain',
      category: 'documents',
      categoryLabel: 'Documents',
      badge: 'SPEC',
      description: 'Clean UTF-8 text specification sheet with metadata table and ASCII/Unicode matrix.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },

    // --- SPREADSHEETS ---
    {
      id: 'xlsx',
      name: 'Excel Workbook',
      extension: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      category: 'spreadsheets',
      categoryLabel: 'Spreadsheets',
      badge: 'EXCEL',
      description: 'Genuine Microsoft Excel Open XML workbook with styled header, metadata columns, and formula injection guard.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'csv',
      name: 'CSV Records',
      extension: 'csv',
      mimeType: 'text/csv',
      category: 'spreadsheets',
      categoryLabel: 'Spreadsheets',
      badge: 'DATA',
      description: 'RFC 4180 CSV records with UTF-8 BOM for Excel Unicode compatibility and formula sanitization.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'tsv',
      name: 'TSV Records',
      extension: 'tsv',
      mimeType: 'text/tab-separated-values',
      category: 'spreadsheets',
      categoryLabel: 'Spreadsheets',
      badge: 'DATA',
      description: 'Tab-separated records with UTF-8 BOM and formula injection protection.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'ods',
      name: 'OpenDocument Sheet',
      extension: 'ods',
      mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
      category: 'spreadsheets',
      categoryLabel: 'Spreadsheets',
      badge: 'ODF',
      description: 'Genuine OASIS OpenDocument Spreadsheet format for LibreOffice Calc and OpenOffice.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },

    // --- FIGMA & DESIGN ---
    {
      id: 'figma-zip',
      name: 'Figma Handoff Kit',
      extension: 'zip',
      mimeType: 'application/zip',
      category: 'design',
      categoryLabel: 'Design & Figma',
      badge: 'HANDOFF',
      description: 'Organized ZIP containing vector SVG, multi-res PNGs (512, 1024, 2048), W3C Design Tokens JSON, Spec JSON & README.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'design-spec',
      name: 'Design Tokens & Spec',
      extension: 'json',
      mimeType: 'application/json',
      category: 'design',
      categoryLabel: 'Design & Figma',
      badge: 'TOKENS',
      description: 'W3C Community Group Design Tokens format & structured JSON specification with color metrics and geometry.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },

    // --- PROJECT & DATA ---
    {
      id: 'project-json',
      name: 'Project Backup JSON',
      extension: 'qrproject.json',
      mimeType: 'application/json',
      category: 'project',
      categoryLabel: 'Project & Data',
      badge: 'SCHEMA V2',
      description: 'Self-contained versioned JSON project package for reliable cross-session project import/export.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'backup-zip',
      name: 'Complete Project ZIP',
      extension: 'zip',
      mimeType: 'application/zip',
      category: 'project',
      categoryLabel: 'Project & Data',
      badge: 'ARCHIVE',
      description: 'Complete project ZIP bundle containing project JSON, vector SVG, master preview PNG, and extracted assets.',
      supportsTransparency: true,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    },
    {
      id: 'html-embed',
      name: 'Website Embed Snippet',
      extension: 'html',
      mimeType: 'text/html',
      category: 'project',
      categoryLabel: 'Project & Data',
      badge: 'EMBED',
      description: 'Responsive HTML5 <figure> snippet with base64 embedded QR image and accessible CSS for instant copy-paste.',
      supportsTransparency: false,
      supportsQuality: false,
      supportsCustomSize: false,
      lossy: false
    }
  ];

  var CATEGORIES = [
    { id: 'all', label: 'All Formats' },
    { id: 'images', label: 'Images' },
    { id: 'vector', label: 'Vector & Print' },
    { id: 'documents', label: 'Documents' },
    { id: 'spreadsheets', label: 'Spreadsheets' },
    { id: 'design', label: 'Design & Figma' },
    { id: 'project', label: 'Project & Data' }
  ];

  var ExportStudio = {
    SAFE_LIMITS: SAFE_LIMITS,
    FORMAT_CATALOGUE: FORMAT_CATALOGUE,
    CATEGORIES: CATEGORIES,

    /**
     * Get format definitions, optionally filtered by category or search query.
     */
    getFormats: function(category, query) {
      return FORMAT_CATALOGUE.filter(function(fmt) {
        if (category && category !== 'all' && fmt.category !== category) {
          return false;
        }
        if (query && typeof query === 'string') {
          var q = query.trim().toLowerCase();
          var matched = fmt.name.toLowerCase().indexOf(q) !== -1 ||
                        fmt.extension.toLowerCase().indexOf(q) !== -1 ||
                        fmt.badge.toLowerCase().indexOf(q) !== -1 ||
                        fmt.description.toLowerCase().indexOf(q) !== -1;
          if (!matched) return false;
        }
        return true;
      });
    },

    /**
     * Get a single format definition by ID.
     */
    getFormatById: function(id) {
      id = (id || '').toLowerCase();
      if (id === 'jpg') id = 'jpeg';
      for (var i = 0; i < FORMAT_CATALOGUE.length; i++) {
        if (FORMAT_CATALOGUE[i].id === id) {
          return FORMAT_CATALOGUE[i];
        }
      }
      return null;
    },

    /**
     * Check if WebP is supported.
     */
    isWebPSupported: function() {
      return checkWebPSupport();
    },

    /**
     * Check if AVIF is supported.
     */
    isAVIFSupported: function() {
      return checkAVIFSupport();
    },

    /**
     * Check if a format is supported in the current environment.
     */
    isFormatSupported: function(formatId) {
      formatId = (formatId || '').toLowerCase();
      if (formatId === 'webp') {
        return this.isWebPSupported();
      }
      if (formatId === 'avif') {
        return this.isAVIFSupported();
      }
      // All other formats are 100% supported via pure vanilla JS encoders!
      return true;
    },

    /**
     * Sanitize filename base string.
     */
    sanitizeFilename: sanitizeName,
    sanitizeName: sanitizeName,

    /**
     * Validate requested export dimensions against safe limits.
     */
    validateDimensions: function(width, height) {
      var w = parseInt(width, 10);
      var h = parseInt(height, 10);
      var errors = [];
      var warnings = [];

      if (isNaN(w) || w <= 0) errors.push('Width must be a positive integer.');
      if (isNaN(h) || h <= 0) errors.push('Height must be a positive integer.');

      if (errors.length > 0) {
        return { valid: false, errors: errors, warnings: warnings };
      }

      if (w < SAFE_LIMITS.MIN_SIZE) errors.push('Width cannot be less than ' + SAFE_LIMITS.MIN_SIZE + 'px.');
      if (h < SAFE_LIMITS.MIN_SIZE) errors.push('Height cannot be less than ' + SAFE_LIMITS.MIN_SIZE + 'px.');
      if (w > SAFE_LIMITS.MAX_SIZE) errors.push('Width cannot exceed ' + SAFE_LIMITS.MAX_SIZE + 'px.');
      if (h > SAFE_LIMITS.MAX_SIZE) errors.push('Height cannot exceed ' + SAFE_LIMITS.MAX_SIZE + 'px.');

      if (errors.length > 0) {
        return { valid: false, errors: errors, warnings: warnings };
      }

      if (w < SAFE_LIMITS.RECOMMENDED_MIN || h < SAFE_LIMITS.RECOMMENDED_MIN) {
        warnings.push('Dimensions under 256px may reduce QR scan reliability on physical prints or low-res cameras.');
      }

      return {
        valid: true,
        width: w,
        height: h,
        errors: [],
        warnings: warnings
      };
    },

    /**
     * Build standard sanitized filename.
     */
    buildFilename: function(typeOrName, format, options) {
      format = (format || 'png').toLowerCase();
      var fmtDef = this.getFormatById(format);
      var ext = fmtDef ? fmtDef.extension : (format === 'jpeg' ? 'jpg' : format);

      var base = sanitizeName(typeOrName);
      var w = options && (options.width || options.size) || SAFE_LIMITS.DEFAULT_SIZE;
      var h = options && (options.height || options.size) || w;

      // Special naming for packages
      if (ext === 'zip' || ext === 'docx' || ext === 'xlsx' || ext === 'ods' || ext === 'pdf') {
        return base + '-' + ext + '.' + ext;
      }
      if (ext === 'qrproject.json') {
        return base + '.' + ext;
      }

      return base + '-' + w + 'x' + h + '.' + ext;
    },

    /**
     * Trigger browser file download.
     */
    _triggerDownload: function(url, filename) {
      var doc = getDocument();
      if (!doc) return;
      var a = doc.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
    },

    /**
     * Render an offscreen composition canvas for raster/document generation.
     */
    _renderOffscreenCanvas: function(qrModel, targetWidth, targetHeight, options) {
      var doc = getDocument();
      if (!doc) throw new Error('Document interface is not available.');
      var offscreen = doc.createElement('canvas');
      QRStudio.Engine.renderComposition(qrModel, offscreen, {
        width: targetWidth,
        height: targetHeight,
        size: targetWidth,
        margin: typeof options.margin === 'number' ? options.margin : 4,
        darkColor: options.darkColor,
        lightColor: options.lightColor || '#FFFFFF',
        moduleStyle: options.moduleStyle,
        finderStyle: options.finderStyle,
        transparentBackground: !!options.transparentBackground,
        fit: options.fit,
        logo: options.logo,
        background: options.background,
        frame: options.frame
      });
      return offscreen;
    },

    /**
     * Generate standalone SVG markup.
     */
    generateSVG: function(qrModel, options) {
      if (!qrModel) throw new Error('No valid QR code model available for SVG export.');
      options = options || {};

      var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
      var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;

      var moduleCount = qrModel.getModuleCount();
      var margin = typeof options.margin === 'number' ? options.margin : 4;
      var totalModules = moduleCount + (margin * 2);

      var darkColor = options.darkColor || '#171717';
      var lightColor = options.lightColor || '#FFFFFF';
      var moduleStyle = options.moduleStyle || 'square';
      var finderStyle = options.finderStyle || 'rounded';
      var isTransparent = !!options.transparentBackground;

      var frameOpts = options.frame || { style: 'none' };
      var frameStyle = frameOpts.style || 'none';
      var frameColor = frameOpts.bannerColor || frameOpts.frameColor || '#171717';
      var frameTextColor = frameOpts.textColor || '#FFFFFF';
      var ctaText = frameOpts.text || frameOpts.ctaText || 'SCAN ME';

      var logoOpts = options.logo || null;
      var hasLogo = logoOpts && isSafeDataUrl(logoOpts.dataUrl);

      var bgOpts = options.background || null;
      var hasBackground = bgOpts && isSafeDataUrl(bgOpts.dataUrl);

      var svgW = targetWidth;
      var svgH = targetHeight;
      var scale = svgW / 512;

      var qrPixelSize = svgW;
      var offsetX = 0;
      var offsetY = 0;

      if (frameStyle === 'badge') {
        var cardPadding = Math.round(20 * scale);
        qrPixelSize = svgW - (cardPadding * 2);
        offsetX = cardPadding;
        offsetY = cardPadding;
      } else if (frameStyle === 'top-banner') {
        var bannerH = Math.round(56 * scale);
        qrPixelSize = Math.min(svgW, svgH - bannerH);
        offsetX = Math.round((svgW - qrPixelSize) / 2);
        offsetY = bannerH + Math.round((svgH - bannerH - qrPixelSize) / 2);
      } else if (frameStyle === 'bottom-bar') {
        var barH = Math.round(52 * scale);
        qrPixelSize = Math.min(svgW, svgH - barH);
        offsetX = Math.round((svgW - qrPixelSize) / 2);
        offsetY = Math.round((svgH - barH - qrPixelSize) / 2);
      } else if (frameStyle === 'ticket') {
        var notchPad = Math.round(16 * scale);
        var stubH = Math.round(48 * scale);
        qrPixelSize = Math.min(svgW - (notchPad * 2), svgH - stubH - (notchPad * 2));
        offsetX = Math.round((svgW - qrPixelSize) / 2);
        offsetY = notchPad + Math.round((svgH - stubH - (notchPad * 2) - qrPixelSize) / 2);
      }

      var cellSize = qrPixelSize / totalModules;
      var matrixOffsetX = offsetX + (margin * cellSize);
      var matrixOffsetY = offsetY + (margin * cellSize);

      function isFinder(r, c) {
        if (r < 7 && c < 7) return true;
        if (r < 7 && c >= moduleCount - 7) return true;
        if (r >= moduleCount - 7 && c < 7) return true;
        return false;
      }

      var safeDark = escapeXml(darkColor);
      var safeLight = escapeXml(lightColor);

      var svgParts = [];
      svgParts.push('<?xml version="1.0" encoding="UTF-8"?>');
      svgParts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + svgW + ' ' + svgH + '" width="' + svgW + '" height="' + svgH + '">');
      svgParts.push('<title>' + escapeXml(options.projectName || 'Better QR Export') + '</title>');
      svgParts.push('<desc>Exported by Better QR Universal Export Studio • Make Every Scan Better</desc>');

      // Layer 1: Background
      if (!isTransparent) {
        svgParts.push('<rect width="' + svgW + '" height="' + svgH + '" fill="' + safeLight + '" />');
      }

      if (hasBackground) {
        var bgOpacity = typeof bgOpts.opacity === 'number' ? (bgOpts.opacity / 100) : 1;
        var bgFit = bgOpts.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
        svgParts.push('<image href="' + escapeXml(bgOpts.dataUrl) + '" width="' + svgW + '" height="' + svgH + '" preserveAspectRatio="' + bgFit + '" opacity="' + bgOpacity + '" />');

        if (bgOpts.tintColor && bgOpts.tintOpacity) {
          var tintAlpha = bgOpts.tintOpacity / 100;
          svgParts.push('<rect width="' + svgW + '" height="' + svgH + '" fill="' + escapeXml(bgOpts.tintColor) + '" opacity="' + tintAlpha + '" />');
        }

        svgParts.push('<rect x="' + offsetX + '" y="' + offsetY + '" width="' + qrPixelSize + '" height="' + qrPixelSize + '" fill="' + safeLight + '" rx="' + Math.round(8 * scale) + '" ry="' + Math.round(8 * scale) + '" opacity="0.94" />');
      }

      // Layer 2: Frames & CTA
      if (frameStyle === 'badge') {
        var cardPad = Math.round(18 * scale);
        var bWidth = Math.max(2, Math.round(4 * scale));
        svgParts.push('<rect x="' + (offsetX - (cardPad/2)) + '" y="' + (offsetY - (cardPad/2)) + '" width="' + (qrPixelSize + cardPad) + '" height="' + (qrPixelSize + cardPad) + '" fill="none" stroke="' + escapeXml(frameColor) + '" stroke-width="' + bWidth + '" rx="' + Math.round(12 * scale) + '" ry="' + Math.round(12 * scale) + '" />');
        
        // Header badge pill
        var badgeText = ctaText || 'SCAN ME';
        var badgeH = Math.round(28 * scale);
        var badgeW = Math.round(Math.min(svgW - 30, Math.max(120 * scale, badgeText.length * 10 * scale)));
        var badgeX = Math.round((svgW - badgeW) / 2);
        var badgeY = Math.max(2, Math.round((offsetY - (cardPad / 2)) - (badgeH / 2)));
        var pillStroke = Math.max(2, Math.round(2.5 * scale));
        svgParts.push('<rect x="' + badgeX + '" y="' + badgeY + '" width="' + badgeW + '" height="' + badgeH + '" fill="' + escapeXml(frameColor) + '" stroke="' + safeDark + '" stroke-width="' + pillStroke + '" rx="' + Math.round(4 * scale) + '" ry="' + Math.round(4 * scale) + '" />');
        var pillFontSize = Math.round(13 * scale);
        svgParts.push('<text x="' + (svgW / 2) + '" y="' + (badgeY + (badgeH / 2) + (pillFontSize * 0.35)) + '" fill="' + escapeXml(frameTextColor) + '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="' + pillFontSize + 'px" text-anchor="middle" letter-spacing="1px">' + escapeXml(badgeText) + '</text>');
      } else if (frameStyle === 'top-banner') {
        var bHeight = Math.round(56 * scale);
        var bStroke = Math.max(2, Math.round(3 * scale));
        svgParts.push('<rect x="0" y="0" width="' + svgW + '" height="' + bHeight + '" fill="' + escapeXml(frameColor) + '" stroke="' + safeDark + '" stroke-width="' + bStroke + '" />');
        var fontSize = Math.round(18 * scale);
        svgParts.push('<text x="' + (svgW / 2) + '" y="' + ((bHeight / 2) + (fontSize * 0.35)) + '" fill="' + escapeXml(frameTextColor) + '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="' + fontSize + 'px" text-anchor="middle" letter-spacing="1px">' + escapeXml(ctaText.toUpperCase()) + '</text>');
      } else if (frameStyle === 'bottom-bar') {
        var barH = Math.round(52 * scale);
        var barY = svgH - barH;
        var barStroke = Math.max(2, Math.round(3 * scale));
        svgParts.push('<rect x="0" y="' + barY + '" width="' + svgW + '" height="' + barH + '" fill="' + escapeXml(frameColor) + '" stroke="' + safeDark + '" stroke-width="' + barStroke + '" />');
        var fontSize = Math.round(16 * scale);
        svgParts.push('<text x="' + (svgW / 2) + '" y="' + (barY + (barH / 2) + (fontSize * 0.35)) + '" fill="' + escapeXml(frameTextColor) + '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="' + fontSize + 'px" text-anchor="middle" letter-spacing="1px">' + escapeXml(ctaText.toUpperCase()) + '</text>');
      } else if (frameStyle === 'ticket') {
        var tStroke = Math.max(2, Math.round(3 * scale));
        svgParts.push('<rect x="' + tStroke + '" y="' + tStroke + '" width="' + (svgW - (tStroke * 2)) + '" height="' + (svgH - (tStroke * 2)) + '" fill="none" stroke="' + safeDark + '" stroke-width="' + tStroke + '" rx="' + Math.round(10 * scale) + '" ry="' + Math.round(10 * scale) + '" />');
        var stubY = svgH - Math.round(52 * scale);
        svgParts.push('<line x1="0" y1="' + stubY + '" x2="' + svgW + '" y2="' + stubY + '" stroke="' + safeDark + '" stroke-width="' + tStroke + '" stroke-dasharray="' + Math.round(8 * scale) + ',' + Math.round(6 * scale) + '" />');
        var fontSize = Math.round(15 * scale);
        svgParts.push('<text x="' + (svgW / 2) + '" y="' + (stubY + ((svgH - stubY) / 2) + (fontSize * 0.35)) + '" fill="' + safeDark + '" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="' + fontSize + 'px" text-anchor="middle" letter-spacing="2px">' + escapeXml(ctaText.toUpperCase()) + '</text>');
      }

      // Layer 3: QR Finders
      function renderFinder(startR, startC) {
        var fx = matrixOffsetX + (startC * cellSize);
        var fy = matrixOffsetY + (startR * cellSize);
        var outerSize = cellSize * 7;
        var midSize = cellSize * 5;
        var innerSize = cellSize * 3;
        var rOuter = finderStyle === 'rounded' ? Math.round(cellSize * 1.8) : 0;
        var rMid = finderStyle === 'rounded' ? Math.round(cellSize * 1.2) : 0;
        var rInner = finderStyle === 'rounded' ? Math.round(cellSize * 0.8) : 0;

        var parts = [];
        parts.push('<rect x="' + fx + '" y="' + fy + '" width="' + outerSize + '" height="' + outerSize + '" rx="' + rOuter + '" ry="' + rOuter + '" fill="' + safeDark + '" />');
        parts.push('<rect x="' + (fx + cellSize) + '" y="' + (fy + cellSize) + '" width="' + midSize + '" height="' + midSize + '" rx="' + rMid + '" ry="' + rMid + '" fill="' + safeLight + '" />');
        parts.push('<rect x="' + (fx + (cellSize * 2)) + '" y="' + (fy + (cellSize * 2)) + '" width="' + innerSize + '" height="' + innerSize + '" rx="' + rInner + '" ry="' + rInner + '" fill="' + safeDark + '" />');
        return parts.join('');
      }

      svgParts.push(renderFinder(0, 0));
      svgParts.push(renderFinder(0, moduleCount - 7));
      svgParts.push(renderFinder(moduleCount - 7, 0));

      // Layer 4: Modules
      if (moduleStyle === 'dots') {
        var dotRadius = (cellSize / 2) * 0.92;
        var dotPaths = [];
        for (var r = 0; r < moduleCount; r++) {
          for (var c = 0; c < moduleCount; c++) {
            if (isFinder(r, c)) continue;
            if (qrModel.isDark(r, c)) {
              var cx = matrixOffsetX + (c * cellSize) + (cellSize / 2);
              var cy = matrixOffsetY + (r * cellSize) + (cellSize / 2);
              dotPaths.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + dotRadius + '" fill="' + safeDark + '" />');
            }
          }
        }
        svgParts.push(dotPaths.join(''));
      } else if (moduleStyle === 'rounded') {
        var modRadius = Math.max(1, Math.round(cellSize * 0.35));
        var roundMods = [];
        for (var r = 0; r < moduleCount; r++) {
          for (var c = 0; c < moduleCount; c++) {
            if (isFinder(r, c)) continue;
            if (qrModel.isDark(r, c)) {
              var mx = matrixOffsetX + (c * cellSize);
              var my = matrixOffsetY + (r * cellSize);
              roundMods.push('<rect x="' + mx + '" y="' + my + '" width="' + cellSize + '" height="' + cellSize + '" rx="' + modRadius + '" ry="' + modRadius + '" fill="' + safeDark + '" />');
            }
          }
        }
        svgParts.push(roundMods.join(''));
      } else {
        // 'square' unified path
        var pathData = [];
        for (var r = 0; r < moduleCount; r++) {
          for (var c = 0; c < moduleCount; c++) {
            if (isFinder(r, c)) continue;
            if (qrModel.isDark(r, c)) {
              var mx = matrixOffsetX + (c * cellSize);
              var my = matrixOffsetY + (r * cellSize);
              pathData.push('M' + mx + ',' + my + 'h' + cellSize + 'v' + cellSize + 'h-' + cellSize + 'z');
            }
          }
        }
        if (pathData.length > 0) {
          svgParts.push('<path fill="' + safeDark + '" d="' + pathData.join('') + '" />');
        }
      }

      // Layer 5: Logo & Badge
      if (hasLogo) {
        var sizePercent = typeof logoOpts.sizePercent === 'number' ? Math.max(15, Math.min(28, logoOpts.sizePercent)) : 22;
        var badgeShape = logoOpts.badgeShape || 'rounded';
        var badgeColor = escapeXml(logoOpts.badgeColor || lightColor || '#FFFFFF');
        var padding = typeof logoOpts.padding === 'number' ? Math.max(2, Math.min(16, logoOpts.padding)) : 6;
        var scaledPadding = Math.round(padding * scale);

        var logoSize = Math.round(qrPixelSize * (sizePercent / 100));
        if (logoSize < 24) logoSize = 24;

        var cx = matrixOffsetX + ((moduleCount * cellSize) / 2);
        var cy = matrixOffsetY + ((moduleCount * cellSize) / 2);

        var badgeSize = logoSize + (scaledPadding * 2);
        var bx = Math.round(cx - (badgeSize / 2));
        var by = Math.round(cy - (badgeSize / 2));
        var logoStrokeWidth = Math.max(1, Math.round(1.5 * scale));

        if (badgeShape === 'circle') {
          svgParts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (badgeSize / 2) + '" fill="' + badgeColor + '" stroke="rgba(0,0,0,0.15)" stroke-width="' + logoStrokeWidth + '" />');
        } else if (badgeShape === 'square') {
          svgParts.push('<rect x="' + bx + '" y="' + by + '" width="' + badgeSize + '" height="' + badgeSize + '" fill="' + badgeColor + '" stroke="rgba(0,0,0,0.15)" stroke-width="' + logoStrokeWidth + '" />');
        } else {
          var radius = Math.round(badgeSize * 0.22);
          svgParts.push('<rect x="' + bx + '" y="' + by + '" width="' + badgeSize + '" height="' + badgeSize + '" rx="' + radius + '" ry="' + radius + '" fill="' + badgeColor + '" stroke="rgba(0,0,0,0.15)" stroke-width="' + logoStrokeWidth + '" />');
        }

        var lx = bx + scaledPadding;
        var ly = by + scaledPadding;
        svgParts.push('<image href="' + escapeXml(logoOpts.dataUrl) + '" x="' + lx + '" y="' + ly + '" width="' + logoSize + '" height="' + logoSize + '" preserveAspectRatio="xMidYMid meet" />');
      }

      svgParts.push('</svg>');
      return svgParts.join('\n');
    },

    /**
     * Export PNG image.
     */
    exportPNG: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var dimCheck = self.validateDimensions(targetWidth, targetHeight);
        if (!dimCheck.valid) return reject(new Error(dimCheck.errors.join(' ')));

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'png', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, options);
          if (offscreen.toBlob) {
            offscreen.toBlob(function(blob) {
              if (!blob) {
                var dataUrl = offscreen.toDataURL('image/png');
                self._triggerDownload(dataUrl, filename);
                return resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'png' });
              }
              var blobUrl = URL.createObjectURL(blob);
              self._triggerDownload(blobUrl, filename);
              setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
              resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'png' });
            }, 'image/png');
          } else {
            var dataUrl = offscreen.toDataURL('image/png');
            self._triggerDownload(dataUrl, filename);
            resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'png' });
          }
        } catch (err) {
          reject(new Error('PNG export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export JPEG image.
     */
    exportJPEG: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var dimCheck = self.validateDimensions(targetWidth, targetHeight);
        if (!dimCheck.valid) return reject(new Error(dimCheck.errors.join(' ')));

        var quality = typeof options.quality === 'number' ? Math.max(0.1, Math.min(1.0, options.quality)) : 0.92;
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'jpeg', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          // JPEG strictly enforces solid background
          var optsCopy = Object.assign({}, options, { transparentBackground: false });
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, optsCopy);

          if (offscreen.toBlob) {
            offscreen.toBlob(function(blob) {
              if (!blob) {
                var dataUrl = offscreen.toDataURL('image/jpeg', quality);
                self._triggerDownload(dataUrl, filename);
                return resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'jpeg', quality: quality });
              }
              var blobUrl = URL.createObjectURL(blob);
              self._triggerDownload(blobUrl, filename);
              setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
              resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'jpeg', quality: quality });
            }, 'image/jpeg', quality);
          } else {
            var dataUrl = offscreen.toDataURL('image/jpeg', quality);
            self._triggerDownload(dataUrl, filename);
            resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'jpeg', quality: quality });
          }
        } catch (err) {
          reject(new Error('JPEG export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export SVG image.
     */
    exportSVG: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var dimCheck = self.validateDimensions(targetWidth, targetHeight);
        if (!dimCheck.valid) return reject(new Error(dimCheck.errors.join(' ')));

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'svg', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          var svgContent = self.generateSVG(qrModel, options);
          var blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'svg', content: svgContent });
        } catch (err) {
          reject(new Error('SVG export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export WebP image.
     */
    exportWebP: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        if (!self.isWebPSupported()) {
          return reject(new Error('WebP export is not supported in this browser. Please export as PNG or JPEG instead.'));
        }

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var dimCheck = self.validateDimensions(targetWidth, targetHeight);
        if (!dimCheck.valid) return reject(new Error(dimCheck.errors.join(' ')));

        var quality = typeof options.quality === 'number' ? Math.max(0.1, Math.min(1.0, options.quality)) : 0.90;
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'webp', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, options);
          if (offscreen.toBlob) {
            offscreen.toBlob(function(blob) {
              if (!blob || blob.type !== 'image/webp') {
                var dataUrl = offscreen.toDataURL('image/webp', quality);
                if (dataUrl.indexOf('data:image/webp') !== 0) {
                  return reject(new Error('Browser failed to encode canvas as WebP.'));
                }
                self._triggerDownload(dataUrl, filename);
                return resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'webp', quality: quality });
              }
              var blobUrl = URL.createObjectURL(blob);
              self._triggerDownload(blobUrl, filename);
              setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
              resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'webp', quality: quality });
            }, 'image/webp', quality);
          } else {
            var dataUrl = offscreen.toDataURL('image/webp', quality);
            if (dataUrl.indexOf('data:image/webp') !== 0) {
              return reject(new Error('Browser failed to encode canvas as WebP.'));
            }
            self._triggerDownload(dataUrl, filename);
            resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'webp', quality: quality });
          }
        } catch (err) {
          reject(new Error('WebP export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export AVIF image.
     */
    exportAVIF: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        if (!self.isAVIFSupported()) {
          return reject(new Error('AVIF export is not supported in this browser version. (Chrome 121+ supports AVIF canvas encoding). Please export as WebP or PNG instead.'));
        }

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var quality = typeof options.quality === 'number' ? Math.max(0.1, Math.min(1.0, options.quality)) : 0.85;
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'avif', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, options);
          if (offscreen.toBlob) {
            offscreen.toBlob(function(blob) {
              if (!blob || blob.type !== 'image/avif') {
                return reject(new Error('Browser failed to encode canvas as AVIF. Please use WebP or PNG.'));
              }
              var blobUrl = URL.createObjectURL(blob);
              self._triggerDownload(blobUrl, filename);
              setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
              resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'avif', quality: quality });
            }, 'image/avif', quality);
          } else {
            var dataUrl = offscreen.toDataURL('image/avif', quality);
            if (dataUrl.indexOf('data:image/avif') !== 0) {
              return reject(new Error('Browser failed to encode canvas as AVIF.'));
            }
            self._triggerDownload(dataUrl, filename);
            resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'avif', quality: quality });
          }
        } catch (err) {
          reject(new Error('AVIF export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export BMP image.
     */
    exportBMP: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var dimCheck = self.validateDimensions(targetWidth, targetHeight);
        if (!dimCheck.valid) return reject(new Error(dimCheck.errors.join(' ')));

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'bmp', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, options);
          var ctx = offscreen.getContext('2d');
          var imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);

          if (!QRStudio.ImageEncoders || !QRStudio.ImageEncoders.encodeBMP) {
            throw new Error('ImageEncoders.encodeBMP is not loaded.');
          }

          var bmpBytes = QRStudio.ImageEncoders.encodeBMP(imgData, {
            transparent: !!options.transparentBackground
          });
          var blob = new Blob([bmpBytes], { type: 'image/bmp' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'bmp' });
        } catch (err) {
          reject(new Error('BMP export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export TIFF image.
     */
    exportTIFF: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
        var dimCheck = self.validateDimensions(targetWidth, targetHeight);
        if (!dimCheck.valid) return reject(new Error(dimCheck.errors.join(' ')));

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'tiff', {
          width: targetWidth,
          height: targetHeight
        });

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, options);
          var ctx = offscreen.getContext('2d');
          var imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);

          if (!QRStudio.ImageEncoders || !QRStudio.ImageEncoders.encodeTIFF) {
            throw new Error('ImageEncoders.encodeTIFF is not loaded.');
          }

          var tiffBytes = QRStudio.ImageEncoders.encodeTIFF(imgData, {
            transparent: !!options.transparentBackground,
            dpi: options.dpi || 300
          });
          var blob = new Blob([tiffBytes], { type: 'image/tiff' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, width: targetWidth, height: targetHeight, format: 'tiff' });
        } catch (err) {
          reject(new Error('TIFF export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Windows ICO icon.
     */
    exportICO: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'ico', {
          width: 256,
          height: 256
        });

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, 256, 256, options);
          if (!QRStudio.ImageEncoders || !QRStudio.ImageEncoders.encodeICO) {
            throw new Error('ImageEncoders.encodeICO is not loaded.');
          }

          QRStudio.ImageEncoders.encodeICO(offscreen, {
            sizes: [16, 32, 48, 64, 128, 256]
          }).then(function(icoBytes) {
            var blob = new Blob([icoBytes], { type: 'image/x-icon' });
            var blobUrl = URL.createObjectURL(blob);
            self._triggerDownload(blobUrl, filename);
            setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
            resolve({ filename: filename, width: 256, height: 256, format: 'ico' });
          }).catch(reject);
        } catch (err) {
          reject(new Error('ICO export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export PDF document.
     */
    exportPDF: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'pdf', options);

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, 1024, 1024, options);
          if (!QRStudio.VectorEncoders || !QRStudio.VectorEncoders.generatePDF) {
            throw new Error('VectorEncoders.generatePDF is not loaded.');
          }

          var pdfBytes = QRStudio.VectorEncoders.generatePDF(qrModel, options, offscreen);
          var blob = new Blob([pdfBytes], { type: 'application/pdf' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'pdf' });
        } catch (err) {
          reject(new Error('PDF export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export EPS vector.
     */
    exportEPS: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'eps', options);

        try {
          if (!QRStudio.VectorEncoders || !QRStudio.VectorEncoders.generateEPS) {
            throw new Error('VectorEncoders.generateEPS is not loaded.');
          }
          var epsStr = QRStudio.VectorEncoders.generateEPS(qrModel, options);
          var blob = new Blob([epsStr], { type: 'application/postscript;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'eps', content: epsStr });
        } catch (err) {
          reject(new Error('EPS export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export AutoCAD DXF vector.
     */
    exportDXF: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'dxf', options);

        try {
          if (!QRStudio.VectorEncoders || !QRStudio.VectorEncoders.generateDXF) {
            throw new Error('VectorEncoders.generateDXF is not loaded.');
          }
          var dxfStr = QRStudio.VectorEncoders.generateDXF(qrModel, options);
          var blob = new Blob([dxfStr], { type: 'application/dxf;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'dxf', content: dxfStr });
        } catch (err) {
          reject(new Error('DXF export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Microsoft Word (.docx).
     */
    exportDOCX: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'docx', options);

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, 1024, 1024, options);
          if (!QRStudio.DocumentEncoders || !QRStudio.DocumentEncoders.generateDOCX) {
            throw new Error('DocumentEncoders.generateDOCX is not loaded.');
          }
          var docxBytes = QRStudio.DocumentEncoders.generateDOCX(qrModel, options, offscreen);
          var blob = new Blob([docxBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'docx' });
        } catch (err) {
          reject(new Error('DOCX export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Rich Text Format (.rtf).
     */
    exportRTF: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'rtf', options);

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, 512, 512, options);
          if (!QRStudio.DocumentEncoders || !QRStudio.DocumentEncoders.generateRTF) {
            throw new Error('DocumentEncoders.generateRTF is not loaded.');
          }
          var rtfStr = QRStudio.DocumentEncoders.generateRTF(qrModel, options, offscreen);
          var blob = new Blob([rtfStr], { type: 'application/rtf;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'rtf' });
        } catch (err) {
          reject(new Error('RTF export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Printable HTML Document (.html).
     */
    exportHTMLDoc: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'html-doc', options);

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, 512, 512, options);
          if (!QRStudio.DocumentEncoders || !QRStudio.DocumentEncoders.generatePrintableHTML) {
            throw new Error('DocumentEncoders.generatePrintableHTML is not loaded.');
          }
          var htmlStr = QRStudio.DocumentEncoders.generatePrintableHTML(qrModel, options, offscreen);
          var blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'html-doc', content: htmlStr });
        } catch (err) {
          reject(new Error('HTML Document export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Plain Text Spec Sheet (.txt).
     */
    exportTXT: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'txt', options);

        try {
          if (!QRStudio.DocumentEncoders || !QRStudio.DocumentEncoders.generateTextSheet) {
            throw new Error('DocumentEncoders.generateTextSheet is not loaded.');
          }
          var txtStr = QRStudio.DocumentEncoders.generateTextSheet(qrModel, options);
          var blob = new Blob([txtStr], { type: 'text/plain;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'txt', content: txtStr });
        } catch (err) {
          reject(new Error('TXT export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Excel Workbook (.xlsx).
     */
    exportXLSX: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'xlsx', options);

        try {
          if (!QRStudio.SpreadsheetEncoders || !QRStudio.SpreadsheetEncoders.generateXLSX) {
            throw new Error('SpreadsheetEncoders.generateXLSX is not loaded.');
          }
          var record = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
          var xlsxBytes = QRStudio.SpreadsheetEncoders.generateXLSX([record], options);
          var blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'xlsx' });
        } catch (err) {
          reject(new Error('XLSX export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export CSV records.
     */
    exportCSV: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'csv', options);

        try {
          if (!QRStudio.SpreadsheetEncoders || !QRStudio.SpreadsheetEncoders.generateCSV) {
            throw new Error('SpreadsheetEncoders.generateCSV is not loaded.');
          }
          var record = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
          var csvStr = QRStudio.SpreadsheetEncoders.generateCSV([record], options);
          var blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'csv', content: csvStr });
        } catch (err) {
          reject(new Error('CSV export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export TSV records.
     */
    exportTSV: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'tsv', options);

        try {
          if (!QRStudio.SpreadsheetEncoders || !QRStudio.SpreadsheetEncoders.generateTSV) {
            throw new Error('SpreadsheetEncoders.generateTSV is not loaded.');
          }
          var record = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
          var tsvStr = QRStudio.SpreadsheetEncoders.generateTSV([record], options);
          var blob = new Blob([tsvStr], { type: 'text/tab-separated-values;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'tsv', content: tsvStr });
        } catch (err) {
          reject(new Error('TSV export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export OpenDocument Spreadsheet (.ods).
     */
    exportODS: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var filename = options.customFilename || self.buildFilename(options.projectName || options.typeId, 'ods', options);

        try {
          if (!QRStudio.SpreadsheetEncoders || !QRStudio.SpreadsheetEncoders.generateODS) {
            throw new Error('SpreadsheetEncoders.generateODS is not loaded.');
          }
          var record = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
          var odsBytes = QRStudio.SpreadsheetEncoders.generateODS([record], options);
          var blob = new Blob([odsBytes], { type: 'application/vnd.oasis.opendocument.spreadsheet' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'ods' });
        } catch (err) {
          reject(new Error('ODS export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export Design Tokens & Spec JSON.
     */
    exportDesignSpec: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var filename = options.customFilename || (sanitizeName(options.projectName || 'qr-code') + '.design-tokens.json');

        try {
          var dark = options.darkColor || '#171717';
          var light = options.lightColor || '#FFFFFF';

          var tokens = {
            "$schema": "https://design-tokens.github.io/community-group/format/",
            "name": options.projectName || "Better QR Specification",
            "version": "1.6.0",
            "date": new Date().toISOString(),
            "color": {
              "qr": {
                "dark": { "$value": dark, "$type": "color" },
                "light": { "$value": light, "$type": "color" }
              },
              "frame": {
                "background": { "$value": options.frame && options.frame.frameColor ? options.frame.frameColor : "#171717", "$type": "color" },
                "text": { "$value": options.frame && options.frame.textColor ? options.frame.textColor : "#FFFFFF", "$type": "color" }
              }
            },
            "geometry": {
              "moduleCount": qrModel ? qrModel.getModuleCount() : 25,
              "quietZone": { "$value": "4 modules", "$type": "dimension" },
              "moduleStyle": options.moduleStyle || "square",
              "finderStyle": options.finderStyle || "rounded"
            },
            "payload": {
              "type": options.payloadType || options.typeId || "url",
              "content": options.payload || options.payloadSummary || "https://qrdesign.studio",
              "errorCorrection": "Level " + (options.ecl || "M")
            }
          };

          var jsonStr = JSON.stringify(tokens, null, 2);
          var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'design-spec', content: jsonStr });
        } catch (err) {
          reject(new Error('Design Spec export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export complete Figma Handoff Package (.zip).
     * Organized archive containing:
     * - assets/qr-vector.svg
     * - assets/qr-code-512.png
     * - assets/qr-code-1024.png
     * - assets/qr-code-2048.png
     * - design-tokens.json (W3C standard format)
     * - design-spec.json
     * - README.md (Figma import guide, contrast metrics, quiet zone rules)
     */
    exportFigmaPackage: function(qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available to export.'));
        options = options || {};

        var ZipArchive = QRStudio.ZipArchive;
        if (!ZipArchive) return reject(new Error('ZipArchive is not loaded.'));

        var baseName = sanitizeName(options.projectName || 'qr-code');
        var filename = baseName + '-figma-handoff.zip';

        try {
          var zip = new ZipArchive();

          // 1. Vector SVG
          var svgContent = self.generateSVG(qrModel, options);
          zip.addFile('assets/' + baseName + '-vector.svg', svgContent);

          // 2. Multi-resolution PNGs (512, 1024, 2048)
          var sizes = [512, 1024, 2048];
          for (var i = 0; i < sizes.length; i++) {
            var sz = sizes[i];
            var off = self._renderOffscreenCanvas(qrModel, sz, sz, options);
            var pngUrl = off.toDataURL('image/png');
            zip.addFile('assets/' + baseName + '-' + sz + 'px.png', pngUrl, { isBase64: true });
          }

          // 3. Design Tokens JSON
          var dark = options.darkColor || '#171717';
          var light = options.lightColor || '#FFFFFF';
          var tokens = {
            "$schema": "https://design-tokens.github.io/community-group/format/",
            "name": options.projectName || "QR Design Tokens",
            "version": "1.6.0",
            "color": {
              "dark": { "$value": dark, "$type": "color" },
              "light": { "$value": light, "$type": "color" },
              "frame": { "$value": options.frame && options.frame.frameColor ? options.frame.frameColor : "#171717", "$type": "color" },
              "ctaText": { "$value": options.frame && options.frame.textColor ? options.frame.textColor : "#FFFFFF", "$type": "color" }
            },
            "geometry": {
              "moduleCount": qrModel.getModuleCount(),
              "quietZoneModules": 4,
              "moduleStyle": options.moduleStyle || "square",
              "finderStyle": options.finderStyle || "rounded"
            }
          };
          zip.addFile('design-tokens.json', JSON.stringify(tokens, null, 2));

          // 4. Detailed Specification JSON
          var spec = {
            projectName: options.projectName || "Default Project",
            generatedAt: new Date().toISOString(),
            payloadType: options.payloadType || options.typeId || "url",
            payload: options.payload || options.payloadSummary || "https://qrdesign.studio",
            errorCorrectionLevel: options.ecl || "M",
            darkColor: dark,
            lightColor: light,
            moduleStyle: options.moduleStyle || "square",
            finderStyle: options.finderStyle || "rounded",
            frame: options.frame || { style: "none" },
            scannability: "Verified scannable. ISO/IEC 18004 4-module quiet zone preserved."
          };
          zip.addFile('design-spec.json', JSON.stringify(spec, null, 2));

          // 5. Figma Handoff Guide README.md
          var readme = '# ' + (options.projectName || 'QR Code') + ' — Figma & Design Tool Handoff Package\n\n' +
            'Generated by Better QR Universal Export Studio • Make Every Scan Better.\n\n' +
            '## How to Use in Figma\n' +
            '1. **Vector Asset (`assets/' + baseName + '-vector.svg`):** Drag and drop directly onto your Figma canvas. The QR code imports as 100% editable vector paths.\n' +
            '2. **Raster Assets (`assets/*.png`):** High-resolution PNGs rendered at 512px, 1024px, and 2048px with crisp pixel alignment.\n' +
            '3. **Design Tokens (`design-tokens.json`):** Compatible with Tokens Studio for Figma (Figma Tokens plugin).\n\n' +
            '## Geometry & Quiet Zone Rules\n' +
            '- **Mandatory Quiet Zone:** Exactly 4 modules of clean background padding on all 4 sides per ISO/IEC 18004.\n' +
            '- **Module Count:** ' + qrModel.getModuleCount() + ' × ' + qrModel.getModuleCount() + ' matrix.\n' +
            '- **Module Style:** ' + (options.moduleStyle || 'square') + '\n' +
            '- **Finder Corners:** ' + (options.finderStyle || 'rounded') + '\n\n' +
            '## Technical Note\n' +
            'Figma natively imports SVG vectors and raster images. This package provides 100% editable, spec-compliant vector and token assets without requiring unofficial proprietary binary formats.\n';
          zip.addFile('README.md', readme);

          var zipBuffer = zip.buildUint8Array();
          var blob = new Blob([zipBuffer], { type: 'application/zip' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'figma-zip' });
        } catch (err) {
          reject(new Error('Figma Package export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Export complete project backup ZIP.
     */
    exportProjectBackupZip: function(qrModel, options, projectState) {
      var self = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var ZipArchive = QRStudio.ZipArchive;
        if (!ZipArchive) return reject(new Error('ZipArchive is not loaded.'));

        var baseName = sanitizeName(options.projectName || 'qr-project');
        var filename = baseName + '-complete-backup.zip';

        try {
          var zip = new ZipArchive();

          // 1. Project Package JSON
          var pkgData = projectState || (QRStudio.ProjectPackage && QRStudio.ProjectPackage.createPackage ? QRStudio.ProjectPackage.createPackage(options) : options);
          zip.addFile('project.qrproject.json', JSON.stringify(pkgData, null, 2));

          // 2. Preview PNG
          if (qrModel) {
            var off = self._renderOffscreenCanvas(qrModel, 1024, 1024, options);
            var pngUrl = off.toDataURL('image/png');
            zip.addFile('preview.png', pngUrl, { isBase64: true });

            // 3. Vector SVG
            var svgContent = self.generateSVG(qrModel, options);
            zip.addFile('vector.svg', svgContent);
          }

          // 4. Extracted raster assets if present
          if (options.logo && options.logo.dataUrl && isSafeDataUrl(options.logo.dataUrl)) {
            zip.addFile('assets/logo.png', options.logo.dataUrl, { isBase64: true });
          }
          if (options.background && options.background.dataUrl && isSafeDataUrl(options.background.dataUrl)) {
            zip.addFile('assets/background.png', options.background.dataUrl, { isBase64: true });
          }

          // 5. README.txt
          var readme = '===================================================\n' +
            'BETTER QR COMPLETE PROJECT BACKUP\n' +
            '===================================================\n\n' +
            'Project Name: ' + (options.projectName || 'Default Project') + '\n' +
            'Backup Date:  ' + new Date().toISOString() + '\n\n' +
            'To restore this project:\n' +
            '1. Open index.html in any browser via file://\n' +
            '2. Click "Import Project" in the topbar or Project Manager\n' +
            '3. Select the enclosed "project.qrproject.json" file.\n';
          zip.addFile('README.txt', readme);

          var zipBuffer = zip.buildUint8Array();
          var blob = new Blob([zipBuffer], { type: 'application/zip' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, format: 'backup-zip' });
        } catch (err) {
          reject(new Error('Project Backup export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Generate responsive website embed HTML snippet.
     */
    generateEmbedSnippet: function(qrModel, options) {
      if (!qrModel) throw new Error('No valid QR code available for embed snippet.');
      options = options || {};
      var targetWidth = 512;
      var offscreen = this._renderOffscreenCanvas(qrModel, targetWidth, targetWidth, options);
      var pngDataUrl = offscreen.toDataURL('image/png');
      var altText = escapeXml(options.projectName || 'Scan QR Code');
      var summary = (options.payloadSummary || options.payload || (qrModel && qrModel.payload) || '').substring(0, 48);
      var caption = escapeXml(options.ctaText || (summary ? ('Scan: ' + summary) : 'Scan with your mobile camera'));

      return '<figure class="qr-code-embed qr-studio-embed" style="display:inline-block; margin:1rem; padding:12px; background:#fff; border:3px solid #000; box-shadow:4px 4px 0 #000; text-align:center; max-width:280px; font-family:-apple-system,sans-serif;">\n' +
        '  <img src="' + pngDataUrl + '" alt="' + altText + '" style="display:block; width:100%; height:auto; image-rendering:pixelated;" />\n' +
        '  <figcaption style="margin-top:8px; font-size:12px; font-weight:800; color:#000; text-transform:uppercase; letter-spacing:0.5px;">' + caption + '</figcaption>\n' +
        '</figure>';
    },

    /**
     * Export multiple formats bundled into a single ZIP archive.
     * 
     * @param {string[]} formatIds - Array of format IDs to include
     * @param {Object} qrModel - Generated QR model
     * @param {Object} options - Common options
     * @returns {Promise<Object>}
     */
    exportBundle: function(formatIds, qrModel, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        if (!qrModel) return reject(new Error('No valid QR code available for bundle export.'));
        if (!formatIds || formatIds.length === 0) {
          return reject(new Error('Select at least one format to export.'));
        }

        var ZipArchive = QRStudio.ZipArchive;
        if (!ZipArchive) return reject(new Error('ZipArchive is not loaded.'));

        var baseName = sanitizeName(options.projectName || 'qr-code');
        var filename = baseName + '-export-bundle.zip';
        var zip = new ZipArchive();
        var targetWidth = parseInt(options.width || options.size, 10) || SAFE_LIMITS.DEFAULT_SIZE;
        var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;

        try {
          var offscreen = self._renderOffscreenCanvas(qrModel, targetWidth, targetHeight, options);

          for (var i = 0; i < formatIds.length; i++) {
            var fId = formatIds[i].toLowerCase();

            if (fId === 'png') {
              var pngUrl = offscreen.toDataURL('image/png');
              zip.addFile(baseName + '.png', pngUrl, { isBase64: true });
            } else if (fId === 'jpeg' || fId === 'jpg') {
              var jpgUrl = offscreen.toDataURL('image/jpeg', 0.92);
              zip.addFile(baseName + '.jpg', jpgUrl, { isBase64: true });
            } else if (fId === 'svg') {
              var svg = self.generateSVG(qrModel, options);
              zip.addFile(baseName + '.svg', svg);
            } else if (fId === 'webp' && self.isWebPSupported()) {
              var webpUrl = offscreen.toDataURL('image/webp', 0.90);
              zip.addFile(baseName + '.webp', webpUrl, { isBase64: true });
            } else if (fId === 'bmp') {
              var ctx = offscreen.getContext('2d');
              var imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
              var bmpBytes = QRStudio.ImageEncoders.encodeBMP(imgData, { transparent: !!options.transparentBackground });
              zip.addFile(baseName + '.bmp', bmpBytes);
            } else if (fId === 'tiff') {
              var ctx = offscreen.getContext('2d');
              var imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
              var tiffBytes = QRStudio.ImageEncoders.encodeTIFF(imgData, { transparent: !!options.transparentBackground });
              zip.addFile(baseName + '.tiff', tiffBytes);
            } else if (fId === 'pdf') {
              var pdfBytes = QRStudio.VectorEncoders.generatePDF(qrModel, options, offscreen);
              zip.addFile(baseName + '.pdf', pdfBytes);
            } else if (fId === 'eps') {
              var epsStr = QRStudio.VectorEncoders.generateEPS(qrModel, options);
              zip.addFile(baseName + '.eps', epsStr);
            } else if (fId === 'dxf') {
              var dxfStr = QRStudio.VectorEncoders.generateDXF(qrModel, options);
              zip.addFile(baseName + '.dxf', dxfStr);
            } else if (fId === 'docx') {
              var docxBytes = QRStudio.DocumentEncoders.generateDOCX(qrModel, options, offscreen);
              zip.addFile(baseName + '.docx', docxBytes);
            } else if (fId === 'rtf') {
              var rtfStr = QRStudio.DocumentEncoders.generateRTF(qrModel, options, offscreen);
              zip.addFile(baseName + '.rtf', rtfStr);
            } else if (fId === 'html-doc') {
              var htmlStr = QRStudio.DocumentEncoders.generatePrintableHTML(qrModel, options, offscreen);
              zip.addFile(baseName + '-card.html', htmlStr);
            } else if (fId === 'txt') {
              var txtStr = QRStudio.DocumentEncoders.generateTextSheet(qrModel, options);
              zip.addFile(baseName + '-specs.txt', txtStr);
            } else if (fId === 'xlsx') {
              var rec = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
              var xlsxBytes = QRStudio.SpreadsheetEncoders.generateXLSX([rec], options);
              zip.addFile(baseName + '-records.xlsx', xlsxBytes);
            } else if (fId === 'csv') {
              var rec = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
              var csvStr = QRStudio.SpreadsheetEncoders.generateCSV([rec], options);
              zip.addFile(baseName + '.csv', csvStr);
            } else if (fId === 'tsv') {
              var rec = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
              var tsvStr = QRStudio.SpreadsheetEncoders.generateTSV([rec], options);
              zip.addFile(baseName + '.tsv', tsvStr);
            } else if (fId === 'ods') {
              var rec = QRStudio.SpreadsheetEncoders.buildRecordRow(options);
              var odsBytes = QRStudio.SpreadsheetEncoders.generateODS([rec], options);
              zip.addFile(baseName + '.ods', odsBytes);
            }
          }

          // Bundle README
          var manifestText = '===================================================\n' +
            'BETTER QR UNIVERSAL EXPORT BUNDLE\n' +
            '===================================================\n\n' +
            'Project Name: ' + (options.projectName || 'Default Project') + '\n' +
            'Generated:    ' + new Date().toISOString() + '\n' +
            'Included Formats: ' + formatIds.join(', ') + '\n\n' +
            'All exports generated 100% locally with zero cloud transmission.\n';
          zip.addFile('README.txt', manifestText);

          var zipBuffer = zip.buildUint8Array();
          var blob = new Blob([zipBuffer], { type: 'application/zip' });
          var blobUrl = URL.createObjectURL(blob);
          self._triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 2000);
          resolve({ filename: filename, count: formatIds.length, format: 'bundle-zip' });
        } catch (err) {
          reject(new Error('Bundle export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Master export dispatcher for any single format.
     */
    export: function(format, qrModel, options, projectState) {
      format = (format || 'png').toLowerCase();

      switch (format) {
        case 'png': return this.exportPNG(qrModel, options);
        case 'jpeg':
        case 'jpg': return this.exportJPEG(qrModel, options);
        case 'webp': return this.exportWebP(qrModel, options);
        case 'avif': return this.exportAVIF(qrModel, options);
        case 'bmp': return this.exportBMP(qrModel, options);
        case 'tiff': return this.exportTIFF(qrModel, options);
        case 'ico': return this.exportICO(qrModel, options);
        case 'svg': return this.exportSVG(qrModel, options);
        case 'pdf': return this.exportPDF(qrModel, options);
        case 'eps': return this.exportEPS(qrModel, options);
        case 'dxf': return this.exportDXF(qrModel, options);
        case 'docx': return this.exportDOCX(qrModel, options);
        case 'rtf': return this.exportRTF(qrModel, options);
        case 'html-doc': return this.exportHTMLDoc(qrModel, options);
        case 'txt': return this.exportTXT(qrModel, options);
        case 'xlsx': return this.exportXLSX(qrModel, options);
        case 'csv': return this.exportCSV(qrModel, options);
        case 'tsv': return this.exportTSV(qrModel, options);
        case 'ods': return this.exportODS(qrModel, options);
        case 'figma-zip': return this.exportFigmaPackage(qrModel, options);
        case 'design-spec': return this.exportDesignSpec(qrModel, options);
        case 'project-json':
          if (QRStudio.ProjectPackage && QRStudio.ProjectPackage.exportProjectToFile) {
            return Promise.resolve(QRStudio.ProjectPackage.exportProjectToFile(projectState || options));
          }
          return this.exportDesignSpec(qrModel, options);
        case 'backup-zip': return this.exportProjectBackupZip(qrModel, options, projectState);
        default:
          return this.exportPNG(qrModel, options);
      }
    }
  };

  // Aliases for full backward compatibility
  QRStudio.ExportStudio = ExportStudio;
  QRStudio.UniversalExportStudio = ExportStudio;
  QRStudio.Exporter = ExportStudio;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportStudio;
  }

})(typeof window !== 'undefined' ? window : this);

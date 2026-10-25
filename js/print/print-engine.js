/**
 * QR Design Studio — Professional Print & Layout Studio Engine (V1.7)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * 
 * Provides:
 * - Standard page dimensions (A4, A3, A5, US Letter, Custom) in mm, inches, points, and pixels.
 * - 9 Reusable print layout templates (Business cards, stickers, product labels, tabletop cards, etc.).
 * - Freeform and grid-based QR placement, alignment, distribution, and duplication.
 * - Sheet and label calculation, auto-fit, and overflow detection.
 * - Real-time safety validation (clipping, page overflow, <20mm scanability warning, contrast).
 * - Multi-DPI raster rendering (150 DPI draft, 300 DPI press).
 * - Print-ready vector SVG generator (in mm).
 * - Genuine PDF 1.4 multi-item / sheet document builder with exact MediaBox points and crop marks.
 * - Layout configuration JSON export and import.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  // Unit conversion constants
  var MM_TO_INCH = 1 / 25.4;        // ~0.03937007874
  var INCH_TO_MM = 25.4;
  var MM_TO_PT = 72 / 25.4;          // ~2.83464567 (PostScript / PDF points)
  var PT_TO_MM = 25.4 / 72;          // ~0.35277778
  var MIN_SCAN_SIZE_MM = 20;         // Standard minimum physical QR size for phone scanning

  // Standard Page Sizes in Millimeters (Portrait)
  var PAGE_SIZES = {
    a4: { id: 'a4', name: 'A4', width: 210, height: 297, unit: 'mm' },
    a3: { id: 'a3', name: 'A3', width: 297, height: 420, unit: 'mm' },
    a5: { id: 'a5', name: 'A5', width: 148, height: 210, unit: 'mm' },
    letter: { id: 'letter', name: 'US Letter', width: 215.9, height: 279.4, unit: 'mm' }, // 8.5 x 11 in
    custom: { id: 'custom', name: 'Custom Dimensions', width: 210, height: 297, unit: 'mm' }
  };

  /**
   * Helper: Escape XML special characters.
   */
  function escapeXml(str) {
    if (str == null) return '';
    return String(str).replace(/[<>&'"]/g, function(c) {
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

  function isSafeRasterDataUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(url.trim());
  }

  /**
   * Helper: Convert Hex color (#RRGGBB) to 0.0 - 1.0 RGB components for PDF.
   */
  function hexToRgbNormalized(hex) {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var r = (parseInt(hex.substring(0, 2), 16) || 0) / 255;
    var g = (parseInt(hex.substring(2, 4), 16) || 0) / 255;
    var b = (parseInt(hex.substring(4, 6), 16) || 0) / 255;
    return {
      r: Number(r.toFixed(4)),
      g: Number(g.toFixed(4)),
      b: Number(b.toFixed(4))
    };
  }

  /**
   * Helper: Escape string for PDF syntax.
   */
  function escapePdfString(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  /**
   * Helper: Convert string to UTF-8 bytes with fallback.
   */
  function stringToUtf8Bytes(str) {
    if (QRStudio.stringToUtf8Bytes) return QRStudio.stringToUtf8Bytes(str);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return new Uint8Array(bytes);
  }

  /**
   * Helper: Convert base64 data URL to Uint8Array with fallback.
   */
  function base64ToUint8Array(base64) {
    if (QRStudio.base64ToUint8Array) return QRStudio.base64ToUint8Array(base64);
    if (typeof atob !== 'undefined') {
      var raw = base64.replace(/^data:image\/[a-z]+;base64,/, '');
      var bin = atob(raw);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    }
    return null;
  }

  /**
   * 9 Reusable Print Layout Templates Definitions
   */
  var TEMPLATES = {
    'business-cards': {
      id: 'business-cards',
      name: 'Business Cards (Grid Sheet)',
      category: 'Cards & Stationery',
      description: 'Standard 85 × 55 mm business cards arranged 2×5 on A4/Letter with title, contact info, and QR badge.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 10, bottom: 10, left: 12, right: 12 },
      gridMode: true,
      defaultGrid: {
        cols: 2,
        rows: 5,
        labelWidthMm: 85,
        labelHeightMm: 50,
        gapXMm: 10,
        gapYMm: 5,
        shape: 'rounded',
        cornerRadiusMm: 2,
        repeatCurrentQR: true
      },
      itemDefaults: {
        title: 'Alex Mercer',
        description: 'Design Director • Studio Neo',
        cta: 'CONNECT ON LINKEDIN',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'sticker-sheet': {
      id: 'sticker-sheet',
      name: 'QR Sticker Sheet',
      category: 'Stickers & Labels',
      description: 'Grid of circular or rounded sticker labels with cut lines, repeated or unique per label.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 15, bottom: 15, left: 15, right: 15 },
      gridMode: true,
      defaultGrid: {
        cols: 3,
        rows: 4,
        labelWidthMm: 55,
        labelHeightMm: 55,
        gapXMm: 7,
        gapYMm: 7,
        shape: 'rounded', // 'rounded' | 'circle' | 'square'
        cornerRadiusMm: 6,
        repeatCurrentQR: true
      },
      itemDefaults: {
        title: 'SCAN ME',
        description: '',
        cta: '',
        showTitle: true,
        showDescription: false,
        showCta: false,
        showCardBadge: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'product-labels': {
      id: 'product-labels',
      name: 'Product & Inventory Labels',
      category: 'Packaging & Retail',
      description: 'Retail & warehouse barcode/QR labels with product name, SKU, price, and scannable code.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 12, bottom: 12, left: 12, right: 12 },
      gridMode: true,
      defaultGrid: {
        cols: 3,
        rows: 6,
        labelWidthMm: 58,
        labelHeightMm: 42,
        gapXMm: 5,
        gapYMm: 4,
        shape: 'square',
        cornerRadiusMm: 0,
        repeatCurrentQR: true
      },
      itemDefaults: {
        title: 'PREMIUM ROAST COFFEE',
        description: 'SKU: PR-8942 • $14.99',
        cta: 'SCAN FOR ORIGIN STORY',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'tabletop-card': {
      id: 'tabletop-card',
      name: 'Tabletop QR Tent Card',
      category: 'Hospitality & Dining',
      description: 'Restaurant, café & bar table cards for contactless ordering, digital menus, and Wi-Fi.',
      defaultPageSize: 'a5',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 15, bottom: 15, left: 15, right: 15 },
      gridMode: false,
      singleItem: {
        widthMm: 118,
        heightMm: 180,
        qrSizeMm: 70,
        title: 'SCAN TO ORDER & PAY',
        description: 'Point your camera to browse menu & order seamlessly',
        cta: 'TABLE 14 • FREE WI-FI',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFFDF5',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'menu-sign': {
      id: 'menu-sign',
      name: 'Menu QR Display Sign',
      category: 'Hospitality & Dining',
      description: 'Elegant vertical menu display board with header banner, instructions, and large QR code.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 20, bottom: 20, left: 20, right: 20 },
      gridMode: false,
      singleItem: {
        widthMm: 170,
        heightMm: 257,
        qrSizeMm: 85,
        title: 'DISCOVER OUR FULL MENU',
        description: '1. Open camera  •  2. Scan code  •  3. Enjoy specials',
        cta: 'VIEW SEASONAL SPECIALS & DRINKS',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'packaging-insert': {
      id: 'packaging-insert',
      name: 'Product Packaging Insert',
      category: 'Packaging & Retail',
      description: 'E-commerce thank-you postcard and warranty registration card (A5 landscape).',
      defaultPageSize: 'a5',
      defaultOrientation: 'landscape',
      defaultMargins: { top: 12, bottom: 12, left: 12, right: 12 },
      gridMode: false,
      singleItem: {
        widthMm: 186,
        heightMm: 124,
        qrSizeMm: 50,
        title: 'THANK YOU FOR YOUR ORDER!',
        description: 'Scan to register your 2-year warranty & unlock VIP perks',
        cta: 'USE CODE: VIP15 FOR 15% OFF NEXT ORDER',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FBF9F5',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'event-badge': {
      id: 'event-badge',
      name: 'Conference & Event Badges',
      category: 'Events & Badges',
      description: 'Attendee badges with event header ribbon, participant name, role, and access QR.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 15, bottom: 15, left: 12, right: 12 },
      gridMode: true,
      defaultGrid: {
        cols: 2,
        rows: 2,
        labelWidthMm: 90,
        labelHeightMm: 125,
        gapXMm: 6,
        gapYMm: 10,
        shape: 'rounded',
        cornerRadiusMm: 4,
        repeatCurrentQR: true,
        hasLanyardHole: true
      },
      itemDefaults: {
        title: 'JORDAN VANCE',
        description: 'KEYNOTE SPEAKER • DESIGN SYSTEMS CORP',
        cta: 'ACCESS PASS #A-409',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'promotional-flyer': {
      id: 'promotional-flyer',
      name: 'Promotional Print Flyer',
      category: 'Marketing & Flyers',
      description: 'High-impact editorial marketing flyer with oversized QR code and prominent CTA ribbon.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 20, bottom: 20, left: 20, right: 20 },
      gridMode: false,
      singleItem: {
        widthMm: 170,
        heightMm: 257,
        qrSizeMm: 90,
        title: 'EXCLUSIVE EARLY ACCESS',
        description: 'Be the first to experience the future. Scan with your phone now.',
        cta: 'SCAN TO CLAIM VIP PASS',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFE600',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    },
    'multi-qr-sheet': {
      id: 'multi-qr-sheet',
      name: 'Multi-QR Catalog Sheet',
      category: 'Catalogs & Sheets',
      description: 'Multiple distinct QR codes arranged on a single sheet for diverse marketing purposes.',
      defaultPageSize: 'a4',
      defaultOrientation: 'portrait',
      defaultMargins: { top: 15, bottom: 15, left: 15, right: 15 },
      gridMode: true,
      defaultGrid: {
        cols: 2,
        rows: 2,
        labelWidthMm: 85,
        labelHeightMm: 120,
        gapXMm: 10,
        gapYMm: 10,
        shape: 'rounded',
        cornerRadiusMm: 3,
        repeatCurrentQR: false
      },
      distinctItems: [
        { title: 'Official Website', description: 'Explore our catalog & updates', cta: 'VISIT WEBSITE' },
        { title: 'Guest Wi-Fi', description: 'Instant one-tap connection', cta: 'CONNECT WI-FI' },
        { title: 'Support Helpdesk', description: 'Reach our team directly', cta: 'CONTACT SUPPORT' },
        { title: 'Community Discord', description: 'Join 10k+ creators & builders', cta: 'JOIN COMMUNITY' }
      ],
      itemDefaults: {
        title: 'Scan QR',
        description: 'Point phone camera',
        cta: 'VISIT',
        showTitle: true,
        showDescription: true,
        showCta: true,
        showCardBadge: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      }
    }
  };

  /**
   * Create default print studio state.
   */
  function createDefaultState() {
    return {
      pageSize: 'a4',
      customWidthMm: 210,
      customHeightMm: 297,
      orientation: 'portrait',
      marginsMm: { top: 12, bottom: 12, left: 12, right: 12 },
      pageBg: '#FFFFFF',
      showCropMarks: true,
      showCutLines: true,
      showMarginGuides: true,
      templateId: 'sticker-sheet',
      gridMode: true,
      gridConfig: {
        cols: 3,
        rows: 4,
        labelWidthMm: 55,
        labelHeightMm: 55,
        gapXMm: 7,
        gapYMm: 7,
        shape: 'rounded', // 'square', 'rounded', 'circle'
        cornerRadiusMm: 6,
        repeatCurrentQR: true,
        hasLanyardHole: false,
        cellItems: []
      },
      items: [],
      selectedItemId: null,
      zoom: 1.0,
      dpi: 300,
      fitScale: 1.0
    };
  }

  /**
   * Calculate effective page dimensions in millimeters based on page size and orientation.
   */
  function getEffectivePageDimensions(state) {
    var baseW, baseH;
    if (state.pageSize === 'custom') {
      baseW = Math.max(20, Math.min(1000, Number(state.customWidthMm) || 210));
      baseH = Math.max(20, Math.min(1000, Number(state.customHeightMm) || 297));
    } else {
      var std = PAGE_SIZES[state.pageSize] || PAGE_SIZES.a4;
      baseW = std.width;
      baseH = std.height;
    }

    if (state.orientation === 'landscape') {
      return {
        width: Math.max(baseW, baseH),
        height: Math.min(baseW, baseH)
      };
    } else {
      return {
        width: Math.min(baseW, baseH),
        height: Math.max(baseW, baseH)
      };
    }
  }

  /**
   * Grid dimensions calculation and page fit verification.
   */
  function calculateGridDimensions(state) {
    var pageDims = getEffectivePageDimensions(state);
    var pageW = pageDims.width;
    var pageH = pageDims.height;
    var margins = state.marginsMm || { top: 10, bottom: 10, left: 10, right: 10 };
    var grid = state.gridConfig || {};

    var cols = Math.max(1, parseInt(grid.cols, 10) || 1);
    var rows = Math.max(1, parseInt(grid.rows, 10) || 1);
    var labelW = Math.max(5, Number(grid.labelWidthMm) || 50);
    var labelH = Math.max(5, Number(grid.labelHeightMm) || 50);
    var gapX = Math.max(0, Number(grid.gapXMm) || 0);
    var gapY = Math.max(0, Number(grid.gapYMm) || 0);

    var gridWidth = (cols * labelW) + ((cols - 1) * gapX);
    var gridHeight = (rows * labelH) + ((rows - 1) * gapY);

    var totalRequiredWidth = margins.left + gridWidth + margins.right;
    var totalRequiredHeight = margins.top + gridHeight + margins.bottom;

    var availableWidth = Math.max(0, pageW - margins.left - margins.right);
    var availableHeight = Math.max(0, pageH - margins.top - margins.bottom);

    var overflowX = Math.max(0, totalRequiredWidth - pageW);
    var overflowY = Math.max(0, totalRequiredHeight - pageH);

    var fitsInPage = totalRequiredWidth <= pageW + 0.01 && totalRequiredHeight <= pageH + 0.01;
    var fitsInMargins = gridWidth <= availableWidth + 0.01 && gridHeight <= availableHeight + 0.01;

    return {
      cols: cols,
      rows: rows,
      totalCells: cols * rows,
      labelWidthMm: labelW,
      labelHeightMm: labelH,
      gapXMm: gapX,
      gapYMm: gapY,
      gridWidthMm: Number(gridWidth.toFixed(2)),
      gridHeightMm: Number(gridHeight.toFixed(2)),
      availableWidthMm: Number(availableWidth.toFixed(2)),
      availableHeightMm: Number(availableHeight.toFixed(2)),
      totalRequiredWidthMm: Number(totalRequiredWidth.toFixed(2)),
      totalRequiredHeightMm: Number(totalRequiredHeight.toFixed(2)),
      overflowXMm: Number(overflowX.toFixed(2)),
      overflowYMm: Number(overflowY.toFixed(2)),
      fitsInPage: fitsInPage,
      fitsInMargins: fitsInMargins,
      pageWidthMm: pageW,
      pageHeightMm: pageH
    };
  }

  /**
   * Auto-fit grid to printable area: recalculates label dimensions to perfectly fit available margins.
   */
  function autoFitGrid(state) {
    var pageDims = getEffectivePageDimensions(state);
    var margins = state.marginsMm || { top: 10, bottom: 10, left: 10, right: 10 };
    var availableW = pageDims.width - margins.left - margins.right;
    var availableH = pageDims.height - margins.top - margins.bottom;

    var grid = state.gridConfig;
    var cols = Math.max(1, parseInt(grid.cols, 10) || 1);
    var rows = Math.max(1, parseInt(grid.rows, 10) || 1);
    var gapX = Number(grid.gapXMm) || 0;
    var gapY = Number(grid.gapYMm) || 0;

    var maxLabelW = Math.max(10, Math.floor((availableW - ((cols - 1) * gapX)) / cols));
    var maxLabelH = Math.max(10, Math.floor((availableH - ((rows - 1) * gapY)) / rows));

    // If shape is circle or rounded square, keep 1:1
    if (grid.shape === 'circle' || (grid.shape === 'rounded' && Math.abs(grid.labelWidthMm - grid.labelHeightMm) < 5)) {
      var squareSize = Math.min(maxLabelW, maxLabelH);
      grid.labelWidthMm = squareSize;
      grid.labelHeightMm = squareSize;
    } else {
      grid.labelWidthMm = maxLabelW;
      grid.labelHeightMm = maxLabelH;
    }

    return calculateGridDimensions(state);
  }

  /**
   * Generate items array from grid configuration or template defaults.
   */
  function syncItemsFromGrid(state, sourceQrData) {
    var pageDims = getEffectivePageDimensions(state);
    var margins = state.marginsMm;
    var grid = state.gridConfig;
    var fitInfo = calculateGridDimensions(state);

    var items = [];
    var cellIndex = 0;
    var tmpl = TEMPLATES[state.templateId] || TEMPLATES['sticker-sheet'];

    // Center the grid within available space if it fits
    var startX = margins.left;
    var startY = margins.top;
    if (fitInfo.fitsInMargins) {
      startX = margins.left + ((fitInfo.availableWidthMm - fitInfo.gridWidthMm) / 2);
      startY = margins.top + ((fitInfo.availableHeightMm - fitInfo.gridHeightMm) / 2);
    }

    for (var r = 0; r < fitInfo.rows; r++) {
      for (var c = 0; c < fitInfo.cols; c++) {
        var x = startX + (c * (fitInfo.labelWidthMm + fitInfo.gapXMm));
        var y = startY + (r * (fitInfo.labelHeightMm + fitInfo.gapYMm));

        var cellItem = (grid.cellItems && grid.cellItems[cellIndex]) || {};
        var distinctDefault = (tmpl.distinctItems && tmpl.distinctItems[cellIndex % tmpl.distinctItems.length]) || {};
        var itemDef = Object.assign({}, tmpl.itemDefaults || {}, distinctDefault, cellItem);

        var qrSizeMm;
        if (fitInfo.labelWidthMm >= 80 && fitInfo.labelHeightMm <= 60) {
          // Horizontal business card: QR placed on right or left
          qrSizeMm = Math.min(fitInfo.labelHeightMm - 10, 36);
        } else if (fitInfo.labelHeightMm > fitInfo.labelWidthMm * 1.2) {
          // Tall card
          qrSizeMm = Math.min(fitInfo.labelWidthMm * 0.72, 60);
        } else {
          // Square or near-square
          qrSizeMm = Math.min(fitInfo.labelWidthMm * 0.65, fitInfo.labelHeightMm * 0.65);
        }

        var item = {
          id: 'grid-item-' + cellIndex,
          cellIndex: cellIndex,
          row: r,
          col: c,
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
          width: fitInfo.labelWidthMm,
          height: fitInfo.labelHeightMm,
          qrSizeMm: Number(qrSizeMm.toFixed(1)),
          shape: grid.shape || 'rounded',
          cornerRadiusMm: grid.cornerRadiusMm || 3,
          hasLanyardHole: !!grid.hasLanyardHole,
          title: itemDef.title || 'Scan Me',
          description: itemDef.description || '',
          cta: itemDef.cta || '',
          showTitle: itemDef.showTitle !== false,
          showDescription: !!itemDef.showDescription,
          showCta: !!itemDef.showCta,
          showCardBadge: itemDef.showCardBadge !== false,
          cardBg: itemDef.cardBg || '#FFFFFF',
          cardBorderColor: itemDef.cardBorderColor || '#171717',
          textColor: itemDef.textColor || '#171717',
          qrSource: grid.repeatCurrentQR ? 'current' : (itemDef.qrSource || 'current'),
          customPayload: itemDef.customPayload || null,
          cachedQrModel: null,
          cachedCanvas: null
        };

        items.push(item);
        cellIndex++;
      }
    }

    state.items = items;
    return items;
  }

  /**
   * Apply a Layout Template to state.
   */
  function applyTemplate(state, templateId, sourceQrData) {
    var tmpl = TEMPLATES[templateId];
    if (!tmpl) tmpl = TEMPLATES['sticker-sheet'];

    state.templateId = tmpl.id;
    state.pageSize = tmpl.defaultPageSize || 'a4';
    state.orientation = tmpl.defaultOrientation || 'portrait';
    state.marginsMm = Object.assign({}, tmpl.defaultMargins || { top: 12, bottom: 12, left: 12, right: 12 });
    state.gridMode = tmpl.gridMode;

    if (tmpl.gridMode) {
      state.gridConfig = Object.assign({
        repeatCurrentQR: true,
        hasLanyardHole: false,
        cellItems: []
      }, tmpl.defaultGrid);
      syncItemsFromGrid(state, sourceQrData);
    } else {
      // Freeform single poster / card template
      var pageDims = getEffectivePageDimensions(state);
      var margins = state.marginsMm;
      var single = tmpl.singleItem || {};

      var availW = pageDims.width - margins.left - margins.right;
      var availH = pageDims.height - margins.top - margins.bottom;

      var w = Math.min(availW, single.widthMm || availW);
      var h = Math.min(availH, single.heightMm || availH);
      var x = margins.left + ((availW - w) / 2);
      var y = margins.top + ((availH - h) / 2);

      state.items = [{
        id: 'item-single',
        cellIndex: 0,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        width: Number(w.toFixed(2)),
        height: Number(h.toFixed(2)),
        qrSizeMm: single.qrSizeMm || Math.min(w * 0.55, h * 0.45, 80),
        shape: 'rounded',
        cornerRadiusMm: 4,
        hasLanyardHole: false,
        title: single.title || 'Scan Me',
        description: single.description || '',
        cta: single.cta || '',
        showTitle: single.showTitle !== false,
        showDescription: !!single.showDescription,
        showCta: !!single.showCta,
        showCardBadge: single.showCardBadge !== false,
        cardBg: single.cardBg || '#FFFFFF',
        cardBorderColor: single.cardBorderColor || '#171717',
        textColor: single.textColor || '#171717',
        qrSource: 'current',
        customPayload: null
      }];
    }

    state.selectedItemId = (state.items[0] && state.items[0].id) || null;
    return state;
  }

  /**
   * Safety, Clipping & Scanability Validation.
   * Never claims high scanability if physical QR dimensions are below 20mm.
   */
  function validatePrintSafety(state) {
    var pageDims = getEffectivePageDimensions(state);
    var pageW = pageDims.width;
    var pageH = pageDims.height;
    var margins = state.marginsMm || { top: 10, bottom: 10, left: 10, right: 10 };

    var errors = [];
    var warnings = [];
    var clippedItems = [];
    var smallQrItems = [];

    // Check Grid Overflow (if grid mode is active)
    var fitInfo = calculateGridDimensions(state);
    if (state.gridMode) {
      if (!fitInfo.fitsInPage) {
        errors.push({
          type: 'PAGE_OVERFLOW',
          message: 'Grid configuration exceeds page boundaries! Required: ' + fitInfo.totalRequiredWidthMm + ' × ' + fitInfo.totalRequiredHeightMm + ' mm, Page: ' + pageW + ' × ' + pageH + ' mm.'
        });
      } else if (!fitInfo.fitsInMargins) {
        warnings.push({
          type: 'MARGIN_OVERFLOW',
          message: 'Grid extends into page margins. Check printable area guidelines.'
        });
      }
    }

    // Check individual items
    var items = state.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var right = it.x + it.width;
      var bottom = it.y + it.height;

      var isOutsidePage = (it.x < 0 || it.y < 0 || right > pageW + 0.1 || bottom > pageH + 0.1);
      var isOutsideMargin = (it.x < margins.left - 0.1 || it.y < margins.top - 0.1 || right > pageW - margins.right + 0.1 || bottom > pageH - margins.bottom + 0.1);

      if (isOutsidePage) {
        clippedItems.push({
          id: it.id,
          title: it.title || 'Item #' + (i + 1),
          reason: 'Extends outside physical page'
        });
      } else if (isOutsideMargin) {
        clippedItems.push({
          id: it.id,
          title: it.title || 'Item #' + (i + 1),
          reason: 'Extends into non-printable margin'
        });
      }

      // Scanability size check
      var effectiveQrSize = it.qrSizeMm || Math.min(it.width * 0.6, it.height * 0.6);
      if (effectiveQrSize < MIN_SCAN_SIZE_MM) {
        smallQrItems.push({
          id: it.id,
          title: it.title || 'Item #' + (i + 1),
          sizeMm: effectiveQrSize
        });
      }
    }

    if (clippedItems.length > 0) {
      warnings.push({
        type: 'ITEM_CLIPPING',
        message: clippedItems.length + ' item(s) extend beyond the safe printable area or page boundaries.',
        items: clippedItems
      });
    }

    if (smallQrItems.length > 0) {
      warnings.push({
        type: 'SMALL_QR_SCANABILITY',
        message: 'QR code physical size (' + smallQrItems[0].sizeMm + ' mm) is below recommended 20 mm (0.8 in). Test scan before mass printing.',
        items: smallQrItems
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      fitInfo: fitInfo,
      clippedItems: clippedItems,
      smallQrItems: smallQrItems,
      pageDimensions: pageDims
    };
  }

  /**
   * Item Manipulation: Align, Distribute, Duplicate, Reorder, Delete
   */
  var ItemOps = {
    align: function(state, direction) {
      var items = state.items;
      if (!items || items.length === 0) return;
      var pageDims = getEffectivePageDimensions(state);
      var margins = state.marginsMm;

      var selId = state.selectedItemId;
      var targetItems = selId ? items.filter(function(it) { return it.id === selId; }) : items;

      targetItems.forEach(function(it) {
        switch (direction) {
          case 'left':
            it.x = margins.left;
            break;
          case 'center':
            it.x = Number((margins.left + ((pageDims.width - margins.left - margins.right - it.width) / 2)).toFixed(2));
            break;
          case 'right':
            it.x = Number((pageDims.width - margins.right - it.width).toFixed(2));
            break;
          case 'top':
            it.y = margins.top;
            break;
          case 'middle':
            it.y = Number((margins.top + ((pageDims.height - margins.top - margins.bottom - it.height) / 2)).toFixed(2));
            break;
          case 'bottom':
            it.y = Number((pageDims.height - margins.bottom - it.height).toFixed(2));
            break;
        }
      });
    },

    distribute: function(state, axis) {
      var items = state.items;
      if (!items || items.length < 3) return;

      if (axis === 'horizontal') {
        var sortedX = items.slice().sort(function(a, b) { return a.x - b.x; });
        var minX = sortedX[0].x;
        var last = sortedX[sortedX.length - 1];
        var maxX = last.x + last.width;
        var totalItemW = sortedX.reduce(function(acc, it) { return acc + it.width; }, 0);
        var gap = (maxX - minX - totalItemW) / (sortedX.length - 1);
        var curX = minX;
        sortedX.forEach(function(it) {
          it.x = Number(curX.toFixed(2));
          curX += it.width + gap;
        });
      } else if (axis === 'vertical') {
        var sortedY = items.slice().sort(function(a, b) { return a.y - b.y; });
        var minY = sortedY[0].y;
        var lastY = sortedY[sortedY.length - 1];
        var maxY = lastY.y + lastY.height;
        var totalItemH = sortedY.reduce(function(acc, it) { return acc + it.height; }, 0);
        var gapY = (maxY - minY - totalItemH) / (sortedY.length - 1);
        var curY = minY;
        sortedY.forEach(function(it) {
          it.y = Number(curY.toFixed(2));
          curY += it.height + gapY;
        });
      }
    },

    duplicate: function(state, itemId) {
      var items = state.items;
      var found = items.find(function(it) { return it.id === itemId; });
      if (!found) return null;

      var clone = JSON.parse(JSON.stringify(found));
      clone.id = 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      clone.x += 10;
      clone.y += 10;
      items.push(clone);
      state.selectedItemId = clone.id;
      return clone;
    },

    deleteItem: function(state, itemId) {
      state.items = state.items.filter(function(it) { return it.id !== itemId; });
      if (state.selectedItemId === itemId) {
        state.selectedItemId = (state.items[0] && state.items[0].id) || null;
      }
    },

    reorder: function(state, itemId, direction) {
      var idx = state.items.findIndex(function(it) { return it.id === itemId; });
      if (idx === -1) return;
      var item = state.items.splice(idx, 1)[0];

      if (direction === 'bringToFront') {
        state.items.push(item);
      } else if (direction === 'sendToBack') {
        state.items.unshift(item);
      } else if (direction === 'moveForward') {
        state.items.splice(Math.min(state.items.length, idx + 1), 0, item);
      } else if (direction === 'moveBackward') {
        state.items.splice(Math.max(0, idx - 1), 0, item);
      }
    }
  };

  /**
   * Draw rounded rectangle path helper on Canvas 2D context.
   */
  function drawRoundedRectPath(ctx, x, y, width, height, radius) {
    radius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Master Canvas Renderer: Renders full print page onto an HTML5 Canvas at any DPI or scale.
   * Accurately renders crop marks, cut lines, safe margins, card containers, and quiet-zone-preserved QR codes.
   */
  function renderPageToCanvas(state, targetDpi, activeWorkspaceCanvas, options) {
    options = options || {};
    var pageDims = getEffectivePageDimensions(state);
    var dpi = targetDpi || state.dpi || 300;

    // Convert mm to pixels at target DPI
    var mmToPx = (dpi / 25.4);
    var canvasW = Math.round(pageDims.width * mmToPx);
    var canvasH = Math.round(pageDims.height * mmToPx);

    // Create target canvas
    var doc = (typeof document !== 'undefined') ? document : null;
    var canvas = (options.canvas) || (doc ? doc.createElement('canvas') : null);
    if (!canvas) {
      throw new Error('Canvas element required for page rendering.');
    }
    canvas.width = canvasW;
    canvas.height = canvasH;

    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available on canvas.');

    // 1. Fill page background
    ctx.fillStyle = state.pageBg || '#FFFFFF';
    ctx.fillRect(0, 0, canvasW, canvasH);

    var margins = state.marginsMm;
    var mLeftPx = margins.left * mmToPx;
    var mTopPx = margins.top * mmToPx;
    var mRightPx = margins.right * mmToPx;
    var mBottomPx = margins.bottom * mmToPx;

    // 2. Draw Printable Area Guides (Preview mode only)
    if (state.showMarginGuides && !options.isExport) {
      ctx.save();
      ctx.strokeStyle = 'rgba(77, 91, 255, 0.4)';
      ctx.lineWidth = Math.max(1, 1 * (dpi / 96));
      ctx.setLineDash([4 * (dpi / 96), 4 * (dpi / 96)]);
      ctx.strokeRect(mLeftPx, mTopPx, canvasW - mLeftPx - mRightPx, canvasH - mTopPx - mBottomPx);
      ctx.restore();
    }

    // 3. Draw Cut Lines (Grid guide lines)
    if (state.showCutLines && state.gridMode) {
      ctx.save();
      ctx.strokeStyle = options.isExport ? 'rgba(180, 180, 180, 0.7)' : 'rgba(23, 23, 23, 0.35)';
      ctx.lineWidth = Math.max(0.5, 0.5 * (dpi / 96));
      ctx.setLineDash([3 * (dpi / 96), 3 * (dpi / 96)]);

      var fit = calculateGridDimensions(state);
      var sX = (fit.fitsInMargins) ? (margins.left + ((fit.availableWidthMm - fit.gridWidthMm) / 2)) : margins.left;
      var sY = (fit.fitsInMargins) ? (margins.top + ((fit.availableHeightMm - fit.gridHeightMm) / 2)) : margins.top;

      for (var r = 0; r <= fit.rows; r++) {
        var lineY = (sY + (r * (fit.labelHeightMm + fit.gapYMm))) * mmToPx;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(canvasW, lineY);
        ctx.stroke();
      }
      for (var c = 0; c <= fit.cols; c++) {
        var lineX = (sX + (c * (fit.labelWidthMm + fit.gapXMm))) * mmToPx;
        ctx.beginPath();
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, canvasH);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw Corner Crop Marks (Standard print marks)
    if (state.showCropMarks) {
      ctx.save();
      ctx.strokeStyle = '#171717';
      ctx.lineWidth = Math.max(1, 0.75 * (dpi / 96));
      var markLen = 7 * mmToPx;
      var markOffset = 2 * mmToPx;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(mLeftPx, mTopPx - markOffset);
      ctx.lineTo(mLeftPx, mTopPx - markOffset - markLen);
      ctx.moveTo(mLeftPx - markOffset, mTopPx);
      ctx.lineTo(mLeftPx - markOffset - markLen, mTopPx);
      // Top-Right
      var trX = canvasW - mRightPx;
      ctx.moveTo(trX, mTopPx - markOffset);
      ctx.lineTo(trX, mTopPx - markOffset - markLen);
      ctx.moveTo(trX + markOffset, mTopPx);
      ctx.lineTo(trX + markOffset + markLen, mTopPx);
      // Bottom-Left
      var blY = canvasH - mBottomPx;
      ctx.moveTo(mLeftPx, blY + markOffset);
      ctx.lineTo(mLeftPx, blY + markOffset + markLen);
      ctx.moveTo(mLeftPx - markOffset, blY);
      ctx.lineTo(mLeftPx - markOffset - markLen, blY);
      // Bottom-Right
      ctx.moveTo(trX, blY + markOffset);
      ctx.lineTo(trX, blY + markOffset + markLen);
      ctx.moveTo(trX + markOffset, blY);
      ctx.lineTo(trX + markOffset + markLen, blY);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Items
    var items = state.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var ix = item.x * mmToPx;
      var iy = item.y * mmToPx;
      var iw = item.width * mmToPx;
      var ih = item.height * mmToPx;

      ctx.save();

      // Card Base Background
      if (item.showCardBadge) {
        ctx.fillStyle = item.cardBg || '#FFFFFF';
        ctx.strokeStyle = item.cardBorderColor || '#171717';
        ctx.lineWidth = Math.max(1, 1.2 * (dpi / 96));

        if (item.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(ix + (iw / 2), iy + (ih / 2), Math.min(iw, ih) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (item.shape === 'rounded' && item.cornerRadiusMm > 0) {
          drawRoundedRectPath(ctx, ix, iy, iw, ih, item.cornerRadiusMm * mmToPx);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(ix, iy, iw, ih);
          ctx.strokeRect(ix, iy, iw, ih);
        }
      }

      // Lanyard Hole Guide (For event badges)
      if (item.hasLanyardHole) {
        ctx.save();
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = Math.max(1, 0.75 * (dpi / 96));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        var holeW = 12 * mmToPx;
        var holeH = 3.5 * mmToPx;
        var holeX = ix + ((iw - holeW) / 2);
        var holeY = iy + (5 * mmToPx);
        drawRoundedRectPath(ctx, holeX, holeY, holeW, holeH, holeH / 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // QR Code Placement (Preserve aspect ratio & quiet zone)
      var qrSrcCanvas = item.cachedCanvas || activeWorkspaceCanvas;
      var qrSizeMm = item.qrSizeMm || Math.min(item.width * 0.6, item.height * 0.6);
      var qrSizePx = qrSizeMm * mmToPx;

      var qrX = ix + ((iw - qrSizePx) / 2);
      var qrY = iy + (item.showTitle ? (10 * mmToPx) : ((ih - qrSizePx) / 2));

      // Layout specific positioning
      if (item.width >= 80 && item.height <= 60) {
        // Horizontal business card: QR placed on left, text on right
        qrSizePx = Math.min(ih - (12 * mmToPx), 38 * mmToPx);
        qrX = ix + (8 * mmToPx);
        qrY = iy + ((ih - qrSizePx) / 2);
      }

      if (qrSrcCanvas) {
        ctx.drawImage(qrSrcCanvas, qrX, qrY, qrSizePx, qrSizePx);
      } else {
        // Fallback placeholder QR wireframe
        ctx.fillStyle = '#171717';
        ctx.fillRect(qrX, qrY, qrSizePx, qrSizePx);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(qrX + 4, qrY + 4, qrSizePx - 8, qrSizePx - 8);
        ctx.fillStyle = '#171717';
        ctx.font = Math.round(10 * (dpi / 96)) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QR CODE', qrX + (qrSizePx / 2), qrY + (qrSizePx / 2) + 4);
      }

      // Typography Rendering (Title, Description, CTA)
      var textBaseX, textBaseY;
      ctx.fillStyle = item.textColor || '#171717';

      if (item.width >= 80 && item.height <= 60) {
        // Business card right side text column
        textBaseX = qrX + qrSizePx + (6 * mmToPx);
        textBaseY = iy + (14 * mmToPx);
        ctx.textAlign = 'left';

        if (item.showTitle && item.title) {
          ctx.font = 'bold ' + Math.round(11 * (dpi / 96)) + 'px sans-serif';
          ctx.fillText(item.title, textBaseX, textBaseY);
        }
        if (item.showDescription && item.description) {
          ctx.font = Math.round(7.5 * (dpi / 96)) + 'px sans-serif';
          ctx.fillStyle = '#555555';
          ctx.fillText(item.description, textBaseX, textBaseY + (6 * mmToPx));
        }
        if (item.showCta && item.cta) {
          ctx.font = 'bold ' + Math.round(7 * (dpi / 96)) + 'px sans-serif';
          ctx.fillStyle = '#4D5BFF';
          ctx.fillText(item.cta, textBaseX, textBaseY + (13 * mmToPx));
        }
      } else {
        // Centered stacked card text
        ctx.textAlign = 'center';
        var centerX = ix + (iw / 2);

        if (item.showTitle && item.title) {
          var titleY = iy + (7.5 * mmToPx);
          if (item.hasLanyardHole) titleY += 6 * mmToPx;
          ctx.font = 'bold ' + Math.round(Math.min(13, iw / 10) * (dpi / 96)) + 'px sans-serif';
          ctx.fillText(item.title, centerX, titleY);
        }

        if (item.showDescription && item.description) {
          var descY = qrY + qrSizePx + (5 * mmToPx);
          ctx.font = Math.round(Math.min(8.5, iw / 14) * (dpi / 96)) + 'px sans-serif';
          ctx.fillStyle = '#444444';
          ctx.fillText(item.description, centerX, descY);
        }

        if (item.showCta && item.cta) {
          var ctaY = iy + ih - (6 * mmToPx);
          ctx.font = 'bold ' + Math.round(Math.min(8, iw / 15) * (dpi / 96)) + 'px sans-serif';
          ctx.fillStyle = '#171717';
          // Draw mini CTA capsule background
          var ctaTextW = ctx.measureText(item.cta).width + (10 * (dpi / 96));
          ctx.fillStyle = '#FFE600';
          ctx.fillRect(centerX - (ctaTextW / 2), ctaY - (8 * (dpi / 96)), ctaTextW, 11 * (dpi / 96));
          ctx.strokeRect(centerX - (ctaTextW / 2), ctaY - (8 * (dpi / 96)), ctaTextW, 11 * (dpi / 96));
          ctx.fillStyle = '#171717';
          ctx.fillText(item.cta, centerX, ctaY);
        }
      }

      // Selection Outline & Handles (Preview mode only)
      if (!options.isExport && state.selectedItemId === item.id) {
        ctx.strokeStyle = '#4D5BFF';
        ctx.lineWidth = Math.max(2, 2 * (dpi / 96));
        ctx.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);

        // Selection Tag
        ctx.fillStyle = '#4D5BFF';
        ctx.font = 'bold ' + Math.round(8 * (dpi / 96)) + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SELECTED', ix, iy - 5);
      }

      ctx.restore();
    }

    return {
      canvas: canvas,
      width: canvasW,
      height: canvasH,
      dpi: dpi
    };
  }

  /**
   * Vector SVG Generator for Print Page.
   * Generates genuine standalone SVG in millimeters with crop marks, cut lines, vector text, and QR images.
   */
  function generatePrintSVG(state, activeWorkspaceCanvas) {
    var pageDims = getEffectivePageDimensions(state);
    var pageW = pageDims.width;
    var pageH = pageDims.height;
    var margins = state.marginsMm;

    var svg = [];
    svg.push('<?xml version="1.0" encoding="UTF-8"?>');
    svg.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"');
    svg.push('     width="' + pageW + 'mm" height="' + pageH + 'mm" viewBox="0 0 ' + pageW + ' ' + pageH + '"');
    svg.push('     version="1.1">');
    svg.push('  <title>Better QR Print Document</title>');
    svg.push('  <desc>Precision Print Layout generated by Better QR — Make Every Scan Better</desc>');
    svg.push('');

    // Page Background
    svg.push('  <!-- Page Canvas -->');
    svg.push('  <rect width="' + pageW + '" height="' + pageH + '" fill="' + (state.pageBg || '#FFFFFF') + '"/>');
    svg.push('');

    // Crop Marks
    if (state.showCropMarks) {
      svg.push('  <!-- Corner Crop Marks -->');
      var m = margins;
      var len = 7;
      var off = 2;
      var trX = pageW - m.right;
      var blY = pageH - m.bottom;

      svg.push('  <g stroke="#171717" stroke-width="0.3">');
      // Top-Left
      svg.push('    <line x1="' + m.left + '" y1="' + (m.top - off) + '" x2="' + m.left + '" y2="' + (m.top - off - len) + '"/>');
      svg.push('    <line x1="' + (m.left - off) + '" y1="' + m.top + '" x2="' + (m.left - off - len) + '" y2="' + m.top + '"/>');
      // Top-Right
      svg.push('    <line x1="' + trX + '" y1="' + (m.top - off) + '" x2="' + trX + '" y2="' + (m.top - off - len) + '"/>');
      svg.push('    <line x1="' + (trX + off) + '" y1="' + m.top + '" x2="' + (trX + off + len) + '" y2="' + m.top + '"/>');
      // Bottom-Left
      svg.push('    <line x1="' + m.left + '" y1="' + (blY + off) + '" x2="' + m.left + '" y2="' + (blY + off + len) + '"/>');
      svg.push('    <line x1="' + (m.left - off) + '" y1="' + blY + '" x2="' + (m.left - off - len) + '" y2="' + blY + '"/>');
      // Bottom-Right
      svg.push('    <line x1="' + trX + '" y1="' + (blY + off) + '" x2="' + trX + '" y2="' + (blY + off + len) + '"/>');
      svg.push('    <line x1="' + (trX + off) + '" y1="' + blY + '" x2="' + (trX + off + len) + '" y2="' + blY + '"/>');
      svg.push('  </g>');
    }

    // Cut Lines
    if (state.showCutLines && state.gridMode) {
      svg.push('  <!-- Grid Cut Guides -->');
      var fit = calculateGridDimensions(state);
      var sX = fit.fitsInMargins ? (margins.left + ((fit.availableWidthMm - fit.gridWidthMm) / 2)) : margins.left;
      var sY = fit.fitsInMargins ? (margins.top + ((fit.availableHeightMm - fit.gridHeightMm) / 2)) : margins.top;

      svg.push('  <g stroke="#999999" stroke-dasharray="1,1" stroke-width="0.25">');
      for (var r = 0; r <= fit.rows; r++) {
        var ly = sY + (r * (fit.labelHeightMm + fit.gapYMm));
        svg.push('    <line x1="0" y1="' + ly.toFixed(2) + '" x2="' + pageW + '" y2="' + ly.toFixed(2) + '"/>');
      }
      for (var c = 0; c <= fit.cols; c++) {
        var lx = sX + (c * (fit.labelWidthMm + fit.gapXMm));
        svg.push('    <line x1="' + lx.toFixed(2) + '" y1="0" x2="' + lx.toFixed(2) + '" y2="' + pageH + '"/>');
      }
      svg.push('  </g>');
    }

    // Get QR image base64 data URL
    var qrDataUrl = '';
    if (activeWorkspaceCanvas && typeof activeWorkspaceCanvas.toDataURL === 'function') {
      qrDataUrl = activeWorkspaceCanvas.toDataURL('image/png');
    }

    // Render Items
    svg.push('  <!-- Print Items -->');
    var items = state.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      svg.push('  <g id="' + it.id + '">');

      if (it.showCardBadge) {
        if (it.shape === 'circle') {
          var cx = it.x + (it.width / 2);
          var cy = it.y + (it.height / 2);
          var rad = Math.min(it.width, it.height) / 2;
          svg.push('    <circle cx="' + cx.toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="' + rad.toFixed(2) + '" fill="' + it.cardBg + '" stroke="' + it.cardBorderColor + '" stroke-width="0.4"/>');
        } else {
          var rx = (it.shape === 'rounded' && it.cornerRadiusMm > 0) ? it.cornerRadiusMm : 0;
          svg.push('    <rect x="' + it.x + '" y="' + it.y + '" width="' + it.width + '" height="' + it.height + '" rx="' + rx + '" fill="' + it.cardBg + '" stroke="' + it.cardBorderColor + '" stroke-width="0.4"/>');
        }
      }

      // QR Image
      var qSize = it.qrSizeMm || Math.min(it.width * 0.6, it.height * 0.6);
      var qX = it.x + ((it.width - qSize) / 2);
      var qY = it.y + (it.showTitle ? 8 : ((it.height - qSize) / 2));

      if (it.width >= 80 && it.height <= 60) {
        qSize = Math.min(it.height - 10, 36);
        qX = it.x + 8;
        qY = it.y + ((it.height - qSize) / 2);
      }

      if (qrDataUrl && isSafeRasterDataUrl(qrDataUrl)) {
        svg.push('    <image x="' + qX.toFixed(2) + '" y="' + qY.toFixed(2) + '" width="' + qSize.toFixed(2) + '" height="' + qSize.toFixed(2) + '" xlink:href="' + qrDataUrl + '" href="' + qrDataUrl + '"/>');
      }

      // Vector Text Elements
      if (it.width >= 80 && it.height <= 60) {
        var tx = qX + qSize + 6;
        var ty = it.y + 14;
        if (it.showTitle && it.title) {
          svg.push('    <text x="' + tx.toFixed(2) + '" y="' + ty.toFixed(2) + '" font-family="system-ui, sans-serif" font-weight="bold" font-size="3.5" fill="' + it.textColor + '">' + escapeXml(it.title) + '</text>');
        }
        if (it.showDescription && it.description) {
          svg.push('    <text x="' + tx.toFixed(2) + '" y="' + (ty + 5).toFixed(2) + '" font-family="system-ui, sans-serif" font-size="2.4" fill="#555555">' + escapeXml(it.description) + '</text>');
        }
        if (it.showCta && it.cta) {
          svg.push('    <text x="' + tx.toFixed(2) + '" y="' + (ty + 11).toFixed(2) + '" font-family="system-ui, sans-serif" font-weight="bold" font-size="2.2" fill="#4D5BFF">' + escapeXml(it.cta) + '</text>');
        }
      } else {
        var cX = it.x + (it.width / 2);
        if (it.showTitle && it.title) {
          var tY = it.y + 6;
          svg.push('    <text x="' + cX.toFixed(2) + '" y="' + tY.toFixed(2) + '" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="3.2" fill="' + it.textColor + '">' + escapeXml(it.title) + '</text>');
        }
        if (it.showDescription && it.description) {
          var dY = qY + qSize + 4.5;
          svg.push('    <text x="' + cX.toFixed(2) + '" y="' + dY.toFixed(2) + '" text-anchor="middle" font-family="system-ui, sans-serif" font-size="2.3" fill="#444444">' + escapeXml(it.description) + '</text>');
        }
        if (it.showCta && it.cta) {
          var ctaY = it.y + it.height - 4;
          svg.push('    <text x="' + cX.toFixed(2) + '" y="' + ctaY.toFixed(2) + '" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="2.2" fill="' + it.textColor + '">' + escapeXml(it.cta) + '</text>');
        }
      }

      svg.push('  </g>');
    }

    svg.push('</svg>');
    return svg.join('\n');
  }

  /**
   * Genuine PDF 1.4 Document Generator for Print Studio Layouts.
   * Preserves exact page dimensions in points (72pt/inch), crop marks, cut lines, vector text, and embedded high-res QR artwork.
   */
  function generatePrintPDF(state, activeWorkspaceCanvas) {
    var pageDims = getEffectivePageDimensions(state);
    var pageW = pageDims.width;
    var pageH = pageDims.height;

    // PDF MediaBox in points (72 pt / inch = 72 / 25.4 pt/mm)
    var pageWPt = Number((pageW * MM_TO_PT).toFixed(2));
    var pageHPt = Number((pageH * MM_TO_PT).toFixed(2));

    var margins = state.marginsMm;
    var mLPt = margins.left * MM_TO_PT;
    var mRPt = margins.right * MM_TO_PT;
    var mTPt = margins.top * MM_TO_PT;
    var mBPt = margins.bottom * MM_TO_PT;

    // Extract JPEG image bytes from active workspace canvas for /DCTDecode
    var jpegDataUrl = null;
    if (activeWorkspaceCanvas && typeof activeWorkspaceCanvas.toDataURL === 'function') {
      jpegDataUrl = activeWorkspaceCanvas.toDataURL('image/jpeg', 0.95);
    }
    var jpegBytes = null;
    if (jpegDataUrl && QRStudio.base64ToUint8Array) {
      jpegBytes = QRStudio.base64ToUint8Array(jpegDataUrl);
    }

    var imgW = (activeWorkspaceCanvas && activeWorkspaceCanvas.width) || 1024;
    var imgH = (activeWorkspaceCanvas && activeWorkspaceCanvas.height) || 1024;

    var streamParts = [];

    // Background color
    var bgRgb = hexToRgbNormalized(state.pageBg || '#FFFFFF');
    streamParts.push('q ' + bgRgb.r + ' ' + bgRgb.g + ' ' + bgRgb.b + ' rg 0 0 ' + pageWPt + ' ' + pageHPt + ' re f Q');

    // Crop marks in PDF
    if (state.showCropMarks) {
      var lenPt = 7 * MM_TO_PT;
      var offPt = 2 * MM_TO_PT;
      var topY = pageHPt - mTPt;
      var rightX = pageWPt - mRPt;

      streamParts.push('q 0 0 0 RG 0.5 w');
      // Top-Left
      streamParts.push(mLPt + ' ' + (topY + offPt) + ' m ' + mLPt + ' ' + (topY + offPt + lenPt) + ' l S');
      streamParts.push((mLPt - offPt) + ' ' + topY + ' m ' + (mLPt - offPt - lenPt) + ' ' + topY + ' l S');
      // Top-Right
      streamParts.push(rightX + ' ' + (topY + offPt) + ' m ' + rightX + ' ' + (topY + offPt + lenPt) + ' l S');
      streamParts.push((rightX + offPt) + ' ' + topY + ' m ' + (rightX + offPt + lenPt) + ' ' + topY + ' l S');
      // Bottom-Left
      streamParts.push(mLPt + ' ' + (mBPt - offPt) + ' m ' + mLPt + ' ' + (mBPt - offPt - lenPt) + ' l S');
      streamParts.push((mLPt - offPt) + ' ' + mBPt + ' m ' + (mLPt - offPt - lenPt) + ' ' + mBPt + ' l S');
      // Bottom-Right
      streamParts.push(rightX + ' ' + (mBPt - offPt) + ' m ' + rightX + ' ' + (mBPt - offPt - lenPt) + ' l S');
      streamParts.push((rightX + offPt) + ' ' + mBPt + ' m ' + (rightX + offPt + lenPt) + ' ' + mBPt + ' l S');
      streamParts.push('Q');
    }

    // Cut Lines in PDF
    if (state.showCutLines && state.gridMode) {
      var fit = calculateGridDimensions(state);
      var sX = fit.fitsInMargins ? (margins.left + ((fit.availableWidthMm - fit.gridWidthMm) / 2)) : margins.left;
      var sY = fit.fitsInMargins ? (margins.top + ((fit.availableHeightMm - fit.gridHeightMm) / 2)) : margins.top;

      streamParts.push('q [2 2] 0 d 0.6 0.6 0.6 RG 0.5 w');
      for (var r = 0; r <= fit.rows; r++) {
        var lineYMm = sY + (r * (fit.labelHeightMm + fit.gapYMm));
        var lineYPt = pageHPt - (lineYMm * MM_TO_PT);
        streamParts.push('0 ' + lineYPt.toFixed(2) + ' m ' + pageWPt + ' ' + lineYPt.toFixed(2) + ' l S');
      }
      for (var c = 0; c <= fit.cols; c++) {
        var lineXMm = sX + (c * (fit.labelWidthMm + fit.gapXMm));
        var lineXPt = lineXMm * MM_TO_PT;
        streamParts.push(lineXPt.toFixed(2) + ' 0 m ' + lineXPt.toFixed(2) + ' ' + pageHPt + ' l S');
      }
      streamParts.push('Q');
    }

    // Draw Items in PDF (In PDF, (0, 0) is at bottom-left!)
    var items = state.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var itWPt = it.width * MM_TO_PT;
      var itHPt = it.height * MM_TO_PT;
      var itXPt = it.x * MM_TO_PT;
      var itYPt = pageHPt - ((it.y + it.height) * MM_TO_PT); // PDF Y is inverted

      // Draw Card Base
      if (it.showCardBadge) {
        var cardRgb = hexToRgbNormalized(it.cardBg || '#FFFFFF');
        var borderRgb = hexToRgbNormalized(it.cardBorderColor || '#171717');
        streamParts.push('q ' + cardRgb.r + ' ' + cardRgb.g + ' ' + cardRgb.b + ' rg ' + borderRgb.r + ' ' + borderRgb.g + ' ' + borderRgb.b + ' RG 1 w');
        streamParts.push(itXPt.toFixed(2) + ' ' + itYPt.toFixed(2) + ' ' + itWPt.toFixed(2) + ' ' + itHPt.toFixed(2) + ' re B Q');
      }

      // Draw QR Code Image
      var qSizeMm = it.qrSizeMm || Math.min(it.width * 0.6, it.height * 0.6);
      var qSizePt = qSizeMm * MM_TO_PT;
      var qXPt = itXPt + ((itWPt - qSizePt) / 2);
      var qYPt = itYPt + (it.showTitle ? (6 * MM_TO_PT) : ((itHPt - qSizePt) / 2));

      if (it.width >= 80 && it.height <= 60) {
        qSizePt = Math.min(itHPt - (10 * MM_TO_PT), 36 * MM_TO_PT);
        qXPt = itXPt + (8 * MM_TO_PT);
        qYPt = itYPt + ((itHPt - qSizePt) / 2);
      }

      if (jpegBytes) {
        streamParts.push('q ' + qSizePt.toFixed(2) + ' 0 0 ' + qSizePt.toFixed(2) + ' ' + qXPt.toFixed(2) + ' ' + qYPt.toFixed(2) + ' cm /Im1 Do Q');
      }

      // Text Elements in PDF
      var textRgb = hexToRgbNormalized(it.textColor || '#171717');
      if (it.width >= 80 && it.height <= 60) {
        var tXPt = qXPt + qSizePt + (6 * MM_TO_PT);
        var tYPt = itYPt + itHPt - (14 * MM_TO_PT);

        if (it.showTitle && it.title) {
          streamParts.push('BT /F2 11 Tf ' + textRgb.r + ' ' + textRgb.g + ' ' + textRgb.b + ' rg ' + tXPt.toFixed(2) + ' ' + tYPt.toFixed(2) + ' Td (' + escapePdfString(it.title) + ') Tj ET');
        }
        if (it.showDescription && it.description) {
          streamParts.push('BT /F1 8 Tf 0.35 0.35 0.35 rg ' + tXPt.toFixed(2) + ' ' + (tYPt - 12).toFixed(2) + ' Td (' + escapePdfString(it.description) + ') Tj ET');
        }
        if (it.showCta && it.cta) {
          streamParts.push('BT /F2 7 Tf 0.3 0.35 1 rg ' + tXPt.toFixed(2) + ' ' + (tYPt - 24).toFixed(2) + ' Td (' + escapePdfString(it.cta) + ') Tj ET');
        }
      } else {
        var cXPt = itXPt + (itWPt / 2);
        if (it.showTitle && it.title) {
          var titleYPt = itYPt + itHPt - (12 * MM_TO_PT);
          streamParts.push('BT /F2 10 Tf ' + textRgb.r + ' ' + textRgb.g + ' ' + textRgb.b + ' rg ' + (cXPt - (it.title.length * 2.5)).toFixed(2) + ' ' + titleYPt.toFixed(2) + ' Td (' + escapePdfString(it.title) + ') Tj ET');
        }
        if (it.showDescription && it.description) {
          var descYPt = qYPt - (10 * MM_TO_PT);
          streamParts.push('BT /F1 7.5 Tf 0.3 0.3 0.3 rg ' + (cXPt - (it.description.length * 1.8)).toFixed(2) + ' ' + descYPt.toFixed(2) + ' Td (' + escapePdfString(it.description) + ') Tj ET');
        }
        if (it.showCta && it.cta) {
          var ctaYPt = itYPt + (5 * MM_TO_PT);
          streamParts.push('BT /F2 7 Tf ' + textRgb.r + ' ' + textRgb.g + ' ' + textRgb.b + ' rg ' + (cXPt - (it.cta.length * 1.8)).toFixed(2) + ' ' + ctaYPt.toFixed(2) + ' Td (' + escapePdfString(it.cta) + ') Tj ET');
        }
      }
    }

    var contentStreamStr = streamParts.join('\n');
    var contentStreamBytes = QRStudio.stringToUtf8Bytes ? QRStudio.stringToUtf8Bytes(contentStreamStr) : new Uint8Array(0);

    // Assemble PDF 1.4 Objects
    var objects = [];
    var offsets = [];

    // Obj 1: Catalog
    objects.push({ num: 1, content: '<< /Type /Catalog /Pages 2 0 R >>' });

    // Obj 2: Pages
    objects.push({ num: 2, content: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' });

    // Obj 3: Page
    var resDict = '<< /Font << /F1 6 0 R /F2 7 0 R >>';
    if (jpegBytes) {
      resDict += ' /XObject << /Im1 5 0 R >>';
    }
    resDict += ' >>';

    objects.push({
      num: 3,
      content: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWPt + ' ' + pageHPt + '] /Contents 4 0 R /Resources ' + resDict + ' >>'
    });

    // Obj 4: Content Stream
    objects.push({
      num: 4,
      isStream: true,
      headers: '<< /Length ' + contentStreamBytes.length + ' >>',
      streamBytes: contentStreamBytes
    });

    // Obj 5: Embedded JPEG XObject
    if (jpegBytes) {
      objects.push({
        num: 5,
        isStream: true,
        headers: '<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>',
        streamBytes: jpegBytes
      });
    }

    // Obj 6: Font Helvetica
    objects.push({ num: 6, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' });

    // Obj 7: Font Helvetica-Bold
    objects.push({ num: 7, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' });

    // Build PDF Binary Buffer
    var headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    var headerBytes = QRStudio.stringToUtf8Bytes(headerStr);
    var chunks = [headerBytes];
    var currentOffset = headerBytes.length;

    for (var j = 0; j < objects.length; j++) {
      var obj = objects[j];
      offsets[obj.num] = currentOffset;

      var objStartStr = obj.num + ' 0 obj\n';
      var objStartBytes = QRStudio.stringToUtf8Bytes(objStartStr);
      chunks.push(objStartBytes);
      currentOffset += objStartBytes.length;

      if (obj.isStream) {
        var hStr = obj.headers + '\nstream\n';
        var hBytes = QRStudio.stringToUtf8Bytes(hStr);
        chunks.push(hBytes);
        currentOffset += hBytes.length;

        chunks.push(obj.streamBytes);
        currentOffset += obj.streamBytes.length;

        var sEndStr = '\nendstream\nendobj\n';
        var sEndBytes = QRStudio.stringToUtf8Bytes(sEndStr);
        chunks.push(sEndBytes);
        currentOffset += sEndBytes.length;
      } else {
        var bodyStr = obj.content + '\nendobj\n';
        var bodyBytes = QRStudio.stringToUtf8Bytes(bodyStr);
        chunks.push(bodyBytes);
        currentOffset += bodyBytes.length;
      }
    }

    var startXref = currentOffset;
    var totalObjects = objects.length + 1;
    var xrefStr = 'xref\n0 ' + totalObjects + '\n0000000000 65535 f \n';

    for (var k = 1; k < totalObjects; k++) {
      var offVal = String(offsets[k] || 0);
      while (offVal.length < 10) offVal = '0' + offVal;
      xrefStr += offVal + ' 00000 n \n';
    }

    xrefStr += 'trailer\n<< /Size ' + totalObjects + ' /Root 1 0 R >>\nstartxref\n' + startXref + '\n%%EOF\n';
    var xrefBytes = QRStudio.stringToUtf8Bytes(xrefStr);
    chunks.push(xrefBytes);

    var totalLen = chunks.reduce(function(sum, c) { return sum + c.length; }, 0);
    var finalPdf = new Uint8Array(totalLen);
    var pos = 0;
    for (var idx = 0; idx < chunks.length; idx++) {
      finalPdf.set(chunks[idx], pos);
      pos += chunks[idx].length;
    }

    return finalPdf;
  }

  /**
   * JSON Layout Export / Import
   */
  function exportLayoutToJSON(state) {
    var exportPayload = {
      manifestVersion: '1.7.0',
      type: 'qr-design-studio-print-layout',
      createdAt: new Date().toISOString(),
      pageSize: state.pageSize,
      customWidthMm: state.customWidthMm,
      customHeightMm: state.customHeightMm,
      orientation: state.orientation,
      marginsMm: state.marginsMm,
      pageBg: state.pageBg,
      showCropMarks: state.showCropMarks,
      showCutLines: state.showCutLines,
      showMarginGuides: state.showMarginGuides,
      templateId: state.templateId,
      gridMode: state.gridMode,
      gridConfig: state.gridConfig,
      items: state.items.map(function(it) {
        return {
          id: it.id,
          x: it.x,
          y: it.y,
          width: it.width,
          height: it.height,
          qrSizeMm: it.qrSizeMm,
          shape: it.shape,
          title: it.title,
          description: it.description,
          cta: it.cta,
          showTitle: it.showTitle,
          showDescription: it.showDescription,
          showCta: it.showCta,
          showCardBadge: it.showCardBadge,
          cardBg: it.cardBg,
          cardBorderColor: it.cardBorderColor,
          textColor: it.textColor
        };
      })
    };

    return JSON.stringify(exportPayload, null, 2);
  }

  function importLayoutFromJSON(state, jsonStr, activeWorkspaceCanvas) {
    var parsed = JSON.parse(jsonStr);
    if (!parsed || parsed.type !== 'qr-design-studio-print-layout') {
      throw new Error('Invalid layout file: Missing qr-design-studio-print-layout manifest.');
    }

    state.pageSize = parsed.pageSize || 'a4';
    state.customWidthMm = Number(parsed.customWidthMm) || 210;
    state.customHeightMm = Number(parsed.customHeightMm) || 297;
    state.orientation = parsed.orientation || 'portrait';
    state.marginsMm = Object.assign({ top: 10, bottom: 10, left: 10, right: 10 }, parsed.marginsMm || {});
    state.pageBg = parsed.pageBg || '#FFFFFF';
    state.showCropMarks = parsed.showCropMarks !== false;
    state.showCutLines = parsed.showCutLines !== false;
    state.showMarginGuides = parsed.showMarginGuides !== false;
    state.templateId = parsed.templateId || 'sticker-sheet';
    state.gridMode = !!parsed.gridMode;
    if (parsed.gridConfig) state.gridConfig = Object.assign({}, parsed.gridConfig);

    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      state.items = parsed.items.map(function(it, i) {
        return Object.assign({
          id: it.id || 'item-' + i,
          cellIndex: i,
          qrSource: 'current',
          customPayload: null
        }, it);
      });
      state.selectedItemId = state.items[0].id;
    } else {
      syncItemsFromGrid(state, activeWorkspaceCanvas);
    }

    return state;
  }

  /**
   * Export Engine Public API
   */
  var PrintEngine = {
    PAGE_SIZES: PAGE_SIZES,
    TEMPLATES: TEMPLATES,
    MM_TO_INCH: MM_TO_INCH,
    INCH_TO_MM: INCH_TO_MM,
    MM_TO_PT: MM_TO_PT,
    PT_TO_MM: PT_TO_MM,
    MIN_SCAN_SIZE_MM: MIN_SCAN_SIZE_MM,

    createDefaultState: createDefaultState,
    getEffectivePageDimensions: getEffectivePageDimensions,
    calculateGridDimensions: calculateGridDimensions,
    autoFitGrid: autoFitGrid,
    syncItemsFromGrid: syncItemsFromGrid,
    applyTemplate: applyTemplate,
    validatePrintSafety: validatePrintSafety,
    itemOps: ItemOps,
    renderPageToCanvas: renderPageToCanvas,
    generatePrintSVG: generatePrintSVG,
    generatePrintPDF: generatePrintPDF,
    exportLayoutToJSON: exportLayoutToJSON,
    importLayoutFromJSON: importLayoutFromJSON,

    formatDimensions: function(wMm, hMm) {
      return wMm.toFixed(1) + ' × ' + hMm.toFixed(1) + ' mm (' +
        (wMm * MM_TO_INCH).toFixed(2) + ' × ' + (hMm * MM_TO_INCH).toFixed(2) + ' in)';
    }
  };

  QRStudio.PrintEngine = PrintEngine;

})(typeof window !== 'undefined' ? window : this);

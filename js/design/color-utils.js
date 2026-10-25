/**
 * QR Design Studio — Design Utilities & Color Engine
 * Curated palettes, relative luminance, WCAG contrast calculation,
 * and scanability guidance for V1.1.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Curated high-contrast color palettes (8 curated styles).
   * All default palettes are designed to exceed WCAG AA/AAA and maintain scanability.
   */
  var CURATED_PALETTES = [
    {
      id: 'classic',
      name: 'Classic Ink',
      dark: '#171717',
      light: '#FFFFFF',
      description: 'Standard high-contrast monochrome (Recommended)'
    },
    {
      id: 'electric-lime',
      name: 'Electric Lime',
      dark: '#171717',
      light: '#D7FF38',
      description: 'Neo-brutalist acid lime and rich ink'
    },
    {
      id: 'hot-pink',
      name: 'Hot Pink',
      dark: '#171717',
      light: '#FF4FA3',
      description: 'High-energy studio pink and ink'
    },
    {
      id: 'cobalt',
      name: 'Cobalt Studio',
      dark: '#0A1172',
      light: '#FFFFFF',
      description: 'Deep cobalt blue on crisp white'
    },
    {
      id: 'tangerine',
      name: 'Tangerine Cream',
      dark: '#171717',
      light: '#FFE4D6',
      description: 'Warm tangerine paper cream'
    },
    {
      id: 'deep-violet',
      name: 'Deep Violet',
      dark: '#3B0764',
      light: '#FAF5FF',
      description: 'Rich royal purple on soft lilac white'
    },
    {
      id: 'forest-cream',
      name: 'Forest & Cream',
      dark: '#064E3B',
      light: '#FFF9ED',
      description: 'Deep emerald pine on warm paper cream'
    },
    {
      id: 'midnight-cyan',
      name: 'Midnight Navy',
      dark: '#0F172A',
      light: '#E0F2FE',
      description: 'Midnight slate navy on pale ice cyan'
    }
  ];

  var DEFAULT_DESIGN = {
    darkColor: '#171717',
    lightColor: '#FFFFFF',
    moduleStyle: 'square',
    finderStyle: 'square',
    activePalette: 'classic'
  };

  /**
   * Parse hex string (#RGB or #RRGGBB) to { r, g, b } or null if invalid.
   */
  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var clean = hex.trim().replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
      return null;
    }
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16)
    };
  }

  /**
   * Convert { r, g, b } to standardized 7-character hex string (#RRGGBB).
   */
  function rgbToHex(r, g, b) {
    var rh = ('0' + Math.max(0, Math.min(255, Math.round(r))).toString(16)).slice(-2);
    var gh = ('0' + Math.max(0, Math.min(255, Math.round(g))).toString(16)).slice(-2);
    var bh = ('0' + Math.max(0, Math.min(255, Math.round(b))).toString(16)).slice(-2);
    return ('#' + rh + gh + bh).toUpperCase();
  }

  /**
   * Normalize any valid hex to #RRGGBB format. Returns fallback if invalid.
   */
  function normalizeHex(hex, fallback) {
    var rgb = hexToRgb(hex);
    if (!rgb) {
      return fallback || '#000000';
    }
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Check if string is a valid hex color (#RGB or #RRGGBB).
   */
  function isValidHex(hex) {
    return hexToRgb(hex) !== null;
  }

  /**
   * Calculate ITU-R BT.709 / WCAG 2.1 relative luminance for an sRGB color.
   */
  function getRelativeLuminance(rgb) {
    var rs = rgb.r / 255;
    var gs = rgb.g / 255;
    var bs = rgb.b / 255;

    var rLinear = rs <= 0.04045 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    var gLinear = gs <= 0.04045 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    var bLinear = bs <= 0.04045 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }

  /**
   * Evaluate contrast ratio and scanability risks between foreground and background colors.
   * @param {string} darkHex - Foreground color hex.
   * @param {string} lightHex - Background color hex.
   * @param {Object} [styleOptions] - Active module and finder styles.
   * @returns {Object} Contrast metrics, warning level, and advisory messages.
   */
  function evaluateContrast(darkHex, lightHex, styleOptions) {
    var darkRgb = hexToRgb(darkHex) || { r: 23, g: 23, b: 23 };
    var lightRgb = hexToRgb(lightHex) || { r: 255, g: 255, b: 255 };

    var lDark = getRelativeLuminance(darkRgb);
    var lLight = getRelativeLuminance(lightRgb);

    var lighter = Math.max(lDark, lLight);
    var darker = Math.min(lDark, lLight);

    var ratio = (lighter + 0.05) / (darker + 0.05);
    var roundedRatio = Math.round(ratio * 10) / 10;

    var isInverted = lDark > lLight; // Foreground is lighter than background
    var isDecorative = styleOptions && (styleOptions.moduleStyle !== 'square' || styleOptions.finderStyle !== 'square');

    var level = 'safe'; // 'safe', 'warning', 'danger'
    var message = '';
    var details = [];

    if (isInverted) {
      level = 'danger';
      message = 'Inverted colors (light code on dark background).';
      details.push('Many hardware barcode scanners and built-in camera apps struggle with inverted QR codes. Standard dark-on-light is recommended.');
    } else if (ratio < 4.5) {
      level = 'danger';
      message = 'Low contrast (' + roundedRatio + ':1) — scanning may be unreliable or fail completely.';
      details.push('Consider choosing a darker foreground or lighter background to ensure reliable recognition.');
    } else if (ratio < 7.0) {
      level = 'warning';
      message = 'Acceptable contrast (' + roundedRatio + ':1).';
      details.push('Good for modern smartphones, but may be harder to read in low light or at long distances.');
    } else {
      level = 'safe';
      message = 'High contrast (' + roundedRatio + ':1) — optimal for reliable scanning across all devices.';
    }

    if (isDecorative) {
      details.push('Decorative module/finder styling is active. Test with your target scanner before commercial printing.');
    }

    return {
      ratio: roundedRatio,
      ratioFormatted: roundedRatio + ':1',
      isInverted: isInverted,
      isHighContrast: ratio >= 7.0 && !isInverted,
      isAcceptable: ratio >= 4.5 && !isInverted,
      isRisky: ratio < 4.5 || isInverted,
      level: level,
      summary: message,
      details: details,
      disclaimer: 'Contrast checks are advisory guidelines, not a guarantee of scanning. Physical scan testing is always required.'
    };
  }

  var Design = {
    PALETTES: CURATED_PALETTES,
    DEFAULT_DESIGN: DEFAULT_DESIGN,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    normalizeHex: normalizeHex,
    isValidHex: isValidHex,
    getRelativeLuminance: getRelativeLuminance,
    evaluateContrast: evaluateContrast
  };

  QRStudio.Design = Design;
})(typeof window !== 'undefined' ? window : this);

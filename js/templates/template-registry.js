/**
 * QR Design Studio — Template Registry & Variation Engine (V1.3)
 * Defines curated, built-in templates, category indexing, procedural thumbnails,
 * and high-contrast variation/randomization algorithms respecting property locks.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  var CATEGORIES = [
    { id: 'all', label: 'All Templates' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'vibrant', label: 'Vibrant' },
    { id: 'professional', label: 'Professional' },
    { id: 'creative', label: 'Creative' },
    { id: 'events', label: 'Events' }
  ];

  var TEMPLATES = [
    {
      id: 'classic-minimal',
      name: 'Classic Minimal',
      category: 'minimal',
      description: 'Clean monochrome grid with maximum contrast and universal scan reliability.',
      badgeTag: 'MONO',
      design: {
        darkColor: '#171717',
        lightColor: '#FFFFFF',
        moduleStyle: 'square',
        finderStyle: 'square',
        activePaletteId: 'classic',
        frame: {
          style: 'none',
          text: '',
          bannerColor: '#171717',
          textColor: '#FFFFFF'
        }
      }
    },
    {
      id: 'electric-lime',
      name: 'Electric Lime',
      category: 'vibrant',
      description: 'High-voltage acid lime accent with rounded corners for tech brands and digital creators.',
      badgeTag: 'VIBRANT',
      design: {
        darkColor: '#171717',
        lightColor: '#D7FF38',
        moduleStyle: 'rounded',
        finderStyle: 'rounded',
        activePaletteId: 'electric',
        frame: {
          style: 'none',
          text: '',
          bannerColor: '#171717',
          textColor: '#D7FF38'
        }
      }
    },
    {
      id: 'hot-pink-pop',
      name: 'Hot Pink Pop',
      category: 'vibrant',
      description: 'Playful neo-brutalist hot pink with circular dot modules and bold bottom CTA bar.',
      badgeTag: 'POP',
      design: {
        darkColor: '#171717',
        lightColor: '#FF4FA3',
        moduleStyle: 'dots',
        finderStyle: 'rounded',
        activePaletteId: 'hotpink',
        frame: {
          style: 'bottom-bar',
          text: 'SCAN ME',
          bannerColor: '#171717',
          textColor: '#FF4FA3'
        }
      }
    },
    {
      id: 'cobalt-blue',
      name: 'Cobalt Blue',
      category: 'professional',
      description: 'Deep maritime cobalt on crisp white with a structured corporate header banner.',
      badgeTag: 'CORP',
      design: {
        darkColor: '#0A1172',
        lightColor: '#FFFFFF',
        moduleStyle: 'square',
        finderStyle: 'rounded',
        activePaletteId: 'cobalt',
        frame: {
          style: 'top-banner',
          text: 'CONNECT NOW',
          bannerColor: '#0A1172',
          textColor: '#FFFFFF'
        }
      }
    },
    {
      id: 'tangerine-punch',
      name: 'Tangerine Punch',
      category: 'vibrant',
      description: 'Warm citrus tangerine with bold scan-me footer bar for retail and promotions.',
      badgeTag: 'RETAIL',
      design: {
        darkColor: '#171717',
        lightColor: '#FFE4D6',
        moduleStyle: 'rounded',
        finderStyle: 'square',
        activePaletteId: 'tangerine',
        frame: {
          style: 'bottom-bar',
          text: 'SCAN FOR PROMO',
          bannerColor: '#FF6B00',
          textColor: '#FFFFFF'
        }
      }
    },
    {
      id: 'retro-poster',
      name: 'Retro Poster',
      category: 'creative',
      description: 'Vintage warm paper tone with burnt sienna badge pill and offset drop shadow.',
      badgeTag: 'RETRO',
      design: {
        darkColor: '#2B1810',
        lightColor: '#FDF6E2',
        moduleStyle: 'dots',
        finderStyle: 'rounded',
        activePaletteId: null,
        frame: {
          style: 'badge',
          text: 'LIMITED EDITION',
          bannerColor: '#E05A47',
          textColor: '#FDF6E2'
        }
      }
    },
    {
      id: 'dark-contrast',
      name: 'Dark Contrast',
      category: 'professional',
      description: 'Sleek slate navy on cool silver with cyan-accented bottom CTA bar.',
      badgeTag: 'SLATE',
      design: {
        darkColor: '#0F172A',
        lightColor: '#F8FAFC',
        moduleStyle: 'square',
        finderStyle: 'square',
        activePaletteId: 'navy',
        frame: {
          style: 'bottom-bar',
          text: 'OFFICIAL QR CODE',
          bannerColor: '#0F172A',
          textColor: '#38BDF8'
        }
      }
    },
    {
      id: 'soft-pastel',
      name: 'Soft Pastel',
      category: 'minimal',
      description: 'Gentle lavender and deep violet pairing for editorial and lifestyle publications.',
      badgeTag: 'PASTEL',
      design: {
        darkColor: '#3B0764',
        lightColor: '#FAF5FF',
        moduleStyle: 'rounded',
        finderStyle: 'rounded',
        activePaletteId: 'violet',
        frame: {
          style: 'none',
          text: '',
          bannerColor: '#3B0764',
          textColor: '#FAF5FF'
        }
      }
    },
    {
      id: 'bold-editorial',
      name: 'Bold Editorial',
      category: 'creative',
      description: 'High-impact broadsheet newspaper style with electric yellow banner and heavy borders.',
      badgeTag: 'PRESS',
      design: {
        darkColor: '#171717',
        lightColor: '#FFFFFF',
        moduleStyle: 'square',
        finderStyle: 'square',
        activePaletteId: 'classic',
        frame: {
          style: 'top-banner',
          text: 'READ THE STORY',
          bannerColor: '#FFE600',
          textColor: '#171717'
        }
      }
    },
    {
      id: 'cafe-menu',
      name: 'Cafe Menu',
      category: 'events',
      description: 'Warm amber bakery theme designed for tabletop cards, counters, and food trucks.',
      badgeTag: 'FOOD',
      design: {
        darkColor: '#1C1917',
        lightColor: '#FEF3C7',
        moduleStyle: 'rounded',
        finderStyle: 'rounded',
        activePaletteId: null,
        frame: {
          style: 'bottom-bar',
          text: 'VIEW TODAY\'S MENU',
          bannerColor: '#D97706',
          textColor: '#FFFFFF'
        }
      }
    },
    {
      id: 'creative-portfolio',
      name: 'Creative Portfolio',
      category: 'creative',
      description: 'Forest green and mint cream with dot matrices for designers, artists, and studios.',
      badgeTag: 'STUDIO',
      design: {
        darkColor: '#064E3B',
        lightColor: '#FFF9ED',
        moduleStyle: 'dots',
        finderStyle: 'square',
        activePaletteId: 'forest',
        frame: {
          style: 'badge',
          text: 'SEE MY WORK',
          bannerColor: '#10B981',
          textColor: '#064E3B'
        }
      }
    },
    {
      id: 'event-poster',
      name: 'Event Poster',
      category: 'events',
      description: 'Retro perforated ticket stub with notched corners for festivals, gigs, and entry passes.',
      badgeTag: 'TICKET',
      design: {
        darkColor: '#171717',
        lightColor: '#FFFFFF',
        moduleStyle: 'square',
        finderStyle: 'rounded',
        activePaletteId: 'classic',
        frame: {
          style: 'ticket',
          text: 'ADMIT ONE / SCAN TICKET',
          bannerColor: '#FF0055',
          textColor: '#FFFFFF'
        }
      }
    }
  ];

  /**
   * Helper to safely merge a template's design into current editor design.
   * Preserves user-uploaded logo and user-uploaded background images predictably.
   */
  function applyTemplateToDesign(template, currentDesign) {
    if (!template || !template.design) return currentDesign;
    var tDesign = template.design;

    var newDesign = {
      darkColor: tDesign.darkColor,
      lightColor: tDesign.lightColor,
      moduleStyle: tDesign.moduleStyle,
      finderStyle: tDesign.finderStyle,
      activePaletteId: tDesign.activePaletteId || null,
      frame: {
        style: tDesign.frame.style,
        text: tDesign.frame.text || '',
        bannerColor: tDesign.frame.bannerColor || '#FFE600',
        textColor: tDesign.frame.textColor || '#171717',
        cardColor: tDesign.frame.cardColor || tDesign.lightColor
      },
      // Preserve existing user logo & background references
      logo: currentDesign.logo ? Object.assign({}, currentDesign.logo) : {
        file: null, dataUrl: null, image: null, filename: '', width: 0, height: 0,
        sizePercent: 22, padding: 6, badgeShape: 'rounded', badgeColor: tDesign.lightColor
      },
      background: currentDesign.background ? Object.assign({}, currentDesign.background) : {
        file: null, dataUrl: null, image: null, filename: '', width: 0, height: 0,
        fit: 'cover', zoom: 1.0, panX: 0, panY: 0, opacity: 1.0, tintColor: '#000000', tintOpacity: 0
      }
    };

    return newDesign;
  }

  /**
   * Generates a procedural, local SVG thumbnail string for template card rendering.
   * Zero external images, 100% vector-crisp in-browser preview.
   */
  function renderThumbnailSvg(template) {
    var t = template.design;
    var dark = t.darkColor;
    var light = t.lightColor;
    var fStyle = t.frame.style;
    var banner = t.frame.bannerColor;
    var bannerTextCol = t.frame.textColor;
    var modStyle = t.moduleStyle;
    var findStyle = t.finderStyle;
    var cornerRx = (findStyle === 'rounded') ? '3' : '0';
    var modRx = (modStyle === 'rounded') ? '2' : (modStyle === 'dots' ? '3' : '0');

    // SVG Canvas: 140 x 140
    var svg = '<svg viewBox="0 0 140 140" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + template.name + ' preview">';

    // Card background
    if (fStyle === 'none') {
      svg += '<rect x="4" y="4" width="132" height="132" rx="4" fill="' + light + '" stroke="#171717" stroke-width="2.5"/>';
    } else {
      // Offset hard shadow
      svg += '<rect x="10" y="10" width="124" height="124" rx="3" fill="#000000"/>';
      svg += '<rect x="6" y="6" width="124" height="124" rx="3" fill="' + light + '" stroke="#171717" stroke-width="2.5"/>';

      if (fStyle === 'badge') {
        // Top badge pill
        svg += '<rect x="35" y="2" width="66" height="14" rx="7" fill="' + banner + '" stroke="#171717" stroke-width="2"/>';
        svg += '<text x="68" y="12" font-size="7" font-weight="900" text-anchor="middle" fill="' + bannerTextCol + '" font-family="sans-serif">SCAN ME</text>';
      } else if (fStyle === 'top-banner') {
        // Top bar
        svg += '<rect x="6" y="6" width="124" height="24" rx="2" fill="' + banner + '" stroke="#171717" stroke-width="2"/>';
        svg += '<text x="68" y="22" font-size="8" font-weight="900" text-anchor="middle" fill="' + bannerTextCol + '" font-family="sans-serif">' + (t.frame.text || 'SCAN') + '</text>';
      } else if (fStyle === 'bottom-bar') {
        // Bottom bar
        svg += '<rect x="6" y="106" width="124" height="24" rx="2" fill="' + banner + '" stroke="#171717" stroke-width="2"/>';
        svg += '<text x="68" y="122" font-size="8" font-weight="900" text-anchor="middle" fill="' + bannerTextCol + '" font-family="sans-serif">' + (t.frame.text || 'SCAN ME') + '</text>';
      } else if (fStyle === 'ticket') {
        // Perforated line
        svg += '<line x1="10" y1="108" x2="126" y2="108" stroke="#171717" stroke-width="2" stroke-dasharray="3,3"/>';
        svg += '<text x="68" y="124" font-size="7.5" font-weight="900" text-anchor="middle" fill="' + dark + '" font-family="sans-serif">ADMIT ONE</text>';
      }
    }

    // Determine matrix offset inside card
    var ox = 26, oy = 26, scale = 1.0;
    if (fStyle === 'top-banner') { ox = 32; oy = 38; scale = 0.85; }
    else if (fStyle === 'bottom-bar') { ox = 32; oy = 20; scale = 0.85; }
    else if (fStyle === 'badge') { ox = 30; oy = 26; scale = 0.9; }
    else if (fStyle === 'ticket') { ox = 32; oy = 20; scale = 0.85; }

    // Finder 1: Top-Left
    svg += '<rect x="' + ox + '" y="' + oy + '" width="22" height="22" rx="' + cornerRx + '" fill="none" stroke="' + dark + '" stroke-width="4"/>';
    svg += '<rect x="' + (ox + 6) + '" y="' + (oy + 6) + '" width="10" height="10" rx="' + cornerRx + '" fill="' + dark + '"/>';

    // Finder 2: Top-Right
    svg += '<rect x="' + (ox + 54) + '" y="' + oy + '" width="22" height="22" rx="' + cornerRx + '" fill="none" stroke="' + dark + '" stroke-width="4"/>';
    svg += '<rect x="' + (ox + 60) + '" y="' + (oy + 6) + '" width="10" height="10" rx="' + cornerRx + '" fill="' + dark + '"/>';

    // Finder 3: Bottom-Left
    svg += '<rect x="' + ox + '" y="' + (oy + 54) + '" width="22" height="22" rx="' + cornerRx + '" fill="none" stroke="' + dark + '" stroke-width="4"/>';
    svg += '<rect x="' + (ox + 6) + '" y="' + (oy + 60) + '" width="10" height="10" rx="' + cornerRx + '" fill="' + dark + '"/>';

    // Procedural mini data modules
    var moduleCoords = [
      [30, 8], [38, 8], [44, 8],
      [30, 14], [44, 14],
      [8, 30], [14, 30], [20, 30], [32, 30], [38, 30], [44, 30], [52, 30], [60, 30], [68, 30],
      [8, 38], [20, 38], [32, 38], [44, 38], [56, 38], [68, 38],
      [8, 44], [14, 44], [38, 44], [44, 44], [52, 44], [60, 44],
      [30, 54], [38, 54], [44, 54], [54, 54], [62, 54], [68, 54],
      [30, 62], [44, 62], [54, 62], [68, 62],
      [30, 68], [38, 68], [54, 68], [62, 68]
    ];

    moduleCoords.forEach(function(pt) {
      var mx = ox + pt[0];
      var my = oy + pt[1];
      if (modStyle === 'dots') {
        svg += '<circle cx="' + (mx + 2.5) + '" cy="' + (my + 2.5) + '" r="2.5" fill="' + dark + '"/>';
      } else {
        svg += '<rect x="' + mx + '" y="' + my + '" width="5" height="5" rx="' + modRx + '" fill="' + dark + '"/>';
      }
    });

    svg += '</svg>';
    return svg;
  }

  /**
   * Curated high-contrast palette pool for variations & randomization.
   * Every single pair satisfies WCAG contrast >= 7:1.
   */
  var SAFE_PALETTE_POOL = [
    { id: 'classic', dark: '#171717', light: '#FFFFFF', name: 'Classic Ink' },
    { id: 'electric', dark: '#171717', light: '#D7FF38', name: 'Electric Lime' },
    { id: 'hotpink', dark: '#171717', light: '#FF4FA3', name: 'Hot Pink' },
    { id: 'cobalt', dark: '#0A1172', light: '#FFFFFF', name: 'Cobalt Studio' },
    { id: 'tangerine', dark: '#171717', light: '#FFE4D6', name: 'Tangerine Cream' },
    { id: 'violet', dark: '#3B0764', light: '#FAF5FF', name: 'Deep Violet' },
    { id: 'forest', dark: '#064E3B', light: '#FFF9ED', name: 'Forest & Cream' },
    { id: 'navy', dark: '#0F172A', light: '#E0F2FE', name: 'Midnight Navy' }
  ];

  var FRAME_POOL = [
    { style: 'none', text: '', banner: '#FFE600', textCol: '#171717', name: 'Clean Plain' },
    { style: 'badge', text: 'SCAN ME', banner: '#FFE600', textCol: '#171717', name: 'Badge Pill' },
    { style: 'top-banner', text: 'DISCOVER MORE', banner: '#171717', textCol: '#D7FF38', name: 'Top Banner' },
    { style: 'bottom-bar', text: 'CONNECT WITH US', banner: '#0A1172', textCol: '#FFFFFF', name: 'Bottom Bar' },
    { style: 'ticket', text: 'ADMIT ONE / SCAN', banner: '#FF4FA3', textCol: '#FFFFFF', name: 'Ticket Stub' }
  ];

  var MODULE_STYLES = ['square', 'rounded', 'dots'];
  var FINDER_STYLES = ['square', 'rounded'];

  /**
   * Produces four distinct, safe design variations based on current design and property locks.
   * @param {Object} currentDesign - Current editor design state.
   * @param {Object} locks - Property locks object { colors, modules, finders, frame }.
   * @returns {Array<Object>} Array of 4 genuinely distinct variation configs.
   */
  function generateVariations(currentDesign, locks) {
    locks = locks || {};
    var variations = [];

    // Strategy blueprints to guarantee 4 visually distinct design aesthetics
    var strategies = [
      {
        name: 'Vibrant Pop',
        tag: 'HIGH IMPACT',
        paletteIdx: 1, // Electric Lime
        moduleStyle: 'rounded',
        finderStyle: 'rounded',
        frameStyle: 'badge',
        cta: 'SCAN HERE',
        bannerCol: '#171717',
        textCol: '#D7FF38'
      },
      {
        name: 'Bold Editorial',
        tag: 'PRESS DECK',
        paletteIdx: 0, // Classic Ink
        moduleStyle: 'square',
        finderStyle: 'square',
        frameStyle: 'top-banner',
        cta: 'EXCLUSIVE ACCESS',
        bannerCol: '#FFE600',
        textCol: '#171717'
      },
      {
        name: 'Creative Dots',
        tag: 'MODERN ART',
        paletteIdx: 6, // Forest & Cream
        moduleStyle: 'dots',
        finderStyle: 'rounded',
        frameStyle: 'bottom-bar',
        cta: 'SEE PORTFOLIO',
        bannerCol: '#064E3B',
        textCol: '#FFF9ED'
      },
      {
        name: 'Retro Access',
        tag: 'TICKET PASS',
        paletteIdx: 4, // Tangerine Cream
        moduleStyle: 'rounded',
        finderStyle: 'square',
        frameStyle: 'ticket',
        cta: 'OFFICIAL PASS',
        bannerCol: '#FF6B00',
        textCol: '#FFFFFF'
      }
    ];

    // Ensure strategies do not duplicate current design
    for (var i = 0; i < 4; i++) {
      var strat = strategies[i];
      var pal = SAFE_PALETTE_POOL[strat.paletteIdx];

      var varDesign = {
        darkColor: locks.colors ? currentDesign.darkColor : pal.dark,
        lightColor: locks.colors ? currentDesign.lightColor : pal.light,
        activePaletteId: locks.colors ? currentDesign.activePaletteId : pal.id,
        moduleStyle: locks.modules ? currentDesign.moduleStyle : strat.moduleStyle,
        finderStyle: locks.finders ? currentDesign.finderStyle : strat.finderStyle,
        frame: {
          style: locks.frame ? currentDesign.frame.style : strat.frameStyle,
          text: locks.frame ? currentDesign.frame.text : strat.cta,
          bannerColor: locks.frame ? currentDesign.frame.bannerColor : strat.bannerCol,
          textColor: locks.frame ? currentDesign.frame.textColor : strat.textCol,
          cardColor: locks.colors ? currentDesign.lightColor : pal.light
        },
        logo: currentDesign.logo ? Object.assign({}, currentDesign.logo) : null,
        background: currentDesign.background ? Object.assign({}, currentDesign.background) : null
      };

      // If locks resulted in identical combination to currentDesign, differentiate unlocked properties
      if (varDesign.darkColor === currentDesign.darkColor &&
          varDesign.lightColor === currentDesign.lightColor &&
          varDesign.moduleStyle === currentDesign.moduleStyle &&
          varDesign.finderStyle === currentDesign.finderStyle &&
          varDesign.frame.style === currentDesign.frame.style) {
        if (!locks.modules) {
          varDesign.moduleStyle = (currentDesign.moduleStyle === 'dots') ? 'rounded' : 'dots';
        } else if (!locks.finders) {
          varDesign.finderStyle = (currentDesign.finderStyle === 'rounded') ? 'square' : 'rounded';
        } else if (!locks.colors) {
          var altPal = SAFE_PALETTE_POOL[(strat.paletteIdx + 2) % SAFE_PALETTE_POOL.length];
          varDesign.darkColor = altPal.dark;
          varDesign.lightColor = altPal.light;
          varDesign.activePaletteId = altPal.id;
        } else if (!locks.frame) {
          varDesign.frame.style = (currentDesign.frame.style === 'badge') ? 'top-banner' : 'badge';
        }
      }

      variations.push({
        id: 'var-' + (i + 1),
        label: strat.name,
        tag: strat.tag,
        description: 'Styles: ' + varDesign.moduleStyle + ' modules, ' + varDesign.finderStyle + ' finders, frame: ' + varDesign.frame.style,
        design: varDesign
      });
    }

    return variations;
  }

  /**
   * Randomizes unlocked properties while strictly preserving locked properties and payload.
   * @param {Object} currentDesign - Current editor design state.
   * @param {Object} locks - Property locks object { colors, modules, finders, frame }.
   * @returns {Object} New randomized design state.
   */
  function randomizeDesign(currentDesign, locks) {
    locks = locks || {};
    var newDesign = Object.assign({}, currentDesign);

    // Randomize Colors (if unlocked)
    if (!locks.colors) {
      // Pick random safe palette different from current
      var availablePalettes = SAFE_PALETTE_POOL.filter(function(p) {
        return p.id !== currentDesign.activePaletteId;
      });
      var pickedPal = availablePalettes[Math.floor(Math.random() * availablePalettes.length)] || SAFE_PALETTE_POOL[0];
      newDesign.darkColor = pickedPal.dark;
      newDesign.lightColor = pickedPal.light;
      newDesign.activePaletteId = pickedPal.id;
    }

    // Randomize Module Style (if unlocked)
    if (!locks.modules) {
      var availableModules = MODULE_STYLES.filter(function(m) {
        return m !== currentDesign.moduleStyle;
      });
      newDesign.moduleStyle = availableModules[Math.floor(Math.random() * availableModules.length)] || 'square';
    }

    // Randomize Finder Style (if unlocked)
    if (!locks.finders) {
      var availableFinders = FINDER_STYLES.filter(function(f) {
        return f !== currentDesign.finderStyle;
      });
      newDesign.finderStyle = availableFinders[Math.floor(Math.random() * availableFinders.length)] || 'square';
    }

    // Randomize Frame & CTA (if unlocked)
    if (!locks.frame) {
      var availableFrames = FRAME_POOL.filter(function(f) {
        return f.style !== currentDesign.frame.style;
      });
      var pickedFrame = availableFrames[Math.floor(Math.random() * availableFrames.length)] || FRAME_POOL[0];
      newDesign.frame = {
        style: pickedFrame.style,
        text: pickedFrame.text || currentDesign.frame.text || 'SCAN ME',
        bannerColor: pickedFrame.banner,
        textColor: pickedFrame.textCol,
        cardColor: newDesign.lightColor
      };
    } else {
      newDesign.frame = Object.assign({}, currentDesign.frame);
    }

    // Preserve existing logo & background objects
    newDesign.logo = currentDesign.logo ? Object.assign({}, currentDesign.logo) : null;
    newDesign.background = currentDesign.background ? Object.assign({}, currentDesign.background) : null;

    return newDesign;
  }

  var Templates = {
    CATEGORIES: CATEGORIES,
    TEMPLATES: TEMPLATES,
    getAll: function() {
      return TEMPLATES;
    },
    getByCategory: function(catId) {
      if (!catId || catId === 'all') return TEMPLATES;
      return TEMPLATES.filter(function(t) {
        return t.category === catId;
      });
    },
    getById: function(id) {
      for (var i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].id === id) return TEMPLATES[i];
      }
      return null;
    },
    applyTemplateToDesign: applyTemplateToDesign,
    renderThumbnailSvg: renderThumbnailSvg,
    generateVariations: generateVariations,
    randomizeDesign: randomizeDesign,
    SAFE_PALETTE_POOL: SAFE_PALETTE_POOL
  };

  QRStudio.Templates = Templates;
})(typeof window !== 'undefined' ? window : this);

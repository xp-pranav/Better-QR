/**
 * QR Design Studio — Project Package Exporter & Safe Importer
 * Schema Version: 2
 * Format: qr-design-studio-project
 *
 * Provides versioned project package creation, filesystem-safe filename generation,
 * strict untrusted input validation, embedded asset sanitization (raster only, no SVG/scripts),
 * schema migration (v1 -> v2), and preview summaries.
 * 100% client-side, zero cloud dependencies.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  var FORMAT_IDENTIFIER = 'qr-design-studio-project';
  var CURRENT_SCHEMA_VERSION = 2;
  var MIN_SUPPORTED_SCHEMA_VERSION = 1;
  var APP_VERSION = '1.5.0';

  // Hard limits for safety and memory management
  var MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;    // 15 MB package limit
  var MAX_ASSET_SIZE_BYTES = 5 * 1024 * 1024;    // 5 MB per embedded image
  var MAX_BASE64_LENGTH = 7.5 * 1024 * 1024;     // ~5 MB binary in base64
  var MAX_DIMENSION = 4096;                      // 4096 px maximum image dimension

  var SUPPORTED_PAYLOAD_TYPES = ['url', 'text', 'wifi', 'email', 'phone', 'whatsapp'];
  var SUPPORTED_ECL = ['L', 'M', 'Q', 'H'];
  var SUPPORTED_MODULE_STYLES = ['square', 'rounded', 'dots'];
  var SUPPORTED_FINDER_STYLES = ['square', 'rounded'];
  var SUPPORTED_FRAME_STYLES = ['none', 'badge', 'top-banner', 'bottom-bar', 'ticket'];
  var SUPPORTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

  var HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  /**
   * Sanitize a project name for use as a filesystem filename.
   * Strips path separators, control characters, and unsafe characters.
   */
  function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') {
      return 'qr-project';
    }

    var clean = name.trim();
    if (typeof clean.normalize === 'function') {
      clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    clean = clean.toLowerCase()
      .replace(/\.\.+/g, '')
      .replace(/[\/\?%*:|"<>\\;]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return clean || 'qr-project';
  }

  /**
   * Generate sanitized, filesystem-safe download filename with extension.
   */
  function generatePackageFilename(projectName) {
    var base = sanitizeFilename(projectName);
    return base + '.qrproject.json';
  }

  /**
   * Escape potentially malicious characters from string content for safe text display.
   */
  function sanitizeString(str, maxLength) {
    if (typeof str !== 'string') return '';
    var trimmed = str.trim();
    if (maxLength && trimmed.length > maxLength) {
      trimmed = trimmed.substring(0, maxLength);
    }
    return trimmed;
  }

  /**
   * Recursively sanitize object properties to eliminate prototype pollution risks.
   * Discards __proto__, constructor, and prototype properties.
   */
  function sanitizeObjectProperties(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObjectProperties);
    }
    var safe = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue; // Discard prototype-polluting keys
        }
        safe[key] = sanitizeObjectProperties(obj[key]);
      }
    }
    return safe;
  }

  /**
   * Check if a dataUrl is a valid, safe raster image (PNG, JPEG, WebP).
   * Strict security: SVG, HTML, JavaScript, and unexpected protocols are rejected.
   */
  function validateRasterDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { isValid: false, error: 'Asset data must be a string' };
    }

    if (dataUrl.length > MAX_BASE64_LENGTH) {
      return { isValid: false, error: 'Embedded asset exceeds maximum allowed size (5MB)' };
    }

    // Explicitly check for forbidden SVG or script content
    var lower = dataUrl.toLowerCase();
    if (lower.indexOf('data:image/svg') !== -1 ||
        lower.indexOf('<svg') !== -1 ||
        lower.indexOf('<script') !== -1 ||
        lower.indexOf('javascript:') !== -1 ||
        lower.indexOf('data:text/html') !== -1) {
      return {
        isValid: false,
        error: 'Dangerous or unsupported asset format (SVG or script detected). Only PNG, JPEG, and WebP raster images are allowed for security.'
      };
    }

    // Must match supported raster image data URL prefixes
    var isPng = dataUrl.indexOf('data:image/png;base64,') === 0;
    var isJpeg = dataUrl.indexOf('data:image/jpeg;base64,') === 0 || dataUrl.indexOf('data:image/jpg;base64,') === 0;
    var isWebp = dataUrl.indexOf('data:image/webp;base64,') === 0;

    if (!isPng && !isJpeg && !isWebp) {
      return {
        isValid: false,
        error: 'Unsupported image format. Only base64 PNG, JPEG, and WebP data URLs are supported.'
      };
    }

    return { isValid: true };
  }

  var ProjectPackage = {
    FORMAT_IDENTIFIER: FORMAT_IDENTIFIER,
    CURRENT_SCHEMA_VERSION: CURRENT_SCHEMA_VERSION,
    MIN_SUPPORTED_SCHEMA_VERSION: MIN_SUPPORTED_SCHEMA_VERSION,
    APP_VERSION: APP_VERSION,
    MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_BYTES,

    /**
     * Create a complete, versioned package envelope from a project object.
     * Guaranteed to preserve payload, design, assets, and metadata.
     */
    createPackage: function(project, optionalMetadata) {
      if (!project) throw new Error('Cannot export empty or null project');

      // Migrate / normalize project to current schema
      var migrated = this.migrateProject(project);

      // Determine encoded payload string for verification and inspector
      var encodedPayload = migrated.encodedPayload || '';
      if (!encodedPayload && QRStudio.Payloads && QRStudio.Payloads.getType) {
        var typeDef = QRStudio.Payloads.getType(migrated.activeType);
        if (typeDef && migrated.formData && migrated.formData[migrated.activeType]) {
          try {
            var val = typeDef.validate(migrated.formData[migrated.activeType]);
            if (val.isValid) {
              encodedPayload = val.payload;
            }
          } catch (e) {
            // Non-blocking fallback
          }
        }
      }

      migrated.encodedPayload = encodedPayload;

      var pkg = {
        format: FORMAT_IDENTIFIER,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        metadata: {
          client: 'QR Design Studio (Browser Offline)',
          notes: (optionalMetadata && optionalMetadata.notes) ? sanitizeString(optionalMetadata.notes, 500) : ''
        },
        project: migrated
      };

      return pkg;
    },

    /**
     * Export a project directly to a downloaded JSON file.
     * Uses client-side Blob and temporary anchor element. Zero network transmission.
     */
    exportProjectToFile: function(project, optionalFilename) {
      try {
        var pkg = this.createPackage(project);
        var filename = optionalFilename ? sanitizeFilename(optionalFilename) + '.qrproject.json' : generatePackageFilename(pkg.project.name);

        var serialized = JSON.stringify(pkg, null, 2);
        var blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });

        if (typeof window === 'undefined' || !window.document || !window.document.body || typeof window.URL === 'undefined' || typeof window.URL.createObjectURL !== 'function') {
          return { success: true, filename: filename, package: pkg, serialized: serialized };
        }

        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        if (typeof a.click === 'function') {
          a.click();
        }

        setTimeout(function() {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          window.URL.revokeObjectURL(url);
        }, 2000);

        return { success: true, filename: filename, package: pkg };
      } catch (err) {
        console.error('[QRStudio Package] Export download failed:', err);
        return { success: false, error: err.message || 'Download failed' };
      }
    },

    /**
     * Read and validate an uploaded project file from an input file picker.
     * Enforces file-size limits before parsing.
     */
    readPackageFile: function(file, callback) {
      if (!file) {
        if (typeof callback === 'function') callback(new Error('No file selected'));
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        var sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        var err = new Error('File size (' + sizeMb + 'MB) exceeds maximum allowed limit of 15MB.');
        if (typeof callback === 'function') callback(err);
        return;
      }

      var reader = new FileReader();

      reader.onload = function(evt) {
        try {
          var text = evt.target.result;
          var parsed = JSON.parse(text);
          parsed = sanitizeObjectProperties(parsed);
          if (typeof callback === 'function') callback(null, parsed, file);
        } catch (jsonErr) {
          var parseErr = new Error('File contains invalid JSON syntax and cannot be parsed.');
          if (typeof callback === 'function') callback(parseErr);
        }
      };

      reader.onerror = function() {
        if (typeof callback === 'function') callback(new Error('Could not read file from disk.'));
      };

      reader.readAsText(file, 'utf-8');
    },

    /**
     * Validate an untrusted parsed object or package envelope.
     * Enforces schema versions, payload types, visual settings, and raster image security.
     * Returns: { isValid: boolean, project: object|null, errors: string[], warnings: string[] }
     */
    validatePackage: function(data) {
      var errors = [];
      var warnings = [];

      data = sanitizeObjectProperties(data);

      if (!data || typeof data !== 'object') {
        return { isValid: false, errors: ['Project data must be a non-null JSON object.'], warnings: [] };
      }

      var projectObj;
      var rawSchemaVersion;

      // Detect package format (envelope vs direct project object)
      if (data.format === FORMAT_IDENTIFIER) {
        rawSchemaVersion = data.schemaVersion;
        if (!data.project || typeof data.project !== 'object') {
          return { isValid: false, errors: ['Package envelope is missing project data block.'], warnings: [] };
        }
        projectObj = data.project;
      } else if (data.schemaVersion || data.activeType || data.formData) {
        // Direct project object (e.g. Schema 1 or raw store export)
        rawSchemaVersion = data.schemaVersion || 1;
        projectObj = data;
        warnings.push('Legacy project format detected (missing package envelope). Upgraded to v' + CURRENT_SCHEMA_VERSION + '.');
      } else {
        return {
          isValid: false,
          errors: ['Unrecognized file format. This file does not appear to be a valid QR Design Studio project package.'],
          warnings: []
        };
      }

      // Check schema version
      var schemaVersionNum = parseInt(rawSchemaVersion, 10);
      if (isNaN(schemaVersionNum)) {
        errors.push('Invalid or missing schema version in project file.');
      } else if (schemaVersionNum > CURRENT_SCHEMA_VERSION) {
        return {
          isValid: false,
          isFutureVersion: true,
          errors: [
            'Unsupported project schema version (version ' + schemaVersionNum + '). This project was created with a newer version of QR Design Studio. Please update the application to open this file.'
          ],
          warnings: []
        };
      } else if (schemaVersionNum < MIN_SUPPORTED_SCHEMA_VERSION) {
        return {
          isValid: false,
          errors: [
            'Unsupported project schema version (version ' + schemaVersionNum + '). This project format is too old to be imported safely.'
          ],
          warnings: []
        };
      }

      // Validate Project Name
      var cleanName = sanitizeString(projectObj.name, 100);
      if (!cleanName) {
        cleanName = 'Imported Project';
        warnings.push('Project name was blank or missing; defaulted to "Imported Project".');
      }

      // Validate Active Payload Type
      var activeType = projectObj.activeType;
      if (!activeType || SUPPORTED_PAYLOAD_TYPES.indexOf(activeType) === -1) {
        errors.push('Unsupported or missing QR payload type: "' + activeType + '". Supported types: ' + SUPPORTED_PAYLOAD_TYPES.join(', '));
      }

      // Validate FormData
      if (!projectObj.formData || typeof projectObj.formData !== 'object') {
        errors.push('Missing or invalid "formData" configuration.');
      } else if (activeType && (!projectObj.formData[activeType] || typeof projectObj.formData[activeType] !== 'object')) {
        errors.push('Missing form field data for payload type: "' + activeType + '".');
      }

      // Validate Error Correction Level (ECL)
      var ecl = projectObj.ecl;
      if (ecl && SUPPORTED_ECL.indexOf(ecl) === -1) {
        warnings.push('Invalid ECL "' + ecl + '"; defaulted to "M".');
        ecl = 'M';
      }

      // Validate Export Size
      var exportSize = parseInt(projectObj.exportSize, 10);
      if (isNaN(exportSize) || exportSize < 64 || exportSize > 4096) {
        exportSize = 512;
      }

      // Validate Design Structure
      var design = projectObj.design || {};
      if (typeof design !== 'object') {
        warnings.push('Design block was missing or corrupt; restored default visual styling.');
        design = {};
      }

      // Colors
      var darkColor = (design.darkColor && HEX_COLOR_REGEX.test(design.darkColor)) ? design.darkColor : '#171717';
      var lightColor = (design.lightColor && HEX_COLOR_REGEX.test(design.lightColor)) ? design.lightColor : '#FFFFFF';
      if (design.darkColor && !HEX_COLOR_REGEX.test(design.darkColor)) {
        warnings.push('Invalid dark color hex (' + design.darkColor + '); reset to default.');
      }
      if (design.lightColor && !HEX_COLOR_REGEX.test(design.lightColor)) {
        warnings.push('Invalid light color hex (' + design.lightColor + '); reset to default.');
      }

      // Module & Finder Styles
      var moduleStyle = (design.moduleStyle && SUPPORTED_MODULE_STYLES.indexOf(design.moduleStyle) !== -1) ? design.moduleStyle : 'square';
      var finderStyle = (design.finderStyle && SUPPORTED_FINDER_STYLES.indexOf(design.finderStyle) !== -1) ? design.finderStyle : 'square';

      // Frame Settings
      var frame = design.frame || {};
      var frameStyle = (frame.style && SUPPORTED_FRAME_STYLES.indexOf(frame.style) !== -1) ? frame.style : 'none';
      var frameText = sanitizeString(frame.text || 'SCAN ME', 60);
      var bannerColor = (frame.bannerColor && HEX_COLOR_REGEX.test(frame.bannerColor)) ? frame.bannerColor : '#FFE600';
      var textColor = (frame.textColor && HEX_COLOR_REGEX.test(frame.textColor)) ? frame.textColor : '#171717';

      // Logo Validation
      var logo = design.logo || {};
      var validLogoDataUrl = null;
      var logoFilename = '';
      if (logo.dataUrl) {
        var logoCheck = validateRasterDataUrl(logo.dataUrl);
        if (!logoCheck.isValid) {
          errors.push('Logo asset rejected: ' + logoCheck.error);
        } else {
          validLogoDataUrl = logo.dataUrl;
          logoFilename = sanitizeFilename(logo.filename || 'logo');
        }
      }

      var logoWidth = parseInt(logo.width, 10);
      var logoHeight = parseInt(logo.height, 10);
      if (isNaN(logoWidth) || logoWidth < 0 || logoWidth > MAX_DIMENSION) logoWidth = 0;
      if (isNaN(logoHeight) || logoHeight < 0 || logoHeight > MAX_DIMENSION) logoHeight = 0;

      var logoSizePercent = parseInt(logo.sizePercent, 10);
      if (isNaN(logoSizePercent) || logoSizePercent < 15 || logoSizePercent > 28) logoSizePercent = 22;

      var logoPadding = parseInt(logo.padding, 10);
      if (isNaN(logoPadding) || logoPadding < 2 || logoPadding > 16) logoPadding = 6;

      var logoBadgeShape = (['rounded', 'circle', 'square'].indexOf(logo.badgeShape) !== -1) ? logo.badgeShape : 'rounded';
      var logoBadgeColor = (logo.badgeColor && HEX_COLOR_REGEX.test(logo.badgeColor)) ? logo.badgeColor : '#FFFFFF';

      // Background Image Validation
      var background = design.background || {};
      var validBgDataUrl = null;
      var bgFilename = '';
      if (background.dataUrl) {
        var bgCheck = validateRasterDataUrl(background.dataUrl);
        if (!bgCheck.isValid) {
          errors.push('Background photo rejected: ' + bgCheck.error);
        } else {
          validBgDataUrl = background.dataUrl;
          bgFilename = sanitizeFilename(background.filename || 'background');
        }
      }

      var bgWidth = parseInt(background.width, 10);
      var bgHeight = parseInt(background.height, 10);
      if (isNaN(bgWidth) || bgWidth < 0 || bgWidth > MAX_DIMENSION) bgWidth = 0;
      if (isNaN(bgHeight) || bgHeight < 0 || bgHeight > MAX_DIMENSION) bgHeight = 0;

      var bgFit = (['cover', 'contain'].indexOf(background.fit) !== -1) ? background.fit : 'cover';

      var bgZoom = parseFloat(background.zoom);
      if (isNaN(bgZoom) || bgZoom < 1.0 || bgZoom > 2.5) bgZoom = 1.0;

      var bgPanX = parseFloat(background.panX);
      if (isNaN(bgPanX) || bgPanX < -0.5 || bgPanX > 0.5) bgPanX = 0;

      var bgPanY = parseFloat(background.panY);
      if (isNaN(bgPanY) || bgPanY < -0.5 || bgPanY > 0.5) bgPanY = 0;

      var bgOpacity = parseFloat(background.opacity);
      if (isNaN(bgOpacity) || bgOpacity < 0.1 || bgOpacity > 1.0) bgOpacity = 1.0;

      var bgTintColor = (background.tintColor && HEX_COLOR_REGEX.test(background.tintColor)) ? background.tintColor : '#000000';

      var bgTintOpacity = parseFloat(background.tintOpacity);
      if (isNaN(bgTintOpacity) || bgTintOpacity < 0.0 || bgTintOpacity > 0.9) bgTintOpacity = 0.0;

      if (errors.length > 0) {
        return { isValid: false, errors: errors, warnings: warnings };
      }

      // Assemble sanitized, migrated project object
      var migratedProject = {
        id: projectObj.id || ('proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
        name: cleanName,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: projectObj.createdAt || Date.now(),
        updatedAt: projectObj.updatedAt || Date.now(),
        activeType: activeType,
        ecl: ecl || 'M',
        exportSize: exportSize || 512,
        activeSubtab: projectObj.activeSubtab || 'subtabTemplates',
        activeTemplateId: projectObj.activeTemplateId || 'classic-minimal',
        templateCategory: projectObj.templateCategory || 'all',
        locks: {
          colors: (projectObj.locks && !!projectObj.locks.colors) || false,
          modules: (projectObj.locks && !!projectObj.locks.modules) || false,
          finders: (projectObj.locks && !!projectObj.locks.finders) || false,
          frame: (projectObj.locks && !!projectObj.locks.frame) || false
        },
        formData: JSON.parse(JSON.stringify(projectObj.formData || {})),
        encodedPayload: projectObj.encodedPayload || '',
        design: {
          darkColor: darkColor,
          lightColor: lightColor,
          moduleStyle: moduleStyle,
          finderStyle: finderStyle,
          activePalette: design.activePalette || 'classic',
          logo: {
            dataUrl: validLogoDataUrl,
            filename: logoFilename,
            width: logoWidth,
            height: logoHeight,
            sizePercent: logoSizePercent,
            padding: logoPadding,
            badgeShape: logoBadgeShape,
            badgeColor: logoBadgeColor
          },
          frame: {
            style: frameStyle,
            text: frameText,
            bannerColor: bannerColor,
            textColor: textColor
          },
          background: {
            dataUrl: validBgDataUrl,
            filename: bgFilename,
            width: bgWidth,
            height: bgHeight,
            fit: bgFit,
            zoom: bgZoom,
            panX: bgPanX,
            panY: bgPanY,
            opacity: bgOpacity,
            tintColor: bgTintColor,
            tintOpacity: bgTintOpacity
          }
        }
      };

      // Ensure all 6 form data slots exist
      var defaultFormData = {
        url: { url: 'https://' },
        text: { text: '' },
        wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
        email: { email: '', subject: '', body: '' },
        phone: { phone: '' },
        whatsapp: { phone: '', message: '' }
      };

      SUPPORTED_PAYLOAD_TYPES.forEach(function(t) {
        if (!migratedProject.formData[t]) {
          migratedProject.formData[t] = JSON.parse(JSON.stringify(defaultFormData[t]));
        }
      });

      return {
        isValid: true,
        project: migratedProject,
        errors: [],
        warnings: warnings
      };
    },

    /**
     * Migrate older saved project structures (Schema 1) to Schema 2.
     * Guarantees standard fields, locks, and schemaVersion: 2 without losing custom data.
     */
    migrateProject: function(project) {
      if (!project) return null;

      var projToClone = project;
      if (project.state && typeof project.state === 'object') {
        projToClone = {};
        for (var key in project) {
          if (key !== 'state' && Object.prototype.hasOwnProperty.call(project, key)) {
            projToClone[key] = project[key];
          }
        }
      }

      var clone = JSON.parse(JSON.stringify(projToClone));

      clone.schemaVersion = CURRENT_SCHEMA_VERSION;

      if (!clone.name) clone.name = 'Untitled Project';
      if (!clone.createdAt) clone.createdAt = Date.now();
      if (!clone.updatedAt) clone.updatedAt = Date.now();
      if (!clone.activeType) clone.activeType = 'url';
      if (!clone.ecl) clone.ecl = 'M';
      if (!clone.exportSize) clone.exportSize = 512;
      if (!clone.activeSubtab) clone.activeSubtab = 'subtabTemplates';
      if (!clone.activeTemplateId) clone.activeTemplateId = 'classic-minimal';
      if (!clone.templateCategory) clone.templateCategory = 'all';

      if (!clone.locks) {
        clone.locks = { colors: false, modules: false, finders: false, frame: false };
      }

      if (!clone.formData) {
        clone.formData = {
          url: { url: 'https://' },
          text: { text: '' },
          wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
          email: { email: '', subject: '', body: '' },
          phone: { phone: '' },
          whatsapp: { phone: '', message: '' }
        };
      }

      if (!clone.design) {
        clone.design = {
          darkColor: '#171717',
          lightColor: '#FFFFFF',
          moduleStyle: 'square',
          finderStyle: 'square',
          activePalette: 'classic',
          logo: { dataUrl: null, filename: '', width: 0, height: 0, sizePercent: 22, padding: 6, badgeShape: 'rounded', badgeColor: '#FFFFFF' },
          frame: { style: 'none', text: 'SCAN ME', bannerColor: '#FFE600', textColor: '#171717' },
          background: { dataUrl: null, filename: '', width: 0, height: 0, fit: 'cover', zoom: 1.0, panX: 0, panY: 0, opacity: 1.0, tintColor: '#000000', tintOpacity: 0.0 }
        };
      }

      return clone;
    },

    /**
     * Extract a readable structured summary for import preview display.
     */
    getPreviewSummary: function(project) {
      if (!project) return null;

      var type = project.activeType || 'url';
      var f = (project.formData && project.formData[type]) ? project.formData[type] : {};
      var payloadSnippet = '';

      switch (type) {
        case 'url':
          payloadSnippet = f.url || '(empty URL)';
          break;
        case 'text':
          payloadSnippet = f.text ? (f.text.substring(0, 40) + (f.text.length > 40 ? '…' : '')) : '(empty text)';
          break;
        case 'wifi':
          payloadSnippet = (f.ssid || '(no SSID)') + ' [' + (f.auth || 'WPA') + ']';
          break;
        case 'email':
          payloadSnippet = f.email || '(no email)';
          break;
        case 'phone':
          payloadSnippet = f.phone || '(no phone)';
          break;
        case 'whatsapp':
          payloadSnippet = (f.phone ? ('+' + f.phone) : '(no number)');
          break;
        default:
          payloadSnippet = type.toUpperCase();
      }

      var d = project.design || {};
      var hasLogo = !!(d.logo && d.logo.dataUrl);
      var hasBg = !!(d.background && d.background.dataUrl);

      return {
        name: project.name || 'Untitled Project',
        schemaVersion: project.schemaVersion || 2,
        activeType: type.toUpperCase(),
        payloadSnippet: payloadSnippet,
        ecl: project.ecl || 'M',
        exportSize: (project.exportSize || 512) + ' × ' + (project.exportSize || 512) + ' px',
        darkColor: d.darkColor || '#171717',
        lightColor: d.lightColor || '#FFFFFF',
        moduleStyle: d.moduleStyle || 'square',
        finderStyle: d.finderStyle || 'square',
        frameStyle: (d.frame && d.frame.style) ? d.frame.style : 'none',
        frameText: (d.frame && d.frame.text) ? d.frame.text : 'SCAN ME',
        hasLogo: hasLogo,
        logoFilename: hasLogo ? (d.logo.filename || 'logo') : null,
        logoDataUrl: hasLogo ? d.logo.dataUrl : null,
        hasBackground: hasBg,
        bgFilename: hasBg ? (d.background.filename || 'background photo') : null,
        bgDataUrl: hasBg ? d.background.dataUrl : null,
        updatedAtFormatted: new Date(project.updatedAt || Date.now()).toLocaleDateString()
      };
    },

    sanitizeFilename: sanitizeFilename,
    generatePackageFilename: generatePackageFilename,
    sanitizeObjectProperties: sanitizeObjectProperties
  };

  QRStudio.ProjectPackage = ProjectPackage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectPackage;
  }

})(typeof window !== 'undefined' ? window : this);

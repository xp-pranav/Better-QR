/**
 * QR Design Studio — QR Engine Adapter
 * Integrates vendor/qrcode.js with UTF-8 support, quiet zone preservation,
 * and crisp canvas rendering.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  // Verify and configure UTF-8 byte conversion in qrcode-generator
  if (typeof qrcode !== 'undefined' && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  var Engine = {
    /**
     * Valid Error Correction Levels
     */
    ERROR_CORRECTION_LEVELS: {
      L: { name: 'Low', recovery: '~7%' },
      M: { name: 'Medium', recovery: '~15%' },
      Q: { name: 'Quartile', recovery: '~25%' },
      H: { name: 'High', recovery: '~30%' }
    },

    /**
     * Generate QR Matrix model from text payload.
     * @param {string} payload - Text or encoded URI to encode.
     * @param {string} errorCorrectionLevel - 'L', 'M', 'Q', or 'H'.
     * @returns {Object} QR matrix metadata and helper functions.
     */
    generate: function(payload, errorCorrectionLevel) {
      if (typeof qrcode === 'undefined') {
        throw new Error('QR generation engine is unavailable. Please verify vendor/qrcode.js is loaded.');
      }

      var ecl = errorCorrectionLevel || 'M';
      if (!this.ERROR_CORRECTION_LEVELS[ecl]) {
        ecl = 'M';
      }

      if (!payload || typeof payload !== 'string' || payload.length === 0) {
        throw new Error('Payload cannot be empty.');
      }

      try {
        // typeNumber = 0 enables automatic version selection (1 to 40)
        var qr = qrcode(0, ecl);
        qr.addData(payload, 'Byte');
        qr.make();

        var moduleCount = qr.getModuleCount();
        var version = (moduleCount - 17) / 4;

        return {
          moduleCount: moduleCount,
          version: version,
          ecl: ecl,
          payload: payload,
          getModuleCount: function() {
            return moduleCount;
          },
          isDark: function(row, col) {
            return qr.isDark(row, col);
          }
        };
      } catch (err) {
        var msg = err ? (err.message || String(err)) : 'Unknown error';
        if (msg.indexOf('code length overflow') !== -1) {
          throw new Error('Payload exceeds maximum QR code capacity for the chosen error correction level. Try shortening your content or using a lower error correction level.');
        }
        throw new Error('Failed to generate QR code: ' + msg);
      }
    },

    /**
     * Render the QR matrix cleanly to an HTML5 canvas element with quiet zone and design styles.
     * @param {Object} qrModel - Generated QR model.
     * @param {HTMLCanvasElement} canvas - Target canvas element.
     * @param {Object} [options] - Custom rendering options.
     * @param {number} [options.size=512] - Target canvas dimension in pixels.
     * @param {number} [options.margin=4] - Module margin for quiet zone.
     * @param {string} [options.darkColor='#000000'] - Foreground/dark module color.
     * @param {string} [options.lightColor='#FFFFFF'] - Background/light color.
     * @param {'square'|'rounded'|'dots'} [options.moduleStyle='square'] - Data module shape.
     * @param {'square'|'rounded'} [options.finderStyle='square'] - Finder pattern corner style.
     */
    /**
     * Render the QR matrix cleanly to an HTML5 canvas element with quiet zone and design styles.
     * Backwards-compatible facade that delegates directly to renderComposition.
     */
    renderToCanvas: function(qrModel, canvas, options) {
      return this.renderComposition(qrModel, canvas, options);
    },

    /**
     * Cross-platform rounded rectangle drawing helper.
     */
    _drawRoundRect: function(ctx, x, y, w, h, radius, fillStyle, strokeStyle, lineWidth) {
      if (w <= 0 || h <= 0) return;
      var r = Math.min(radius, Math.min(w / 2, h / 2));
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
      }
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
      }
      if (fillStyle) {
        ctx.fill();
      }
      if (strokeStyle && lineWidth > 0) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    },

    /**
     * Comprehensive multi-layer canvas composition engine for V1.2.
     * Composites: Background Image -> Frame & Backing Card -> QR Code Matrix -> Center Logo & Badge.
     *
     * @param {Object} qrModel - Generated QR model from QRStudio.Engine.generate().
     * @param {HTMLCanvasElement} canvas - Target canvas element.
     * @param {Object} [options] - Composition options.
     */
    renderComposition: function(qrModel, canvas, options) {
      if (!qrModel || !canvas) {
        return;
      }

      options = options || {};
      var targetWidth = parseInt(options.width || options.size, 10) || 512;
      var targetHeight = parseInt(options.height || options.size, 10) || targetWidth;
      var margin = typeof options.margin === 'number' ? options.margin : 4; // ISO quiet zone (default 4)
      var darkColor = options.darkColor || '#000000';
      var lightColor = options.lightColor || '#FFFFFF';
      var moduleStyle = options.moduleStyle || 'square';
      var finderStyle = options.finderStyle || 'square';
      var transparentBackground = !!options.transparentBackground;
      var compFit = options.fit || 'contain';

      // Fallbacks
      if (moduleStyle !== 'square' && moduleStyle !== 'rounded' && moduleStyle !== 'dots') {
        moduleStyle = 'square';
      }
      if (finderStyle !== 'square' && finderStyle !== 'rounded') {
        finderStyle = 'square';
      }

      // Support non-square canvas: center square QR composition inside targetWidth x targetHeight
      var compDim = (targetWidth === targetHeight) ? targetWidth :
        ((compFit === 'cover') ? Math.max(targetWidth, targetHeight) : Math.min(targetWidth, targetHeight));
      var compX = Math.floor((targetWidth - compDim) / 2);
      var compY = Math.floor((targetHeight - compDim) / 2);
      var scale = compDim / 512;
      var moduleCount = qrModel.moduleCount;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      var ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('2D Canvas context could not be obtained.');
      }

      ctx.imageSmoothingQuality = 'high';

      // Options extraction
      var bgOpts = options.background || {};
      var frameOpts = options.frame || {};
      var logoOpts = options.logo || {};

      var frameStyle = frameOpts.style || 'none';
      var hasBgImage = !!(bgOpts.image && (bgOpts.image.complete !== false) && bgOpts.image.width > 0);
      var hasLogo = !!(logoOpts.image && (logoOpts.image.complete !== false) && logoOpts.image.width > 0);

      // --- LAYER 1: CANVAS BASE & BACKGROUND IMAGE ---
      if (hasBgImage) {
        // Draw base neutral color if not transparent
        if (!transparentBackground) {
          ctx.fillStyle = '#E5E5E5';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        } else {
          ctx.clearRect(0, 0, targetWidth, targetHeight);
        }

        var bgImg = bgOpts.image;
        var fit = bgOpts.fit || 'cover';
        var bgOpacity = typeof bgOpts.opacity === 'number' ? Math.max(0.05, Math.min(1, bgOpts.opacity)) : 1.0;
        var bgZoom = typeof bgOpts.zoom === 'number' ? Math.max(1.0, Math.min(3.0, bgOpts.zoom)) : 1.0;
        var bgPanX = typeof bgOpts.panX === 'number' ? Math.max(-0.5, Math.min(0.5, bgOpts.panX)) : 0;
        var bgPanY = typeof bgOpts.panY === 'number' ? Math.max(-0.5, Math.min(0.5, bgOpts.panY)) : 0;

        ctx.save();
        ctx.globalAlpha = bgOpacity;

        var imgRatio = bgImg.width / bgImg.height;
        var canvasRatio = targetWidth / targetHeight;

        var dx = 0, dy = 0, dw = targetWidth, dh = targetHeight;
        var sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;

        if (fit === 'cover') {
          if (imgRatio > canvasRatio) {
            sw = (bgImg.height * canvasRatio) / bgZoom;
            sh = bgImg.height / bgZoom;
            var maxSx = bgImg.width - sw;
            sx = Math.max(0, Math.min(maxSx, (maxSx / 2) + (bgPanX * maxSx)));
            var maxSy = bgImg.height - sh;
            sy = Math.max(0, Math.min(maxSy, (maxSy / 2) + (bgPanY * maxSy)));
          } else {
            sw = bgImg.width / bgZoom;
            sh = (bgImg.width / canvasRatio) / bgZoom;
            var maxSx = bgImg.width - sw;
            sx = Math.max(0, Math.min(maxSx, (maxSx / 2) + (bgPanX * maxSx)));
            var maxSy = bgImg.height - sh;
            sy = Math.max(0, Math.min(maxSy, (maxSy / 2) + (bgPanY * maxSy)));
          }
          ctx.drawImage(bgImg, sx, sy, sw, sh, dx, dy, dw, dh);
        } else {
          // 'contain'
          if (imgRatio > canvasRatio) {
            dh = (targetWidth / imgRatio) * bgZoom;
            dw = targetWidth * bgZoom;
            dx = (targetWidth - dw) / 2 + (bgPanX * targetWidth);
            dy = (targetHeight - dh) / 2 + (bgPanY * targetHeight);
          } else {
            dw = (targetHeight * imgRatio) * bgZoom;
            dh = targetHeight * bgZoom;
            dx = (targetWidth - dw) / 2 + (bgPanX * targetWidth);
            dy = (targetHeight - dh) / 2 + (bgPanY * targetHeight);
          }
          ctx.drawImage(bgImg, dx, dy, dw, dh);
        }
        ctx.restore();

        // Optional Color Tint Overlay
        var tintOpacity = typeof bgOpts.tintOpacity === 'number' ? bgOpts.tintOpacity : 0;
        if (tintOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(0.95, tintOpacity);
          ctx.fillStyle = bgOpts.tintColor || '#000000';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.restore();
        }
      } else {
        // If no background image:
        if (transparentBackground) {
          ctx.clearRect(0, 0, targetWidth, targetHeight);
        } else if (frameStyle === 'none') {
          // Default: clean canvas filled with lightColor
          ctx.fillStyle = lightColor;
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        } else {
          // Framed design with no background image: filled with frame card background or crisp off-white
          ctx.fillStyle = '#F5F3ED';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }
      }

      // --- LAYER 2: FRAMES & CTA BANNERS ---
      var qrArea = {
        x: compX,
        y: compY,
        width: compDim,
        height: compDim
      };

      var ctaText = (frameOpts.text || '').trim();
      var bannerColor = frameOpts.bannerColor || '#FFE600';
      var ctaTextColor = frameOpts.textColor || '#171717';
      var cardColor = frameOpts.cardColor || lightColor;
      var strokeColor = '#171717';

      var self = this;

      if (frameStyle === 'badge') {
        var cardPad = Math.round(18 * scale);
        var shadowOffset = Math.round(8 * scale);
        var cardBorder = Math.max(2, Math.round(4 * scale));

        var cardX = compX + cardPad;
        var cardY = compY + cardPad + Math.round(14 * scale);
        var cardW = compDim - (cardPad * 2) - shadowOffset;
        var cardH = compDim - (cardPad * 2) - shadowOffset;

        // Hard offset shadow
        ctx.fillStyle = '#000000';
        ctx.fillRect(cardX + shadowOffset, cardY + shadowOffset, cardW, cardH);

        // Card backing
        ctx.fillStyle = cardColor;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.lineWidth = cardBorder;
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Header Badge Pill
        var badgeText = ctaText || 'SCAN ME';
        var badgeH = Math.round(28 * scale);
        var badgePadH = Math.round(18 * scale);
        var fontSize = Math.round(14 * scale);

        ctx.font = '900 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        var textMetrics = ctx.measureText(badgeText);
        var badgeW = Math.min(cardW - 20, Math.max(100 * scale, textMetrics.width + (badgePadH * 2)));
        var badgeX = cardX + (cardW - badgeW) / 2;
        var badgeY = cardY - (badgeH / 2);

        // Badge shadow
        ctx.fillStyle = '#000000';
        ctx.fillRect(badgeX + Math.round(3 * scale), badgeY + Math.round(3 * scale), badgeW, badgeH);

        // Badge body
        ctx.fillStyle = bannerColor;
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

        // Badge text
        ctx.fillStyle = ctaTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + (badgeW / 2), badgeY + (badgeH / 2) + 1);

        qrArea = {
          x: cardX + Math.round(12 * scale),
          y: cardY + Math.round(18 * scale),
          width: cardW - Math.round(24 * scale),
          height: cardH - Math.round(28 * scale)
        };

      } else if (frameStyle === 'top-banner') {
        var cardPad = Math.round(16 * scale);
        var shadowOffset = Math.round(8 * scale);
        var cardBorder = Math.max(2, Math.round(4 * scale));

        var cardX = compX + cardPad;
        var cardY = compY + cardPad;
        var cardW = compDim - (cardPad * 2) - shadowOffset;
        var cardH = compDim - (cardPad * 2) - shadowOffset;
        var bannerH = Math.round(52 * scale);

        // Card shadow
        ctx.fillStyle = '#000000';
        ctx.fillRect(cardX + shadowOffset, cardY + shadowOffset, cardW, cardH);

        // Card body
        ctx.fillStyle = cardColor;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.lineWidth = cardBorder;
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Top Banner block
        ctx.fillStyle = bannerColor;
        ctx.fillRect(cardX, cardY, cardW, bannerH);
        ctx.beginPath();
        ctx.moveTo(cardX, cardY + bannerH);
        ctx.lineTo(cardX + cardW, cardY + bannerH);
        ctx.lineWidth = cardBorder;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        // CTA Text
        var text = ctaText || 'SCAN ME';
        var fontSize = Math.round(20 * scale);
        ctx.font = '900 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = ctaTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cardX + (cardW / 2), cardY + (bannerH / 2));

        qrArea = {
          x: cardX + Math.round(10 * scale),
          y: cardY + bannerH + Math.round(10 * scale),
          width: cardW - Math.round(20 * scale),
          height: cardH - bannerH - Math.round(20 * scale)
        };

      } else if (frameStyle === 'bottom-bar') {
        var cardPad = Math.round(16 * scale);
        var shadowOffset = Math.round(8 * scale);
        var cardBorder = Math.max(2, Math.round(4 * scale));

        var cardX = compX + cardPad;
        var cardY = compY + cardPad;
        var cardW = compDim - (cardPad * 2) - shadowOffset;
        var cardH = compDim - (cardPad * 2) - shadowOffset;
        var bannerH = Math.round(52 * scale);

        // Card shadow
        ctx.fillStyle = '#000000';
        ctx.fillRect(cardX + shadowOffset, cardY + shadowOffset, cardW, cardH);

        // Card body
        ctx.fillStyle = cardColor;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.lineWidth = cardBorder;
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Bottom Banner block
        var bannerY = cardY + cardH - bannerH;
        ctx.fillStyle = bannerColor;
        ctx.fillRect(cardX, bannerY, cardW, bannerH);
        ctx.beginPath();
        ctx.moveTo(cardX, bannerY);
        ctx.lineTo(cardX + cardW, bannerY);
        ctx.lineWidth = cardBorder;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        // CTA Text
        var text = ctaText || 'SCAN ME';
        var fontSize = Math.round(20 * scale);
        ctx.font = '900 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = ctaTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cardX + (cardW / 2), bannerY + (bannerH / 2));

        qrArea = {
          x: cardX + Math.round(10 * scale),
          y: cardY + Math.round(10 * scale),
          width: cardW - Math.round(20 * scale),
          height: cardH - bannerH - Math.round(20 * scale)
        };

      } else if (frameStyle === 'ticket') {
        var cardPad = Math.round(18 * scale);
        var shadowOffset = Math.round(7 * scale);
        var cardBorder = Math.max(2, Math.round(3.5 * scale));

        var cardX = compX + cardPad;
        var cardY = compY + cardPad;
        var cardW = compDim - (cardPad * 2) - shadowOffset;
        var cardH = compDim - (cardPad * 2) - shadowOffset;
        var stubH = Math.round(48 * scale);
        var perfY = cardY + cardH - stubH;

        // Card shadow
        ctx.fillStyle = '#000000';
        ctx.fillRect(cardX + shadowOffset, cardY + shadowOffset, cardW, cardH);

        // Card body
        ctx.fillStyle = cardColor;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.lineWidth = cardBorder;
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(cardX, cardY, cardW, cardH);

        // Perforated dashed divider line
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([Math.round(6 * scale), Math.round(5 * scale)]);
        ctx.moveTo(cardX + Math.round(4 * scale), perfY);
        ctx.lineTo(cardX + cardW - Math.round(4 * scale), perfY);
        ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.restore();

        // Ticket CTA Text
        var text = ctaText || 'SCAN FOR ACCESS';
        var fontSize = Math.round(15 * scale);
        ctx.font = '900 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = ctaTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cardX + (cardW / 2), perfY + (stubH / 2));

        qrArea = {
          x: cardX + Math.round(8 * scale),
          y: cardY + Math.round(8 * scale),
          width: cardW - Math.round(16 * scale),
          height: perfY - cardY - Math.round(12 * scale)
        };

      } else {
        // frameStyle === 'none'
        if (hasBgImage) {
          // When a photo background is loaded, render a clean contrast card backing under the QR
          var cardPad = Math.round(24 * scale);
          var shadowOffset = Math.round(8 * scale);
          var cardBorder = Math.max(2, Math.round(3.5 * scale));

          var cardX = compX + cardPad;
          var cardY = compY + cardPad;
          var cardW = compDim - (cardPad * 2) - shadowOffset;
          var cardH = compDim - (cardPad * 2) - shadowOffset;

          // Shadow
          ctx.fillStyle = '#000000';
          ctx.fillRect(cardX + shadowOffset, cardY + shadowOffset, cardW, cardH);

          // Card
          ctx.fillStyle = lightColor;
          ctx.fillRect(cardX, cardY, cardW, cardH);
          ctx.lineWidth = cardBorder;
          ctx.strokeStyle = strokeColor;
          ctx.strokeRect(cardX, cardY, cardW, cardH);

          qrArea = {
            x: cardX + Math.round(8 * scale),
            y: cardY + Math.round(8 * scale),
            width: cardW - Math.round(16 * scale),
            height: cardH - Math.round(16 * scale)
          };
        } else {
          qrArea = {
            x: compX,
            y: compY,
            width: compDim,
            height: compDim
          };
        }
      }

      // --- LAYER 3: QR CODE MATRIX RENDERING ---
      // Determine available square bounding box inside qrArea
      var availableDim = Math.min(qrArea.width, qrArea.height);
      var totalModules = moduleCount + (margin * 2);
      var cellSize = Math.floor(availableDim / totalModules);
      if (cellSize < 1) cellSize = 1;

      var qrPixelSize = moduleCount * cellSize;
      var quietZonePixels = margin * cellSize;
      var totalQRPixelSize = qrPixelSize + (quietZonePixels * 2);

      // Center the whole QR (quiet zone + matrix) inside qrArea
      var qrBoxX = Math.floor(qrArea.x + (qrArea.width - totalQRPixelSize) / 2);
      var qrBoxY = Math.floor(qrArea.y + (qrArea.height - totalQRPixelSize) / 2);

      // Fill quiet zone background surface (unless transparent background without frame or photo BG)
      var shouldFillQuietZone = !transparentBackground || hasBgImage || frameStyle !== 'none';
      if (shouldFillQuietZone) {
        ctx.fillStyle = lightColor;
        ctx.fillRect(qrBoxX, qrBoxY, totalQRPixelSize, totalQRPixelSize);
      }

      var offsetX = qrBoxX + quietZonePixels;
      var offsetY = qrBoxY + quietZonePixels;

      // Finder pattern coordinate detector (top-left, top-right, bottom-left)
      function isFinder(row, col) {
        if (row <= 6 && col <= 6) return true;
        if (row <= 6 && col >= moduleCount - 7) return true;
        if (row >= moduleCount - 7 && col <= 6) return true;
        return false;
      }

      // Finder patterns
      var finders = [
        { row: 0, col: 0 },
        { row: 0, col: moduleCount - 7 },
        { row: moduleCount - 7, col: 0 }
      ];

      for (var f = 0; f < finders.length; f++) {
        var fx = offsetX + (finders[f].col * cellSize);
        var fy = offsetY + (finders[f].row * cellSize);

        if (finderStyle === 'rounded') {
          self._drawRoundRect(ctx, fx, fy, 7 * cellSize, 7 * cellSize, cellSize * 1.5, darkColor);
          if (transparentBackground && !hasBgImage && frameStyle === 'none') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            self._drawRoundRect(ctx, fx + cellSize, fy + cellSize, 5 * cellSize, 5 * cellSize, cellSize * 1.0, '#000000');
            ctx.restore();
          } else {
            self._drawRoundRect(ctx, fx + cellSize, fy + cellSize, 5 * cellSize, 5 * cellSize, cellSize * 1.0, lightColor);
          }
          self._drawRoundRect(ctx, fx + (2 * cellSize), fy + (2 * cellSize), 3 * cellSize, 3 * cellSize, cellSize * 0.6, darkColor);
        } else {
          ctx.fillStyle = darkColor;
          ctx.fillRect(fx, fy, 7 * cellSize, 7 * cellSize);
          if (transparentBackground && !hasBgImage && frameStyle === 'none') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#000000';
            ctx.fillRect(fx + cellSize, fy + cellSize, 5 * cellSize, 5 * cellSize);
            ctx.restore();
          } else {
            ctx.fillStyle = lightColor;
            ctx.fillRect(fx + cellSize, fy + cellSize, 5 * cellSize, 5 * cellSize);
          }
          ctx.fillStyle = darkColor;
          ctx.fillRect(fx + (2 * cellSize), fy + (2 * cellSize), 3 * cellSize, 3 * cellSize);
        }
      }

      // Data and Alignment Modules
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          if (isFinder(row, col)) {
            continue;
          }

          if (qrModel.isDark(row, col)) {
            var x = offsetX + (col * cellSize);
            var y = offsetY + (row * cellSize);

            if (moduleStyle === 'dots') {
              ctx.fillStyle = darkColor;
              ctx.beginPath();
              ctx.arc(x + (cellSize / 2), y + (cellSize / 2), cellSize / 2, 0, Math.PI * 2);
              ctx.fill();
            } else if (moduleStyle === 'rounded') {
              self._drawRoundRect(ctx, x, y, cellSize, cellSize, Math.max(1, Math.round(cellSize * 0.35)), darkColor);
            } else {
              ctx.fillStyle = darkColor;
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          }
        }
      }

      // --- LAYER 4: CENTER LOGO WITH CLEARANCE BADGE ---
      if (hasLogo) {
        var logoImg = logoOpts.image;
        var sizePercent = typeof logoOpts.sizePercent === 'number' ? Math.max(15, Math.min(28, logoOpts.sizePercent)) : 22;
        var badgeShape = logoOpts.badgeShape || 'rounded'; // 'circle', 'rounded', 'square'
        var badgeColor = logoOpts.badgeColor || lightColor || '#FFFFFF';
        var padding = typeof logoOpts.padding === 'number' ? Math.max(2, Math.min(16, logoOpts.padding)) : 6;
        var scaledPadding = Math.round(padding * scale);

        var logoSize = Math.round(qrPixelSize * (sizePercent / 100));
        if (logoSize < 24) logoSize = 24;

        var cx = offsetX + (qrPixelSize / 2);
        var cy = offsetY + (qrPixelSize / 2);

        var badgeSize = logoSize + (scaledPadding * 2);
        var bx = Math.round(cx - (badgeSize / 2));
        var by = Math.round(cy - (badgeSize / 2));

        // Draw Clearance Badge Backing to cleanly isolate logo from QR modules
        ctx.save();
        if (badgeShape === 'circle') {
          ctx.beginPath();
          ctx.arc(cx, cy, badgeSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = badgeColor;
          ctx.fill();
          ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.stroke();
        } else if (badgeShape === 'square') {
          ctx.fillStyle = badgeColor;
          ctx.fillRect(bx, by, badgeSize, badgeSize);
          ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.strokeRect(bx, by, badgeSize, badgeSize);
        } else {
          // 'rounded'
          var radius = Math.round(badgeSize * 0.22);
          self._drawRoundRect(ctx, bx, by, badgeSize, badgeSize, radius, badgeColor, 'rgba(0,0,0,0.15)', Math.max(1, Math.round(1.5 * scale)));
        }
        ctx.restore();

        // Draw Logo Image (Aspect-Ratio Preserved Inside Inner Box)
        var lx = bx + scaledPadding;
        var ly = by + scaledPadding;

        var imgW = logoImg.width;
        var imgH = logoImg.height;
        var imgAspect = imgW / imgH;

        var drawW = logoSize;
        var drawH = logoSize;
        var drawX = lx;
        var drawY = ly;

        if (imgAspect > 1) {
          drawH = logoSize / imgAspect;
          drawY = ly + (logoSize - drawH) / 2;
        } else {
          drawW = logoSize * imgAspect;
          drawX = lx + (logoSize - drawW) / 2;
        }

        ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
      }
    }
  };

  QRStudio.Engine = Engine;
})(typeof window !== 'undefined' ? window : this);

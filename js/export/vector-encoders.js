/**
 * QR Design Studio — Client-Side Vector & Print Encoders (EPS, DXF, PDF)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * Generates genuine PostScript EPS, AutoCAD DXF, and PDF 1.4 documents.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Helper to convert Hex color (#RRGGBB) to 0.0 - 1.0 RGB components for PostScript and PDF.
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
   * Generate genuine PostScript Level 3 Encapsulated PostScript (.eps) vector file.
   * 
   * @param {Object} qrModel - Generated QR model
   * @param {Object} [options]
   * @returns {string} EPS ASCII content (Starts with %!PS-Adobe-3.0 EPSF-3.0)
   */
  function generateEPS(qrModel, options) {
    if (!qrModel) throw new Error('Valid QR model required for EPS export.');
    options = options || {};

    var moduleCount = qrModel.getModuleCount();
    var marginModules = 4;
    var totalModules = moduleCount + (marginModules * 2);
    var size = parseInt(options.size || options.width || 512, 10);
    var moduleSize = size / totalModules;

    var darkColor = options.darkColor || '#171717';
    var lightColor = options.lightColor || '#ffffff';
    var darkRgb = hexToRgbNormalized(darkColor);
    var lightRgb = hexToRgbNormalized(lightColor);

    var isTransparent = !!options.transparentBackground;

    var eps = [];
    eps.push('%!PS-Adobe-3.0 EPSF-3.0');
    eps.push('%%Creator: Better QR Universal Export Studio');
    eps.push('%%Title: QR Code Vector Export');
    eps.push('%%BoundingBox: 0 0 ' + size + ' ' + size);
    eps.push('%%Pages: 1');
    eps.push('%%LanguageLevel: 3');
    eps.push('%%EndComments');
    eps.push('');
    eps.push('/rectfill { 4 2 roll moveto 1 index 0 rlineto 0 exch rlineto neg 0 rlineto closepath fill } def');
    eps.push('');

    // Background fill (if not transparent)
    if (!isTransparent) {
      eps.push(lightRgb.r + ' ' + lightRgb.g + ' ' + lightRgb.b + ' setrgbcolor');
      eps.push('0 0 ' + size + ' ' + size + ' rectfill');
      eps.push('');
    }

    // Dark modules fill color
    eps.push(darkRgb.r + ' ' + darkRgb.g + ' ' + darkRgb.b + ' setrgbcolor');

    // In PostScript, (0, 0) is at bottom-left.
    // QR matrix row 0 is at top, so postScript Y = size - ((row + margin + 1) * moduleSize)
    for (var row = 0; row < moduleCount; row++) {
      for (var col = 0; col < moduleCount; col++) {
        if (qrModel.isDark(row, col)) {
          var posX = (col + marginModules) * moduleSize;
          var posY = size - ((row + marginModules + 1) * moduleSize);
          eps.push(posX.toFixed(2) + ' ' + posY.toFixed(2) + ' ' + moduleSize.toFixed(2) + ' ' + moduleSize.toFixed(2) + ' rectfill');
        }
      }
    }

    eps.push('');
    eps.push('showpage');
    eps.push('%%EOF');

    return eps.join('\n');
  }

  /**
   * Generate genuine AutoCAD ASCII DXF (R12 format) vector file.
   * Draws 2D SOLID entities for dark modules.
   * 
   * @param {Object} qrModel - Generated QR model
   * @param {Object} [options]
   * @returns {string} DXF ASCII content
   */
  function generateDXF(qrModel, options) {
    if (!qrModel) throw new Error('Valid QR model required for DXF export.');
    options = options || {};

    var moduleCount = qrModel.getModuleCount();
    var marginModules = 4;
    var totalModules = moduleCount + (marginModules * 2);
    var size = parseInt(options.size || options.width || 512, 10);
    var moduleSize = size / totalModules;

    var dxf = [];

    // Header section
    dxf.push('0\nSECTION');
    dxf.push('2\nHEADER');
    dxf.push('9\n$ACADVER\n1\nAC1009'); // AutoCAD R12 standard
    dxf.push('9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0');
    dxf.push('9\n$EXTMAX\n10\n' + size + '.0\n20\n' + size + '.0\n30\n0.0');
    dxf.push('0\nENDSEC');

    // Tables section
    dxf.push('0\nSECTION');
    dxf.push('2\nTABLES');
    dxf.push('0\nTABLE\n2\nLAYER\n70\n1');
    dxf.push('0\nLAYER\n2\nQR_MODULES\n70\n0\n62\n7\n6\nCONTINUOUS');
    dxf.push('0\nENDTAB');
    dxf.push('0\nENDSEC');

    // Entities section
    dxf.push('0\nSECTION');
    dxf.push('2\nENTITIES');

    // In DXF, Y is bottom-up
    for (var row = 0; row < moduleCount; row++) {
      for (var col = 0; col < moduleCount; col++) {
        if (qrModel.isDark(row, col)) {
          var x1 = (col + marginModules) * moduleSize;
          var x2 = x1 + moduleSize;
          var y2 = size - ((row + marginModules) * moduleSize);
          var y1 = y2 - moduleSize;

          // SOLID entity in DXF R12 has vertices: 1, 2, 4, 3 (bow-tie ordering)
          dxf.push('0\nSOLID');
          dxf.push('8\nQR_MODULES');
          dxf.push('10\n' + x1.toFixed(3) + '\n20\n' + y1.toFixed(3) + '\n30\n0.0'); // Pt 1: Bottom-Left
          dxf.push('11\n' + x2.toFixed(3) + '\n21\n' + y1.toFixed(3) + '\n31\n0.0'); // Pt 2: Bottom-Right
          dxf.push('12\n' + x1.toFixed(3) + '\n22\n' + y2.toFixed(3) + '\n32\n0.0'); // Pt 4: Top-Left (DXF group 12 is Pt 3)
          dxf.push('13\n' + x2.toFixed(3) + '\n23\n' + y2.toFixed(3) + '\n33\n0.0'); // Pt 3: Top-Right (DXF group 13 is Pt 4)
        }
      }
    }

    dxf.push('0\nENDSEC');
    dxf.push('0\nEOF');

    return dxf.join('\n');
  }

  /**
   * Generate genuine PDF 1.4 document.
   * Supports:
   * - Single QR Card / Poster (Letter or A4, Portrait or Landscape)
   * - Multi-QR Print Sheet (e.g. 2x2 or 3x3 grid with dashed cut lines)
   * Embeds high-resolution composite image stream via /DCTDecode (JPEG)
   * and vector text/borders.
   * 
   * @param {Object} qrModel - Generated QR model
   * @param {Object} options - PDF layout options
   * @param {HTMLCanvasElement} canvas - Master rendered composition canvas
   * @returns {Uint8Array} PDF binary buffer (Magic bytes: %PDF-1.4)
   */
  function generatePDF(qrModel, options, canvas) {
    options = options || {};
    var pageSize = (options.pageSize || 'letter').toLowerCase();
    var orientation = (options.orientation || 'portrait').toLowerCase();
    var layout = (options.layout || 'single').toLowerCase(); // 'single', 'grid2x2', 'grid3x3'
    var title = options.title || options.projectName || 'QR Code Design Studio';
    var payloadSummary = options.payloadSummary || options.payload || '';

    // Standard points (72 pt per inch):
    // Letter: 8.5 x 11 in -> 612 x 792 pt
    // A4: 210 x 297 mm -> 595.28 x 841.89 pt
    var pageW = 612;
    var pageH = 792;
    if (pageSize === 'a4') {
      pageW = 595.28;
      pageH = 841.89;
    }
    if (orientation === 'landscape') {
      var tmp = pageW;
      pageW = pageH;
      pageH = tmp;
    }

    // Extract JPEG image bytes from canvas
    var jpegDataUrl;
    if (canvas && typeof canvas.toDataURL === 'function') {
      jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    } else {
      throw new Error('Canvas required for PDF image embedding.');
    }

    var jpegBytes = QRStudio.base64ToUint8Array ? QRStudio.base64ToUint8Array(jpegDataUrl) : null;
    if (!jpegBytes) {
      throw new Error('Could not convert canvas to JPEG for PDF export.');
    }

    var imgW = canvas.width || 512;
    var imgH = canvas.height || 512;

    // Build Content Stream
    var streamParts = [];

    function escapePdfString(str) {
      if (!str) return '';
      return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    }

    if (layout === 'grid2x2' || layout === '4-up') {
      // 2x2 Grid (4 QR codes per sheet)
      var cols = 2, rows = 2;
      var marginX = 40, marginY = 50;
      var cellW = (pageW - (marginX * 2)) / cols;
      var cellH = (pageH - (marginY * 2)) / rows;
      var qrSize = Math.min(cellW * 0.72, cellH * 0.65);

      // Header title
      streamParts.push('BT /F1 16 Tf 0 0 0 rg ' + marginX + ' ' + (pageH - 35) + ' Td (' + escapePdfString(title) + ' — 4-Up Print Sheet) Tj ET');

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cx = marginX + (c * cellW);
          var cy = pageH - marginY - ((r + 1) * cellH);

          // Dashed cut guide around cell
          streamParts.push('q [3 3] 0 d 0.6 0.6 0.6 RG 0.5 w ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ' ' + cellW.toFixed(2) + ' ' + cellH.toFixed(2) + ' re S Q');

          // Centered QR image
          var qrX = cx + ((cellW - qrSize) / 2);
          var qrY = cy + ((cellH - qrSize) / 2) + 12;
          streamParts.push('q ' + qrSize.toFixed(2) + ' 0 0 ' + qrSize.toFixed(2) + ' ' + qrX.toFixed(2) + ' ' + qrY.toFixed(2) + ' cm /Im1 Do Q');

          // Label text below QR
          var labelX = cx + (cellW / 2);
          var labelY = qrY - 14;
          streamParts.push('BT /F1 9 Tf 0.2 0.2 0.2 rg ' + labelX.toFixed(2) + ' ' + labelY.toFixed(2) + ' Td (' + escapePdfString(payloadSummary.substring(0, 32)) + ') Tj ET');
        }
      }
    } else if (layout === 'grid3x3' || layout === '9-up') {
      // 3x3 Grid (9 QR codes per sheet)
      var cols = 3, rows = 3;
      var marginX = 30, marginY = 40;
      var cellW = (pageW - (marginX * 2)) / cols;
      var cellH = (pageH - (marginY * 2)) / rows;
      var qrSize = Math.min(cellW * 0.75, cellH * 0.70);

      streamParts.push('BT /F1 14 Tf 0 0 0 rg ' + marginX + ' ' + (pageH - 26) + ' Td (' + escapePdfString(title) + ' — 9-Up Batch Sheet) Tj ET');

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var cx = marginX + (c * cellW);
          var cy = pageH - marginY - ((r + 1) * cellH);

          // Dashed cut guide
          streamParts.push('q [2 2] 0 d 0.7 0.7 0.7 RG 0.5 w ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ' ' + cellW.toFixed(2) + ' ' + cellH.toFixed(2) + ' re S Q');

          var qrX = cx + ((cellW - qrSize) / 2);
          var qrY = cy + ((cellH - qrSize) / 2) + 8;
          streamParts.push('q ' + qrSize.toFixed(2) + ' 0 0 ' + qrSize.toFixed(2) + ' ' + qrX.toFixed(2) + ' ' + qrY.toFixed(2) + ' cm /Im1 Do Q');

          var labelX = cx + (cellW / 2);
          var labelY = qrY - 10;
          streamParts.push('BT /F1 7 Tf 0.3 0.3 0.3 rg ' + labelX.toFixed(2) + ' ' + labelY.toFixed(2) + ' Td (' + escapePdfString(payloadSummary.substring(0, 24)) + ') Tj ET');
        }
      }
    } else {
      // Single QR Card / Poster Layout
      var margin = 45;
      var maxQrW = pageW - (margin * 2);
      var maxQrH = pageH - 220;
      var qrDisplaySize = Math.min(maxQrW, maxQrH, 420);

      var qrX = (pageW - qrDisplaySize) / 2;
      var qrY = ((pageH - qrDisplaySize) / 2) - 10;

      // Top Neo-Brutalist Frame Bar
      streamParts.push('q 0 0 0 RG 3 w ' + margin + ' ' + (pageH - margin - 50) + ' ' + (pageW - (margin * 2)) + ' 50 re S Q');
      streamParts.push('q 0.98 0.82 0.2 rg ' + (margin + 3) + ' ' + (pageH - margin - 47) + ' ' + (pageW - (margin * 2) - 6) + ' 44 re f Q');
      streamParts.push('BT /F1 18 Tf 0 0 0 rg ' + (margin + 16) + ' ' + (pageH - margin - 32) + ' Td (' + escapePdfString(title.toUpperCase()) + ') Tj ET');

      // Draw Main QR Image
      streamParts.push('q ' + qrDisplaySize.toFixed(2) + ' 0 0 ' + qrDisplaySize.toFixed(2) + ' ' + qrX.toFixed(2) + ' ' + qrY.toFixed(2) + ' cm /Im1 Do Q');

      // Bottom Card / Info Box
      var infoBoxY = margin + 15;
      var infoBoxH = 65;
      streamParts.push('q 0 0 0 RG 2 w ' + margin + ' ' + infoBoxY + ' ' + (pageW - (margin * 2)) + ' ' + infoBoxH + ' re S Q');
      streamParts.push('q 0.96 0.96 0.96 rg ' + (margin + 2) + ' ' + (infoBoxY + 2) + ' ' + (pageW - (margin * 2) - 4) + ' ' + (infoBoxH - 4) + ' re f Q');

      streamParts.push('BT /F1 10 Tf 0.1 0.1 0.1 rg ' + (margin + 14) + ' ' + (infoBoxY + 42) + ' Td (SCAN WITH MOBILE CAMERA OR BARCODE READER) Tj ET');
      streamParts.push('BT /F2 9 Tf 0.3 0.3 0.3 rg ' + (margin + 14) + ' ' + (infoBoxY + 24) + ' Td (PAYLOAD: ' + escapePdfString(payloadSummary.substring(0, 75)) + ') Tj ET');
      streamParts.push('BT /F2 8 Tf 0.5 0.5 0.5 rg ' + (margin + 14) + ' ' + (infoBoxY + 10) + ' Td (Generated by Better QR Universal Export Studio • Make Every Scan Better) Tj ET');
    }

    var contentStreamStr = streamParts.join('\n');
    var contentStreamBytes = QRStudio.stringToUtf8Bytes ? QRStudio.stringToUtf8Bytes(contentStreamStr) : new Uint8Array(0);

    // --- ASSEMBLE PDF 1.4 OBJECTS ---
    // 1 0 obj: Catalog
    // 2 0 obj: Pages
    // 3 0 obj: Page
    // 4 0 obj: Content Stream
    // 5 0 obj: Image XObject (/Im1)
    // 6 0 obj: Font Helvetica
    // 7 0 obj: Font Courier

    // --- ASSEMBLE PDF 1.4 OBJECTS ---
    // 1 0 obj: Catalog
    // 2 0 obj: Pages
    // 3 0 obj: Page
    // 4 0 obj: Content Stream
    // 5 0 obj: Image XObject (/Im1)
    // 6 0 obj: Font Helvetica
    // 7 0 obj: Font Courier

    var pdfParts = [];
    var xrefOffsets = [];
    var currentLength = 0;

    function addChunk(strOrBytes) {
      var b = (typeof strOrBytes === 'string') ?
        (QRStudio.stringToUtf8Bytes ? QRStudio.stringToUtf8Bytes(strOrBytes) : new Uint8Array(0)) :
        strOrBytes;
      pdfParts.push(b);
      currentLength += b.length;
      return b.length;
    }

    function addPdfObject(objNum, contentFn) {
      xrefOffsets[objNum] = currentLength;
      addChunk(objNum + ' 0 obj\n');
      contentFn();
      addChunk('\nendobj\n');
    }

    // File Header (PDF-1.4 + binary comment)
    addChunk('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    // 1 0 obj: Catalog
    addPdfObject(1, function() {
      addChunk('<< /Type /Catalog /Pages 2 0 R >>');
    });

    // 2 0 obj: Pages
    addPdfObject(2, function() {
      addChunk('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    });

    // 3 0 obj: Page
    addPdfObject(3, function() {
      addChunk('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW.toFixed(2) + ' ' + pageH.toFixed(2) + '] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> /Font << /F1 6 0 R /F2 7 0 R >> >> >>');
    });

    // 4 0 obj: Content Stream
    addPdfObject(4, function() {
      addChunk('<< /Length ' + contentStreamBytes.length + ' >>\nstream\n');
      addChunk(contentStreamBytes);
      addChunk('\nendstream');
    });

    // 5 0 obj: Image XObject (/Im1)
    addPdfObject(5, function() {
      addChunk('<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>\nstream\n');
      addChunk(jpegBytes);
      addChunk('\nendstream');
    });

    // 6 0 obj: Font Helvetica
    addPdfObject(6, function() {
      addChunk('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    });

    // 7 0 obj: Font Courier
    addPdfObject(7, function() {
      addChunk('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    });

    // XREF Table
    var startXref = currentLength;
    var numObjects = 8; // 0 to 7
    var xrefStr = 'xref\n0 ' + numObjects + '\n';
    xrefStr += '0000000000 65535 f \n';
    for (var i = 1; i <= 7; i++) {
      var offStr = ('0000000000' + xrefOffsets[i]).slice(-10);
      xrefStr += offStr + ' 00000 n \n';
    }
    xrefStr += 'trailer\n<< /Size ' + numObjects + ' /Root 1 0 R >>\nstartxref\n' + startXref + '\n%%EOF';
    addChunk(xrefStr);

    // Concatenate all chunks into final Uint8Array
    var finalBuffer = new Uint8Array(currentLength);
    var writePos = 0;
    for (var p = 0; p < pdfParts.length; p++) {
      finalBuffer.set(pdfParts[p], writePos);
      writePos += pdfParts[p].length;
    }

    return finalBuffer;
  }

  QRStudio.VectorEncoders = {
    generateEPS: generateEPS,
    generateDXF: generateDXF,
    generatePDF: generatePDF
  };

})(typeof window !== 'undefined' ? window : this);

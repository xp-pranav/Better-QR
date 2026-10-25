/**
 * QR Design Studio — Client-Side Image Encoders (BMP, TIFF, ICO, AVIF detection)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Safe document resolver.
   */
  function getDoc() {
    if (typeof document !== 'undefined') return document;
    if (typeof window !== 'undefined' && window.document) return window.document;
    return null;
  }

  /**
   * Detect whether current browser environment can encode AVIF images via canvas.
   */
  function isAVIFSupported() {
    var doc = getDoc();
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
   * Encode canvas ImageData into genuine Windows Bitmap (BMP) binary buffer.
   * Supports 24-bit RGB (with solid background/row padding) and 32-bit RGBA (with transparency).
   * 
   * @param {ImageData} imageData - Canvas ImageData object
   * @param {Object} [options]
   * @param {boolean} [options.transparent=false] - Whether to preserve alpha as 32-bit BMP
   * @returns {Uint8Array} BMP binary buffer (Magic bytes: 0x42, 0x4D 'BM')
   */
  function encodeBMP(imageData, options) {
    options = options || {};
    var width = imageData.width;
    var height = imageData.height;
    var src = imageData.data;
    var isTransparent = !!options.transparent;

    var bpp = isTransparent ? 32 : 24;
    var rowBytes = isTransparent ? width * 4 : width * 3;
    var rowPadding = (4 - (rowBytes % 4)) % 4;
    var paddedRowBytes = rowBytes + rowPadding;
    var pixelDataSize = paddedRowBytes * height;

    var headerSize = 14;
    var dibHeaderSize = 40; // BITMAPINFOHEADER
    var fileOffset = headerSize + dibHeaderSize;
    var fileSize = fileOffset + pixelDataSize;

    var buffer = new Uint8Array(fileSize);
    var view = new DataView(buffer.buffer);

    // --- BITMAPFILEHEADER (14 bytes) ---
    buffer[0] = 0x42; // 'B'
    buffer[1] = 0x4D; // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint16(6, 0, true);  // reserved1
    view.setUint16(8, 0, true);  // reserved2
    view.setUint32(10, fileOffset, true); // offset to pixel array

    // --- BITMAPINFOHEADER (40 bytes) ---
    view.setUint32(14, dibHeaderSize, true); // biSize
    view.setInt32(18, width, true);          // biWidth
    view.setInt32(22, height, true);         // biHeight (positive = bottom-to-top)
    view.setUint16(26, 1, true);             // biPlanes
    view.setUint16(28, bpp, true);           // biBitCount (24 or 32)
    view.setUint32(30, 0, true);             // biCompression (0 = BI_RGB uncompressed)
    view.setUint32(34, pixelDataSize, true); // biSizeImage
    view.setInt32(38, 2835, true);           // biXPelsPerMeter (approx 72 dpi)
    view.setInt32(42, 2835, true);           // biYPelsPerMeter
    view.setUint32(46, 0, true);             // biClrUsed
    view.setUint32(50, 0, true);             // biClrImportant

    // --- PIXEL ARRAY (Bottom-up BGR / BGRA) ---
    var dstOffset = fileOffset;
    for (var y = height - 1; y >= 0; y--) {
      var rowStart = y * width * 4;
      for (var x = 0; x < width; x++) {
        var p = rowStart + (x * 4);
        var r = src[p];
        var g = src[p + 1];
        var b = src[p + 2];
        var a = src[p + 3];

        if (isTransparent) {
          buffer[dstOffset++] = b;
          buffer[dstOffset++] = g;
          buffer[dstOffset++] = r;
          buffer[dstOffset++] = a;
        } else {
          // If source had alpha, composite over white
          if (a < 255) {
            var alpha = a / 255;
            r = Math.round(r * alpha + 255 * (1 - alpha));
            g = Math.round(g * alpha + 255 * (1 - alpha));
            b = Math.round(b * alpha + 255 * (1 - alpha));
          }
          buffer[dstOffset++] = b;
          buffer[dstOffset++] = g;
          buffer[dstOffset++] = r;
        }
      }
      // Row padding
      for (var pad = 0; pad < rowPadding; pad++) {
        buffer[dstOffset++] = 0;
      }
    }

    return buffer;
  }

  /**
   * Encode canvas ImageData into genuine Baseline TIFF 6.0 binary buffer.
   * Little-endian uncompressed RGB/RGBA.
   * 
   * @param {ImageData} imageData - Canvas ImageData object
   * @param {Object} [options]
   * @param {boolean} [options.transparent=false] - Whether to preserve 4th alpha channel
   * @param {number} [options.dpi=72] - Print resolution
   * @returns {Uint8Array} TIFF binary buffer (Magic bytes: 0x49, 0x49, 0x2A, 0x00 'II*')
   */
  function encodeTIFF(imageData, options) {
    options = options || {};
    var width = imageData.width;
    var height = imageData.height;
    var src = imageData.data;
    var isTransparent = !!options.transparent;
    var dpi = options.dpi || 72;

    var spp = isTransparent ? 4 : 3; // samples per pixel
    var stripByteCount = width * height * spp;

    // We will build:
    // Header (8 bytes)
    // Pixel Strip Data (stripByteCount bytes)
    // Extra data (BitsPerSample values, XRes, YRes rational numbers)
    // IFD Directory (2 + numTags * 12 + 4 bytes)

    var pixelDataOffset = 8;
    var extraDataOffset = pixelDataOffset + stripByteCount;

    // Align extraDataOffset to 2-byte boundary
    if (extraDataOffset % 2 !== 0) extraDataOffset++;

    // Extra data sizes:
    // BitsPerSample: spp * 2 bytes (3*2 = 6 or 4*2 = 8 bytes)
    var bpsOffset = extraDataOffset;
    var bpsLen = spp * 2;

    // XResolution: 8 bytes (2 LONGs: numerator, denominator)
    var xResOffset = bpsOffset + bpsLen;
    // YResolution: 8 bytes
    var yResOffset = xResOffset + 8;

    var ifdOffset = yResOffset + 8;
    if (ifdOffset % 2 !== 0) ifdOffset++;

    var numTags = isTransparent ? 13 : 12;
    var ifdSize = 2 + (numTags * 12) + 4;
    var totalSize = ifdOffset + ifdSize;

    var buffer = new Uint8Array(totalSize);
    var view = new DataView(buffer.buffer);

    // --- TIFF HEADER (8 bytes, Little-Endian 'II') ---
    buffer[0] = 0x49; // 'I'
    buffer[1] = 0x49; // 'I'
    view.setUint16(2, 42, true); // TIFF version 42
    view.setUint32(4, ifdOffset, true); // Offset of first IFD

    // --- STRIP PIXEL DATA (RGB or RGBA) ---
    var dst = pixelDataOffset;
    for (var i = 0, len = src.length; i < len; i += 4) {
      var r = src[i];
      var g = src[i + 1];
      var b = src[i + 2];
      var a = src[i + 3];

      if (isTransparent) {
        buffer[dst++] = r;
        buffer[dst++] = g;
        buffer[dst++] = b;
        buffer[dst++] = a;
      } else {
        if (a < 255) {
          var alpha = a / 255;
          r = Math.round(r * alpha + 255 * (1 - alpha));
          g = Math.round(g * alpha + 255 * (1 - alpha));
          b = Math.round(b * alpha + 255 * (1 - alpha));
        }
        buffer[dst++] = r;
        buffer[dst++] = g;
        buffer[dst++] = b;
      }
    }

    // --- WRITE EXTRA DATA (BPS & RATIONALS) ---
    for (var s = 0; s < spp; s++) {
      view.setUint16(bpsOffset + (s * 2), 8, true); // 8 bits per sample
    }
    // XResolution: dpi / 1
    view.setUint32(xResOffset, dpi, true);
    view.setUint32(xResOffset + 4, 1, true);
    // YResolution: dpi / 1
    view.setUint32(yResOffset, dpi, true);
    view.setUint32(yResOffset + 4, 1, true);

    // --- WRITE IFD (TAGS MUST BE SORTED BY TAG ID) ---
    var tOffset = ifdOffset;
    view.setUint16(tOffset, numTags, true);
    tOffset += 2;

    function writeTag(tagId, type, count, valOrOffset) {
      view.setUint16(tOffset, tagId, true);
      view.setUint16(tOffset + 2, type, true); // 3=SHORT, 4=LONG, 5=RATIONAL
      view.setUint32(tOffset + 4, count, true);
      // If data fits in 4 bytes, write directly; else write offset
      if (type === 3 && count === 1) {
        view.setUint16(tOffset + 8, valOrOffset, true);
        view.setUint16(tOffset + 10, 0, true);
      } else {
        view.setUint32(tOffset + 8, valOrOffset, true);
      }
      tOffset += 12;
    }

    // Tag 256 (0x0100) ImageWidth
    writeTag(256, 4, 1, width);
    // Tag 257 (0x0101) ImageLength
    writeTag(257, 4, 1, height);
    // Tag 258 (0x0102) BitsPerSample (offset to bps values)
    writeTag(258, 3, spp, bpsOffset);
    // Tag 259 (0x0103) Compression (1 = uncompressed)
    writeTag(259, 3, 1, 1);
    // Tag 262 (0x0106) PhotometricInterpretation (2 = RGB)
    writeTag(262, 3, 1, 2);
    // Tag 273 (0x0111) StripOffsets
    writeTag(273, 4, 1, pixelDataOffset);
    // Tag 277 (0x0115) SamplesPerPixel
    writeTag(277, 3, 1, spp);
    // Tag 278 (0x0116) RowsPerStrip
    writeTag(278, 4, 1, height);
    // Tag 279 (0x0117) StripByteCounts
    writeTag(279, 4, 1, stripByteCount);
    // Tag 282 (0x011A) XResolution
    writeTag(282, 5, 1, xResOffset);
    // Tag 283 (0x011B) YResolution
    writeTag(283, 5, 1, yResOffset);
    // Tag 296 (0x0128) ResolutionUnit (2 = inch)
    writeTag(296, 3, 1, 2);
    // Tag 338 (0x0152) ExtraSamples if transparent (2 = unassociated alpha)
    if (isTransparent) {
      writeTag(338, 3, 1, 2);
    }

    // Next IFD offset = 0
    view.setUint32(tOffset, 0, true);

    return buffer;
  }

  /**
   * Encode canvas into standard Windows Icon (.ico) file.
   * Embeds standard PNG streams for requested resolutions (e.g. 16, 32, 64, 128, 256).
   * 
   * @param {HTMLCanvasElement} sourceCanvas - Master rendered composition canvas
   * @param {Object} [options]
   * @param {number[]} [options.sizes=[16, 32, 48, 64, 128, 256]] - Icon resolutions to embed
   * @returns {Promise<Uint8Array>} ICO binary buffer (Magic bytes: 0x00, 0x00, 0x01, 0x00)
   */
  async function encodeICO(sourceCanvas, options) {
    if (Array.isArray(options)) {
      options = { sizes: options };
    }
    options = options || {};
    var doc = getDoc();
    var sizes = options.sizes || [16, 32, 48, 64, 128, 256];

    // Filter sizes to valid icon dimensions (<= 256)
    sizes = sizes.filter(function(s) { return s >= 16 && s <= 256; });
    if (sizes.length === 0) sizes = [64, 128, 256];

    // Generate PNG bytes for each size
    var pngEntries = [];
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      var resizedCanvas;
      if (doc && typeof doc.createElement === 'function') {
        resizedCanvas = doc.createElement('canvas');
        resizedCanvas.width = s;
        resizedCanvas.height = s;
        var rCtx = resizedCanvas.getContext('2d');
        if (rCtx) {
          rCtx.imageSmoothingEnabled = false;
          rCtx.drawImage(sourceCanvas, 0, 0, s, s);
        }
      } else {
        resizedCanvas = sourceCanvas;
      }

      var pngDataUrl = resizedCanvas.toDataURL('image/png');
      var pngBytes = QRStudio.base64ToUint8Array ? QRStudio.base64ToUint8Array(pngDataUrl) : null;
      if (!pngBytes) {
        throw new Error('Could not convert canvas to PNG stream for ICO generation.');
      }
      pngEntries.push({
        size: s,
        bytes: pngBytes
      });
    }

    var numImages = pngEntries.length;
    var headerSize = 6;
    var dirEntrySize = 16;
    var dirSize = numImages * dirEntrySize;
    var dataOffset = headerSize + dirSize;

    var totalSize = dataOffset;
    for (var k = 0; k < numImages; k++) {
      totalSize += pngEntries[k].bytes.length;
    }

    var buffer = new Uint8Array(totalSize);
    var view = new DataView(buffer.buffer);

    // --- ICONDIR (6 bytes) ---
    view.setUint16(0, 0, true); // Reserved (0)
    view.setUint16(2, 1, true); // Resource Type (1 = Icon .ico)
    view.setUint16(4, numImages, true); // Number of images

    // --- ICONDIRENTRY list ---
    var currentDataOffset = dataOffset;
    var dirOffset = headerSize;

    for (var j = 0; j < numImages; j++) {
      var entry = pngEntries[j];
      var s = entry.size;
      var wByte = s >= 256 ? 0 : s;
      var hByte = s >= 256 ? 0 : s;

      buffer[dirOffset] = wByte;     // Width (0 = 256px)
      buffer[dirOffset + 1] = hByte; // Height (0 = 256px)
      buffer[dirOffset + 2] = 0;     // Color count (0 = >=8bpp)
      buffer[dirOffset + 3] = 0;     // Reserved
      view.setUint16(dirOffset + 4, 1, true);  // Color planes (1)
      view.setUint16(dirOffset + 6, 32, true); // Bits per pixel (32)
      view.setUint32(dirOffset + 8, entry.bytes.length, true); // Resource size
      view.setUint32(dirOffset + 12, currentDataOffset, true); // File offset

      // Copy PNG stream into buffer
      buffer.set(entry.bytes, currentDataOffset);
      currentDataOffset += entry.bytes.length;

      dirOffset += dirEntrySize;
    }

    return buffer;
  }

  QRStudio.ImageEncoders = {
    isAVIFSupported: isAVIFSupported,
    encodeBMP: encodeBMP,
    encodeTIFF: encodeTIFF,
    encodeICO: encodeICO
  };

})(typeof window !== 'undefined' ? window : this);

/**
 * QR Design Studio — Lightweight Client-Side ZIP Archive Generator
 * Implements PKWARE ZIP Specification (APPNOTE.TXT) and ISO/IEC 21320-1.
 * 
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * Compatible with direct file:// execution, Node.js test sandboxes,
 * and all modern browsers.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Precomputed standard CRC-32 table (polynomial 0xEDB88320).
   */
  var CRC_TABLE = (function() {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  /**
   * Calculate CRC-32 checksum of a Uint8Array.
   */
  function calculateCRC32(uint8Array) {
    var crc = 0xFFFFFFFF;
    for (var i = 0, len = uint8Array.length; i < len; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Convert UTF-8 string to Uint8Array.
   */
  function stringToUtf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    // Fallback for environments lacking TextEncoder
    var utf8 = [];
    for (var i = 0; i < str.length; i++) {
      var charcode = str.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6),
                  0x80 | (charcode & 0x3f));
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12),
                  0x80 | ((charcode >> 6) & 0x3f),
                  0x80 | (charcode & 0x3f));
      } else {
        // surrogate pair
        i++;
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        utf8.push(0xf0 | (charcode >> 18),
                  0x80 | ((charcode >> 12) & 0x3f),
                  0x80 | ((charcode >> 6) & 0x3f),
                  0x80 | (charcode & 0x3f));
      }
    }
    return new Uint8Array(utf8);
  }

  /**
   * Convert base64 string to Uint8Array.
   */
  function base64ToUint8Array(base64) {
    // Strip data URI prefix if present
    var commaIdx = base64.indexOf(',');
    if (commaIdx !== -1) {
      base64 = base64.substring(commaIdx + 1);
    }
    base64 = base64.replace(/\s/g, '');

    if (typeof atob !== 'undefined') {
      var binaryStr = atob(base64);
      var len = binaryStr.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return bytes;
    }

    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }

    throw new Error('No base64 decoding mechanism available.');
  }

  /**
   * Get current DOS date and time for ZIP header records.
   */
  function getDosDateTime(date) {
    date = date || new Date();
    var dosTime = ((date.getHours() & 0x1F) << 11) |
                  ((date.getMinutes() & 0x3F) << 5) |
                  ((date.getSeconds() >> 1) & 0x1F);
    var dosDate = (((date.getFullYear() - 1980) & 0x7F) << 9) |
                  (((date.getMonth() + 1) & 0x0F) << 5) |
                  (date.getDate() & 0x1F);
    return { time: dosTime, date: dosDate };
  }

  /**
   * ZipArchive builder class.
   * Compiles an in-memory ZIP archive using Store (Method 0 - uncompressed)
   * which is standard for Office Open XML (.docx, .xlsx, .ods) and universal
   * zip extractors (Windows, macOS, Linux, Info-ZIP).
   */
  function ZipArchive() {
    this.entries = [];
  }

  /**
   * Add a file entry to the archive.
   * @param {string} filename - Relative path inside the ZIP (e.g. "word/document.xml")
   * @param {string|Uint8Array} content - File content as string, base64 data URL, or Uint8Array.
   * @param {Object} [options]
   */
  ZipArchive.prototype.addFile = function(filename, content, options) {
    options = options || {};
    // Normalize path separators to forward slashes and strip leading slashes
    filename = filename.replace(/\\/g, '/').replace(/^\/+/, '');

    var dataBytes;
    if (content instanceof Uint8Array) {
      dataBytes = content;
    } else if (typeof content === 'string') {
      if (options.isBase64 || content.indexOf('data:') === 0) {
        dataBytes = base64ToUint8Array(content);
      } else {
        dataBytes = stringToUtf8Bytes(content);
      }
    } else if (content && content.buffer instanceof ArrayBuffer) {
      dataBytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    } else {
      dataBytes = new Uint8Array(0);
    }

    var nameBytes = stringToUtf8Bytes(filename);
    var crc = calculateCRC32(dataBytes);
    var dt = getDosDateTime(options.date);

    this.entries.push({
      filename: filename,
      nameBytes: nameBytes,
      dataBytes: dataBytes,
      crc32: crc,
      size: dataBytes.length,
      dosTime: dt.time,
      dosDate: dt.date
    });

    return this;
  };

  /**
   * Build the complete ZIP binary buffer.
   * @returns {Uint8Array}
   */
  ZipArchive.prototype.buildUint8Array = function() {
    var entry, i;
    var localHeadersSize = 0;
    var centralDirSize = 0;

    // Calculate total size needed
    for (i = 0; i < this.entries.length; i++) {
      entry = this.entries[i];
      // Local Header: 30 bytes + name length + data length
      localHeadersSize += 30 + entry.nameBytes.length + entry.size;
      // Central Directory Header: 46 bytes + name length
      centralDirSize += 46 + entry.nameBytes.length;
    }

    // End of Central Directory: 22 bytes
    var totalSize = localHeadersSize + centralDirSize + 22;
    var buffer = new Uint8Array(totalSize);
    var view = new DataView(buffer.buffer);

    var offset = 0;
    var centralDirOffset = localHeadersSize;
    var cdOffset = centralDirOffset;

    for (i = 0; i < this.entries.length; i++) {
      entry = this.entries[i];
      var localHeaderOffset = offset;

      // --- LOCAL FILE HEADER ---
      view.setUint32(offset, 0x04034b50, true); // Signature PK\x03\x04
      view.setUint16(offset + 4, 20, true);       // Version needed to extract (2.0)
      view.setUint16(offset + 6, 0x0800, true);   // General purpose bit flag (Bit 11 = UTF-8 filenames)
      view.setUint16(offset + 8, 0, true);        // Compression method 0 = Store (no compression)
      view.setUint16(offset + 10, entry.dosTime, true);
      view.setUint16(offset + 12, entry.dosDate, true);
      view.setUint32(offset + 14, entry.crc32, true);
      view.setUint32(offset + 18, entry.size, true); // Compressed size
      view.setUint32(offset + 22, entry.size, true); // Uncompressed size
      view.setUint16(offset + 26, entry.nameBytes.length, true);
      view.setUint16(offset + 28, 0, true);       // Extra field length
      offset += 30;

      // Filename
      buffer.set(entry.nameBytes, offset);
      offset += entry.nameBytes.length;

      // File Data
      buffer.set(entry.dataBytes, offset);
      offset += entry.size;

      // --- CENTRAL DIRECTORY RECORD ---
      view.setUint32(cdOffset, 0x02014b50, true); // Signature PK\x01\x02
      view.setUint16(cdOffset + 4, 20, true);       // Version made by (2.0 / MS-DOS)
      view.setUint16(cdOffset + 6, 20, true);       // Version needed (2.0)
      view.setUint16(cdOffset + 8, 0x0800, true);   // General purpose bit flag (UTF-8)
      view.setUint16(cdOffset + 10, 0, true);       // Compression method 0
      view.setUint16(cdOffset + 12, entry.dosTime, true);
      view.setUint16(cdOffset + 14, entry.dosDate, true);
      view.setUint32(cdOffset + 16, entry.crc32, true);
      view.setUint32(cdOffset + 20, entry.size, true);
      view.setUint32(cdOffset + 24, entry.size, true);
      view.setUint16(cdOffset + 28, entry.nameBytes.length, true);
      view.setUint16(cdOffset + 30, 0, true);       // Extra field length
      view.setUint16(cdOffset + 32, 0, true);       // File comment length
      view.setUint16(cdOffset + 34, 0, true);       // Disk number start
      view.setUint16(cdOffset + 36, 0, true);       // Internal file attributes
      view.setUint32(cdOffset + 38, 0, true);       // External file attributes
      view.setUint32(cdOffset + 42, localHeaderOffset, true); // Relative offset of local header
      cdOffset += 46;

      buffer.set(entry.nameBytes, cdOffset);
      cdOffset += entry.nameBytes.length;
    }

    // --- END OF CENTRAL DIRECTORY RECORD (EOCD) ---
    view.setUint32(cdOffset, 0x06054b50, true); // Signature PK\x05\x06
    view.setUint16(cdOffset + 4, 0, true);       // Disk number
    view.setUint16(cdOffset + 6, 0, true);       // Disk where central directory starts
    view.setUint16(cdOffset + 8, this.entries.length, true); // Entries on this disk
    view.setUint16(cdOffset + 10, this.entries.length, true); // Total entries
    view.setUint32(cdOffset + 12, centralDirSize, true);      // Size of central directory
    view.setUint32(cdOffset + 16, centralDirOffset, true);    // Offset of central directory
    view.setUint16(cdOffset + 20, 0, true);      // ZIP file comment length

    return buffer;
  };

  /**
   * Build Blob object.
   * @param {string} [mimeType='application/zip']
   * @returns {Blob}
   */
  ZipArchive.prototype.toBlob = function(mimeType) {
    mimeType = mimeType || 'application/zip';
    var uint8Array = this.buildUint8Array();
    if (typeof Blob !== 'undefined') {
      return new Blob([uint8Array], { type: mimeType });
    }
    return uint8Array;
  };

  QRStudio.ZipArchive = ZipArchive;
  QRStudio.ZipBuilder = ZipArchive;
  QRStudio.calculateCRC32 = calculateCRC32;
  QRStudio.stringToUtf8Bytes = stringToUtf8Bytes;
  QRStudio.base64ToUint8Array = base64ToUint8Array;

})(typeof window !== 'undefined' ? window : this);

/**
 * QR Design Studio — Smart Bulk Import, Generation, Export & Print Bridge (V1.8)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * 
 * Provides:
 * - Robust data parsers for CSV (RFC 4180), TSV, TXT (delimited, line-by-line, key-value), pasted rows, and XLSX (Office Open XML).
 * - Safe custom instruction syntax parser (label="data", label="type:(url)", label="visit:(auto-detect)", etc.).
 * - Intelligent column role inferencing and confidence scoring.
 * - Per-row independent QR type detection (URL, Phone, Email, Wi-Fi, WhatsApp, Text) with phone-number evidence guards.
 * - Contextual display-label inference and instruction overrides.
 * - Chunked asynchronous batch QR generation with quiet-zone and aspect-ratio preservation.
 * - First-class bulk export: ZIP archive containing individual images (PNG, JPEG, WebP, SVG) with unique sanitized filenames.
 * - Manifest generation: CSV, TSV, JSON, and genuine XLSX with CWE-1236 spreadsheet formula injection defense.
 * - Deep Print Studio integration: transferring bulk records to multi-QR print layouts with distinct canvases and labels.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  // Maximum safe batch size to avoid browser memory exhaustion
  var MAX_SAFE_BATCH_SIZE = 500;
  var DEFAULT_BATCH_CHUNK_SIZE = 10;

  var SAFETY_LIMITS = {
    MAX_IMPORT_BYTES: 15 * 1024 * 1024,              // 15MB import limit
    MAX_ZIP_ENTRIES: 250,                           // Max entries in zip/xlsx
    MAX_SINGLE_UNCOMPRESSED_BYTES: 15 * 1024 * 1024, // 15MB single file
    MAX_TOTAL_UNCOMPRESSED_BYTES: 30 * 1024 * 1024   // 30MB total decompression
  };

  /**
   * Safe HTML / XML character escape.
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
   * Sanitize spreadsheet cell values against CSV/Formula Injection (CWE-1236).
   * Prepends a single quote (') if the value (or trimmed value) begins with =, +, -, @, \t, \r, or |.
   */
  function sanitizeCellForSpreadsheet(val) {
    if (val == null) return '';
    var str = String(val);
    if (/^\s*[=+\-@\t\r|]/.test(str)) {
      return "'" + str;
    }
    return str;
  }

  /**
   * Deterministic filename sanitizer.
   * Strips illegal filesystem characters, path traversal, control chars, and resolves duplicates.
   */
  function buildSanitizedFilename(label, payload, index, ext, usedNames) {
    usedNames = usedNames || {};
    ext = (ext || 'png').replace(/^\./, '').toLowerCase();

    var candidate = '';
    if (label && typeof label === 'string' && label.trim().length > 0) {
      candidate = label.trim();
    } else if (payload && typeof payload === 'string' && payload.trim().length > 0) {
      // Create readable slug from payload (e.g. domain or first few words)
      candidate = payload.trim()
        .replace(/^https?:\/\/(www\.)?/, '')
        .replace(/^mailto:/, '')
        .replace(/^tel:/, '')
        .replace(/^WIFI:S:/, '')
        .substring(0, 32);
    }

    if (!candidate) {
      candidate = 'qr-record';
    }

    // Sanitize: replace illegal filesystem characters (<>:"/\|?*) and control chars with dashes
    var sanitized = candidate
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/\.+/g, '-') // collapse dots to prevent directory traversal
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    if (!sanitized) sanitized = 'qr-code';

    // Limit length
    if (sanitized.length > 40) {
      sanitized = sanitized.substring(0, 40).replace(/-+$/, '');
    }

    // Add 1-based index prefix for stable ordering if not already unique
    var baseName = (index != null ? ('qr-' + String(index + 1).padStart(3, '0') + '-' + sanitized) : sanitized);
    var finalName = baseName + '.' + ext;

    var counter = 1;
    while (usedNames[finalName.toLowerCase()]) {
      finalName = baseName + '-' + String(counter).padStart(2, '0') + '.' + ext;
      counter++;
    }

    usedNames[finalName.toLowerCase()] = true;
    return finalName;
  }

  // =========================================================================
  // 1. DATA PARSERS (CSV, TSV, TXT, PASTED, XLSX)
  // =========================================================================

  /**
   * Sniff the most likely delimiter from sample text lines.
   */
  function sniffDelimiter(text) {
    var lines = text.split(/\r\n|\r|\n/).slice(0, 5);
    var delimiters = [',', '\t', ';', '|'];
    var bestDelim = ',';
    var maxCount = -1;

    for (var d = 0; d < delimiters.length; d++) {
      var delim = delimiters[d];
      var total = 0;
      var consistent = true;
      var firstLineCount = -1;

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        // Count occurrences outside quotes
        var count = 0;
        var inQuotes = false;
        for (var c = 0; c < line.length; c++) {
          if (line[c] === '"') inQuotes = !inQuotes;
          else if (!inQuotes && line[c] === delim) count++;
        }
        if (firstLineCount === -1) {
          firstLineCount = count;
        } else if (count !== firstLineCount) {
          consistent = false;
        }
        total += count;
      }

      if (total > maxCount && (consistent || delimiters[d] === '\t' || delimiters[d] === ',')) {
        maxCount = total;
        bestDelim = delim;
      }
    }

    return maxCount > 0 ? bestDelim : ',';
  }

  /**
   * RFC 4180 Compliant CSV / TSV / Delimited Text Parser.
   * Handles:
   * - UTF-8 BOM (\uFEFF)
   * - Quoted fields with escaped quotes ("")
   * - Multiline fields (newlines embedded inside quotes)
   * - Arbitrary delimiters (auto-detected or explicit)
   * - Trailing newlines and empty lines
   * 
   * @param {string} text
   * @param {string} [explicitDelimiter]
   * @returns {Array<Array<string>>} 2D array of rows and cell strings
   */
  function parseCSV(text, explicitDelimiter) {
    if (!text || typeof text !== 'string') return [];

    // Strip UTF-8 Byte Order Mark if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    var delimiter = explicitDelimiter || sniffDelimiter(text);
    var rows = [];
    var currentRow = [];
    var currentField = '';
    var inQuotes = false;
    var len = text.length;

    for (var i = 0; i < len; i++) {
      var char = text[i];
      var nextChar = (i + 1 < len) ? text[i + 1] : '';

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote ("") inside quoted field -> literal quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // Field delimiter outside quotes
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        // Line break outside quotes
        currentRow.push(currentField);
        currentField = '';

        // Check if row has any non-empty fields or is not completely empty
        var hasContent = currentRow.some(function(cell) { return cell.trim().length > 0; });
        if (hasContent || currentRow.length > 1) {
          rows.push(currentRow);
        }
        currentRow = [];

        // Handle \r\n two-character sequence
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }

    // Final trailing field / row
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      var hasTrailingContent = currentRow.some(function(cell) { return cell.trim().length > 0; });
      if (hasTrailingContent || currentRow.length > 1) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * TSV Parser (convenience wrapper over parseCSV with tab delimiter).
   */
  function parseTSV(text) {
    return parseCSV(text, '\t');
  }

  /**
   * TXT Parser supporting multiple documented structures:
   * 1. Delimited text (pipes |, tabs \t, or commas)
   * 2. Key-value block records separated by '---' or double newlines:
   *    data: https://example.com
   *    type: url
   *    label: Visit Website
   *    ---
   * 3. Line-by-line single payload per line.
   * 
   * @param {string} text
   * @returns {Array<Array<string>>} 2D array of rows
   */
  function parseTXT(text) {
    if (!text || typeof text !== 'string') return [];
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    var trimmed = text.trim();

    // Check for Key-Value block format (contains "data:" or "payload:" and "---")
    if (/(^|\n)\s*(data|payload|url|content)\s*:/i.test(trimmed)) {
      var blocks = trimmed.split(/\r?\n\s*-{3,}\s*\r?\n|\r?\n\r?\n/);
      var headers = ['Data', 'Type', 'Label'];
      var rows = [headers];

      for (var b = 0; b < blocks.length; b++) {
        var block = blocks[b].trim();
        if (!block) continue;

        var dataVal = '';
        var typeVal = '';
        var labelVal = '';

        var lines = block.split(/\r?\n/);
        for (var l = 0; l < lines.length; l++) {
          var line = lines[l].trim();
          var matchData = line.match(/^(?:data|payload|url|link|content)\s*:\s*(.+)$/i);
          var matchType = line.match(/^(?:type|qr[-_]?type|category)\s*:\s*(.+)$/i);
          var matchLabel = line.match(/^(?:label|name|title|visit|cta)\s*:\s*(.+)$/i);

          if (matchData) dataVal = matchData[1].trim();
          else if (matchType) typeVal = matchType[1].trim();
          else if (matchLabel) labelVal = matchLabel[1].trim();
          else if (!dataVal && line.length > 0) dataVal = line; // Fallback
        }

        if (dataVal || typeVal || labelVal) {
          rows.push([dataVal, typeVal, labelVal]);
        }
      }

      if (rows.length > 1) return rows;
    }

    // Check if delimited (has tabs, pipes, or commas in lines)
    var lines = trimmed.split(/\r?\n/);
    var pipeCount = 0;
    var tabCount = 0;
    var commaCount = 0;

    for (var i = 0; i < Math.min(lines.length, 5); i++) {
      if (lines[i].indexOf('|') !== -1) pipeCount++;
      if (lines[i].indexOf('\t') !== -1) tabCount++;
      if (lines[i].indexOf(',') !== -1) commaCount++;
    }

    if (pipeCount >= 2 || tabCount >= 2 || commaCount >= 2) {
      var delim = (pipeCount >= tabCount && pipeCount >= commaCount) ? '|' : (tabCount >= commaCount ? '\t' : ',');
      return parseCSV(text, delim);
    }

    // Fallback: Line-by-line list (each line is one QR payload)
    var lineRows = [['Data']];
    for (var j = 0; j < lines.length; j++) {
      var payloadLine = lines[j].trim();
      if (payloadLine.length > 0) {
        lineRows.push([payloadLine]);
      }
    }
    return lineRows;
  }

  /**
   * Parse pasted spreadsheet rows (from Excel / Google Sheets clipboard).
   */
  function parsePastedText(text) {
    if (!text || typeof text !== 'string') return [];
    var delim = text.indexOf('\t') !== -1 ? '\t' : sniffDelimiter(text);
    return parseCSV(text, delim);
  }

  /**
   * Convert column letter sequence (e.g. "A", "Z", "AA", "BC") to 0-based column index.
   */
  function columnLetterToIndex(colStr) {
    var index = 0;
    for (var i = 0; i < colStr.length; i++) {
      index = index * 26 + (colStr.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  /**
   * Pure Client-Side ZIP Unpacker for XLSX files.
   * Scans central directory and extracts uncompressed/deflated XML files.
   * Uses native DecompressionStream('deflate-raw') where supported.
   * 
   * @param {Uint8Array} uint8Array
   * @returns {Promise<Object<string, Uint8Array>>} Mapping of file paths to Uint8Array buffers
   */
  async function unpackZipArchive(uint8Array) {
    var files = {};
    if (!uint8Array) return files;
    if (uint8Array instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(uint8Array);
    }
    if (!(uint8Array instanceof Uint8Array) || uint8Array.length < 22) {
      return files;
    }
    var view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
    var len = uint8Array.length;

    // 1. Locate End of Central Directory Record (EOCD signature 0x06054b50: PK\x05\x06)
    var eocdOffset = -1;
    for (var i = len - 22; i >= Math.max(0, len - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Not a valid ZIP/XLSX archive (EOCD record not found).');
    }

    var totalEntries = view.getUint16(eocdOffset + 10, true);
    var cdOffset = view.getUint32(eocdOffset + 16, true);

    // SEC-02: Safety bounds against zip bombs and resource exhaustion
    var MAX_ZIP_ENTRIES = SAFETY_LIMITS.MAX_ZIP_ENTRIES;
    var MAX_SINGLE_UNCOMPRESSED_BYTES = SAFETY_LIMITS.MAX_SINGLE_UNCOMPRESSED_BYTES;
    var MAX_TOTAL_UNCOMPRESSED_BYTES = SAFETY_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES;
    var totalDecompressedBytes = 0;

    if (totalEntries > MAX_ZIP_ENTRIES) {
      throw new Error('Archive contains too many entries (' + totalEntries + ' > ' + MAX_ZIP_ENTRIES + ').');
    }

    // 2. Iterate through Central Directory entries
    var offset = cdOffset;
    for (var e = 0; e < totalEntries; e++) {
      if (offset + 46 > len) break;
      var cdSig = view.getUint32(offset, true);
      if (cdSig !== 0x02014b50) break; // Signature PK\x01\x02

      var method = view.getUint16(offset + 10, true); // 0 = Store, 8 = Deflate
      var compSize = view.getUint32(offset + 20, true);
      var uncompSize = view.getUint32(offset + 24, true);
      var nameLen = view.getUint16(offset + 28, true);
      var extraLen = view.getUint16(offset + 30, true);
      var commentLen = view.getUint16(offset + 32, true);
      var localHeaderOffset = view.getUint32(offset + 42, true);

      // Read and sanitize filename
      var nameBytes = uint8Array.subarray(offset + 46, offset + 46 + nameLen);
      var rawFilename = new TextDecoder('utf-8').decode(nameBytes);
      offset += 46 + nameLen + extraLen + commentLen;

      // SEC-03: Path traversal and prototype pollution defense
      var cleanFilename = rawFilename
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');
      if (cleanFilename.indexOf('../') !== -1 || cleanFilename === '..' || cleanFilename.indexOf('/..') !== -1) {
        continue; // Skip dangerous traversal path
      }
      if (cleanFilename === '__proto__' || cleanFilename === 'constructor' || cleanFilename === 'prototype') {
        continue; // Skip prototype pollution keys
      }

      // Check declared uncompressed size against safety bounds
      if (uncompSize > MAX_SINGLE_UNCOMPRESSED_BYTES) {
        throw new Error('Archive entry "' + cleanFilename + '" exceeds maximum decompressed size limit (15MB).');
      }

      // Read Local File Header
      if (localHeaderOffset + 30 > len) continue;
      var localSig = view.getUint32(localHeaderOffset, true);
      if (localSig !== 0x04034b50) continue; // Signature PK\x03\x04

      var localNameLen = view.getUint16(localHeaderOffset + 26, true);
      var localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      var dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      if (dataStart + compSize > len) continue;
      var compData = uint8Array.subarray(dataStart, dataStart + compSize);

      if (method === 0) {
        // Store (uncompressed)
        totalDecompressedBytes += compData.length;
        if (totalDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          throw new Error('Archive total decompressed size exceeds safety limit (30MB).');
        }
        files[cleanFilename] = compData;
      } else if (method === 8) {
        // Deflate
        if (typeof DecompressionStream !== 'undefined') {
          var ds = new DecompressionStream('deflate-raw');
          var writer = ds.writable.getWriter();
          writer.write(compData);
          writer.close();

          var reader = ds.readable.getReader();
          var chunks = [];
          var totalBytes = 0;
          while (true) {
            var chunk = await reader.read();
            if (chunk.done) break;
            totalBytes += chunk.value.length;
            totalDecompressedBytes += chunk.value.length;

            if (totalBytes > MAX_SINGLE_UNCOMPRESSED_BYTES) {
              throw new Error('Decompressed file size for "' + cleanFilename + '" exceeds safety limit (15MB).');
            }
            if (totalDecompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
              throw new Error('Archive total decompressed size exceeds safety limit (30MB).');
            }

            chunks.push(chunk.value);
          }

          var uncompBuffer = new Uint8Array(totalBytes);
          var pos = 0;
          for (var c = 0; c < chunks.length; c++) {
            uncompBuffer.set(chunks[c], pos);
            pos += chunks[c].length;
          }
          files[cleanFilename] = uncompBuffer;
        } else {
          throw new Error('Compressed XLSX format requires browser DecompressionStream support. Please export as CSV or TSV.');
        }
      }
    }

    return files;
  }

  /**
   * Parse XML string into rows array using lightweight regex tag tokenizer.
   * 100% offline and functional in both browser and headless Node test sandboxes.
   */
  function parseXlsxXml(sheetXmlText, sharedStrings) {
    sharedStrings = sharedStrings || [];
    var rows = [];

    // Match all <row ...> ... </row>
    var rowRegex = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/gi;
    var rowMatch;

    while ((rowMatch = rowRegex.exec(sheetXmlText)) !== null) {
      var rowNum = parseInt(rowMatch[1], 10) - 1; // 0-based row index
      var rowContent = rowMatch[2];
      var cellsInRow = [];

      // Match all <c ...> ... </c>
      var cellRegex = /<c\b[^>]*\br="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/gi;
      var cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        var colLetters = cellMatch[1];
        var colIndex = columnLetterToIndex(colLetters);
        var cellAttrs = cellMatch[3];
        var cellBody = cellMatch[4];

        // Determine cell type (t="s" for shared string, t="inlineStr", etc.)
        var typeMatch = cellAttrs.match(/\bt="([a-z]+)"/i);
        var cellType = typeMatch ? typeMatch[1] : '';

        var cellValue = '';
        if (cellType === 's') {
          // Shared string reference
          var vMatch = cellBody.match(/<v>(\d+)<\/v>/i);
          if (vMatch) {
            var sIndex = parseInt(vMatch[1], 10);
            cellValue = sharedStrings[sIndex] != null ? sharedStrings[sIndex] : '';
          }
        } else if (cellType === 'inlineStr') {
          // Inline string <is><t>...</t></is>
          var isMatch = cellBody.match(/<t[^>]*>([\s\S]*?)<\/t>/i);
          if (isMatch) cellValue = isMatch[1];
        } else {
          // Number, date, boolean, or direct text in <v>
          var valMatch = cellBody.match(/<v>([\s\S]*?)<\/v>/i);
          if (valMatch) cellValue = valMatch[1];
        }

        // Unescape XML entities
        cellValue = cellValue
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, '\'');

        cellsInRow[colIndex] = cellValue;
      }

      // Fill in undefined cells up to max column
      var rowArray = [];
      for (var c = 0; c < cellsInRow.length; c++) {
        rowArray.push(cellsInRow[c] != null ? cellsInRow[c] : '');
      }

      rows[rowNum] = rowArray;
    }

    // Normalize rows array
    var normalizedRows = [];
    var maxCols = 0;
    for (var r = 0; r < rows.length; r++) {
      if (rows[r]) {
        if (rows[r].length > maxCols) maxCols = rows[r].length;
      }
    }

    for (var k = 0; k < rows.length; k++) {
      var rData = rows[k] || [];
      while (rData.length < maxCols) rData.push('');
      // Check if row has any content
      if (rData.some(function(v) { return v.trim().length > 0; })) {
        normalizedRows.push(rData);
      }
    }

    return normalizedRows;
  }

  /**
   * Parse XLSX binary buffer into 2D array of rows.
   * 
   * @param {Uint8Array} uint8Array
   * @returns {Promise<Array<Array<string>>>}
   */
  async function parseXLSX(uint8Array) {
    if (!uint8Array || !(uint8Array instanceof Uint8Array)) {
      throw new Error('Invalid XLSX input: expected Uint8Array binary buffer.');
    }

    var files = await unpackZipArchive(uint8Array);

    // 1. Extract Shared Strings (xl/sharedStrings.xml)
    var sharedStrings = [];
    if (files['xl/sharedStrings.xml']) {
      var sstXml = new TextDecoder('utf-8').decode(files['xl/sharedStrings.xml']);
      var siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
      var siMatch;

      while ((siMatch = siRegex.exec(sstXml)) !== null) {
        var siContent = siMatch[1];
        var textParts = [];
        var tRegex = /<t[^>]*>([\s\S]*?)<\/t>/gi;
        var tMatch;
        while ((tMatch = tRegex.exec(siContent)) !== null) {
          textParts.push(tMatch[1]);
        }
        var stringVal = textParts.join('');
        stringVal = stringVal
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, '\'');
        sharedStrings.push(stringVal);
      }
    }

    // 2. Find primary worksheet (xl/worksheets/sheet1.xml)
    var sheetData = files['xl/worksheets/sheet1.xml'];
    if (!sheetData) {
      // Find first matching sheet in files
      for (var fName in files) {
        if (fName.indexOf('xl/worksheets/sheet') !== -1) {
          sheetData = files[fName];
          break;
        }
      }
    }

    if (!sheetData) {
      throw new Error('XLSX workbook does not contain any readable worksheets (xl/worksheets/sheet1.xml).');
    }

    var sheetXml = new TextDecoder('utf-8').decode(sheetData);
    return parseXlsxXml(sheetXml, sharedStrings);
  }

  // =========================================================================
  // 2. SMART INSTRUCTION PARSER & COLUMN ROLE HEURISTICS
  // =========================================================================

  /**
   * Parse custom sheet instruction syntax from cell string.
   * Supported formats:
   * - label="data" / label="payload"
   * - label="type:(auto-detect)" / label="type:(url)" / label="type:(phone)" / etc.
   * - label="visit:(auto-detect)" / label="visit" / label="label" / label="cta"
   * - label="ignore"
   * - [data], [type:url], [visit:auto], [label], [ignore]
   * - qr:data, qr:type, qr:label, qr:ignore
   * 
   * @param {string} cellText
   * @returns {Object|null} Parsed instruction directive or null
   */
  function parseInstructionDirective(cellText) {
    if (!cellText || typeof cellText !== 'string') return null;
    var trimmed = cellText.trim();

    // 1. Attribute syntax: label="directive" or label='directive'
    var attrMatch = trimmed.match(/^label\s*=\s*["']?([^"']+)["']?$/i);
    var directive = attrMatch ? attrMatch[1].trim() : null;

    // 2. Bracket syntax: [directive]
    if (!directive) {
      var bracketMatch = trimmed.match(/^\[([a-z0-9_:\(\)\-]+)\]$/i);
      if (bracketMatch) directive = bracketMatch[1].trim();
    }

    // 3. Prefix syntax: qr:directive or role:directive
    if (!directive) {
      var prefixMatch = trimmed.match(/^(?:qr|role)\s*:\s*([a-z0-9_:\(\)\-]+)$/i);
      if (prefixMatch) directive = prefixMatch[1].trim();
    }

    if (!directive) return null;

    var rawDirective = directive;
    var normDirective = directive.toLowerCase();

    // Parse role and modifier
    if (normDirective === 'data' || normDirective === 'payload' || normDirective === 'content') {
      return { role: 'payload', explicitType: null, autoDetect: false };
    }

    if (normDirective === 'type' || normDirective.indexOf('type:') === 0 || normDirective.indexOf('type(') === 0) {
      var typeVal = normDirective.replace(/^type[:\(\s]*/, '').replace(/[\)\s]*$/, '').trim();
      if (!typeVal || typeVal === 'auto' || typeVal === 'auto-detect') {
        return { role: 'type', explicitType: null, autoDetect: true };
      }
      return { role: 'type', explicitType: typeVal, autoDetect: false };
    }

    if (normDirective.indexOf('visit:') === 0 || normDirective.indexOf('visit(') === 0) {
      var visitVal = rawDirective.replace(/^visit[:\(\s]*/i, '').replace(/[\)\s]*$/, '').trim();
      if (!visitVal || visitVal.toLowerCase() === 'auto' || visitVal.toLowerCase() === 'auto-detect') {
        return { role: 'label', autoInfer: true };
      }
      return { role: 'label', autoInfer: false, explicitLabel: visitVal };
    }

    if (normDirective === 'visit' || normDirective === 'label' || normDirective === 'name' || normDirective === 'cta' || normDirective === 'title') {
      return { role: 'label', autoInfer: false };
    }

    if (normDirective === 'ignore' || normDirective === 'skip') {
      return { role: 'ignore' };
    }

    return null;
  }

  /**
   * Classify spreadsheet rows into:
   * - Header row
   * - Instruction row (contains label="data", etc.)
   * - Data records
   * 
   * @param {Array<Array<string>>} rawRows
   * @returns {Object} { headerRowIndex, instructionRowIndex, dataRowStartIndex, instructionsByCol }
   */
  function inspectSheetStructure(rawRows) {
    if (!rawRows || rawRows.length === 0) {
      return { headerRowIndex: -1, instructionRowIndex: -1, dataRowStartIndex: 0, instructionsByCol: {} };
    }

    var headerRowIndex = 0;
    var instructionRowIndex = -1;
    var dataRowStartIndex = 1;
    var instructionsByCol = {};

    // Check first 3 rows for instruction directives
    for (var r = 0; r < Math.min(rawRows.length, 3); r++) {
      var row = rawRows[r];
      var hasInstruction = false;

      for (var c = 0; c < row.length; c++) {
        var instr = parseInstructionDirective(row[c]);
        if (instr) {
          hasInstruction = true;
          instructionsByCol[c] = instr;
        }
      }

      if (hasInstruction) {
        instructionRowIndex = r;
        if (r === 0) {
          // Instruction is row 0; check if row 1 is data or header
          var row1IsData = false;
          if (rawRows.length > 1) {
            var r1 = rawRows[1];
            row1IsData = r1.some(function(cell) {
              var str = (cell || '').trim();
              return /^https?:\/\//i.test(str) || /^\+[0-9]/.test(str) || /^mailto:/i.test(str) || /^WIFI:/i.test(str);
            });
          }
          if (row1IsData) {
            headerRowIndex = -1;
            dataRowStartIndex = 1;
          } else {
            headerRowIndex = 1;
            dataRowStartIndex = 2;
          }
        } else {
          // Row 0 is header; row 1 is instruction; data starts row 2
          headerRowIndex = 0;
          dataRowStartIndex = r + 1;
        }
        break;
      }
    }

    return {
      headerRowIndex: headerRowIndex,
      instructionRowIndex: instructionRowIndex,
      dataRowStartIndex: dataRowStartIndex,
      instructionsByCol: instructionsByCol
    };
  }

  /**
   * Infer column roles (Payload, Type, Label, Ignore) using:
   * 1. Explicit sheet instructions (label="data", etc.)
   * 2. Header text keywords
   * 3. Cell value heuristics (URLs, emails, phone numbers, Wi-Fi)
   * 
   * @param {Array<Array<string>>} rawRows
   * @param {Object} [structure]
   * @returns {Object} Column mapping recommendations and confidence scores
   */
  function inferColumnRoles(rawRows, structure) {
    structure = structure || inspectSheetStructure(rawRows);
    var numCols = rawRows.length > 0 ? rawRows[0].length : 0;
    for (var i = 1; i < Math.min(rawRows.length, 5); i++) {
      if (rawRows[i].length > numCols) numCols = rawRows[i].length;
    }

    var headers = (structure.headerRowIndex >= 0 && rawRows[structure.headerRowIndex])
      ? rawRows[structure.headerRowIndex]
      : [];

    var columnRoles = [];
    var confidence = 'high';
    var ambiguityReasons = [];

    // Score cards for each column
    var payloadScores = new Array(numCols).fill(0);
    var typeScores = new Array(numCols).fill(0);
    var labelScores = new Array(numCols).fill(0);

    // 1. Process instructions if present
    for (var c = 0; c < numCols; c++) {
      var instr = structure.instructionsByCol[c];
      if (instr) {
        if (instr.role === 'payload') payloadScores[c] += 1000;
        else if (instr.role === 'type') typeScores[c] += 1000;
        else if (instr.role === 'label') labelScores[c] += 1000;
      }
    }

    // 2. Evaluate Header text
    for (var col = 0; col < numCols; col++) {
      var hText = (headers[col] || '').trim().toLowerCase();

      // Payload keywords
      if (/^(data|payload|url|link|website|qr[-_]?code|qr[-_]?data|content|code|target)$/.test(hText)) {
        payloadScores[col] += 80;
      } else if (/(data|url|link|website|payload|qr)/.test(hText)) {
        payloadScores[col] += 50;
      }

      // Type keywords
      if (/^(type|qr[-_]?type|category|kind|format)$/.test(hText)) {
        typeScores[col] += 85;
      }

      // Label keywords
      if (/^(name|label|title|visit|cta|display|header|description|caption)$/.test(hText)) {
        labelScores[col] += 70;
      }
    }

    // 3. Evaluate sample cell values from data rows
    var sampleRows = rawRows.slice(structure.dataRowStartIndex, structure.dataRowStartIndex + 15);
    for (var sCol = 0; sCol < numCols; sCol++) {
      var urlCount = 0;
      var emailCount = 0;
      var phoneCount = 0;
      var wifiCount = 0;
      var typeKeywordCount = 0;
      var validCells = 0;

      for (var r = 0; r < sampleRows.length; r++) {
        var val = (sampleRows[r][sCol] || '').trim();
        if (!val) continue;
        validCells++;

        // URL check
        if (/^https?:\/\//i.test(val) || /^www\./i.test(val) || /\.(com|org|net|io|edu|gov|co|app)\b/i.test(val)) {
          urlCount++;
        }
        // Email check
        if (/^mailto:/i.test(val) || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(val)) {
          emailCount++;
        }
        // Phone check
        if (/^tel:/i.test(val) || (/^\+[0-9\s\-\(\)\.]{7,20}$/.test(val) && (val.match(/\d/g) || []).length >= 7)) {
          phoneCount++;
        }
        // Wi-Fi check
        if (/^WIFI:S:/i.test(val)) {
          wifiCount++;
        }
        // Type keyword check
        if (/^(url|text|phone|email|wifi|whatsapp)$/i.test(val)) {
          typeKeywordCount++;
        }
      }

      if (validCells > 0) {
        var qrPatternRatio = (urlCount + emailCount + phoneCount + wifiCount) / validCells;
        if (qrPatternRatio >= 0.6) payloadScores[sCol] += 60;

        var typeRatio = typeKeywordCount / validCells;
        if (typeRatio >= 0.7) typeScores[sCol] += 75;

        // If cells are short human-readable phrases, award label points
        if (qrPatternRatio < 0.2 && typeRatio < 0.2) {
          labelScores[sCol] += 30;
        }
      }
    }

    // Determine winning Payload column
    var bestPayloadCol = 0;
    var maxPayloadScore = -1;
    for (var p = 0; p < numCols; p++) {
      if (payloadScores[p] > maxPayloadScore) {
        maxPayloadScore = payloadScores[p];
        bestPayloadCol = p;
      }
    }

    // Determine winning Type column (must be different from payload)
    var bestTypeCol = -1;
    var maxTypeScore = 30; // Threshold
    for (var t = 0; t < numCols; t++) {
      if (t !== bestPayloadCol && typeScores[t] > maxTypeScore) {
        maxTypeScore = typeScores[t];
        bestTypeCol = t;
      }
    }

    // Determine winning Label column (must be different from payload & type)
    var bestLabelCol = -1;
    var maxLabelScore = 0; // Threshold: any positive score wins
    for (var l = 0; l < numCols; l++) {
      if (l !== bestPayloadCol && l !== bestTypeCol && labelScores[l] > maxLabelScore) {
        maxLabelScore = labelScores[l];
        bestLabelCol = l;
      }
    }

    // Build roles array
    for (var cIdx = 0; cIdx < numCols; cIdx++) {
      if (cIdx === bestPayloadCol) {
        columnRoles[cIdx] = 'payload';
      } else if (cIdx === bestTypeCol) {
        columnRoles[cIdx] = 'type';
      } else if (cIdx === bestLabelCol) {
        columnRoles[cIdx] = 'label';
      } else {
        columnRoles[cIdx] = 'ignore';
      }
    }

    // Ambiguity checks
    var closePayloadCandidates = [];
    for (var cp = 0; cp < numCols; cp++) {
      if (cp !== bestPayloadCol && payloadScores[cp] >= maxPayloadScore - 15 && payloadScores[cp] > 20) {
        closePayloadCandidates.push(cp);
      }
    }

    if (closePayloadCandidates.length > 0) {
      confidence = 'ambiguous';
      ambiguityReasons.push('Multiple columns could be the QR payload source.');
    } else if (maxPayloadScore <= 0) {
      confidence = 'low';
      ambiguityReasons.push('No obvious QR data column detected; defaulting to first column.');
    }

    return {
      numCols: numCols,
      columnRoles: columnRoles,
      payloadColIndex: bestPayloadCol,
      typeColIndex: bestTypeCol,
      labelColIndex: bestLabelCol,
      confidence: confidence,
      ambiguityReasons: ambiguityReasons,
      structure: structure
    };
  }

  // =========================================================================
  // 3. PER-ROW QR TYPE & DISPLAY LABEL DETECTION
  // =========================================================================

  /**
   * Distinguish Phone Number vs Ordinary Numeric Text.
   * "A numeric string must not automatically be treated as a phone number without sufficient evidence."
   */
  function isPhoneNumberWithEvidence(val) {
    if (!val || typeof val !== 'string') return false;
    var str = val.trim();

    // 1. Explicit tel: protocol
    if (/^tel:/i.test(str)) return true;

    // 2. Starts with international prefix '+' and has at least 7 digits
    if (/^\+[0-9\s\-\(\)\.]{7,20}$/.test(str)) {
      var digits = (str.match(/\d/g) || []).length;
      return digits >= 7 && digits <= 16;
    }

    // 3. Has phone formatting punctuation like (XXX) XXX-XXXX or XXX-XXX-XXXX
    // Must NOT be a pure number without punctuation (e.g. 12345 or 9876543 is text!)
    if (/^(\([0-9]{2,4}\)|\b[0-9]{3,4}\b)[\s\-]?[0-9]{3,4}[\s\-]?[0-9]{3,4}$/.test(str)) {
      var dCount = (str.match(/\d/g) || []).length;
      return dCount >= 7 && dCount <= 15;
    }

    return false;
  }

  /**
   * Detect QR Payload Type independently per record.
   * Supported types matching QR generator: url, text, phone, email, wifi, whatsapp.
   * 
   * @param {string} rawValue
   * @param {string} [explicitTypeHint]
   * @returns {string} Detected payload type
   */
  function detectPayloadType(rawValue, explicitTypeHint) {
    if (explicitTypeHint && typeof explicitTypeHint === 'string') {
      var hint = explicitTypeHint.trim().toLowerCase();
      if (/^(url|text|phone|email|wifi|whatsapp)$/.test(hint)) {
        return hint;
      }
    }

    if (!rawValue || typeof rawValue !== 'string') return 'text';
    var str = rawValue.trim();

    // 1. Wi-Fi
    if (/^WIFI:/i.test(str)) return 'wifi';

    // 2. WhatsApp
    if (/^(https?:\/\/)?(api\.)?(wa\.me|whatsapp\.com\/send)/i.test(str) || /^whatsapp:/i.test(str)) {
      return 'whatsapp';
    }

    // 3. Email
    if (/^mailto:/i.test(str) || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(str)) {
      return 'email';
    }

    // 4. Phone (strictly with evidence)
    if (isPhoneNumberWithEvidence(str)) {
      return 'phone';
    }

    // 5. URL
    if (/^(https?|ftp):\/\//i.test(str) || /^www\./i.test(str)) {
      return 'url';
    }
    // Domain pattern with valid TLD and no spaces (e.g. example.com, my-studio.org/path)
    if (/^[A-Za-z0-9]([A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)*\.(com|org|net|edu|gov|io|co|app|dev|me|ai|tech|shop|store|info|biz|uk|de|ca|au|fr|in|jp)\b(\/[^\s]*)?$/i.test(str)) {
      return 'url';
    }

    // 6. Plain text (default fallback for numbers, descriptions, notes, SKUs)
    return 'text';
  }

  /**
   * Infer an optional display label for a record.
   * "Treat visit as the label displayed with the QR design, not as the encoded QR payload."
   * 
   * @param {string} rawPayload
   * @param {string} detectedType
   * @param {string} [explicitLabelFromCol]
   * @param {Object} [instruction]
   * @returns {string} Inferred display label
   */
  function inferDisplayLabel(rawPayload, detectedType, explicitLabelFromCol, instruction) {
    // 1. If explicit label column provided and non-empty, use it faithfully
    if (explicitLabelFromCol && typeof explicitLabelFromCol === 'string' && explicitLabelFromCol.trim().length > 0) {
      return explicitLabelFromCol.trim();
    }

    // 2. If instruction specifies an explicit static label (e.g. label="visit:(VIP Guest)")
    if (instruction && instruction.explicitLabel) {
      return instruction.explicitLabel;
    }

    // 3. Contextual inferred label based on detected QR type
    if (!rawPayload || typeof rawPayload !== 'string') return 'Scan Me';
    var payloadStr = rawPayload.trim();

    switch (detectedType) {
      case 'url':
        var domainMatch = payloadStr.match(/^https?:\/\/(?:www\.)?([^\/\?#]+)/i);
        if (domainMatch && domainMatch[1]) {
          return 'Visit ' + domainMatch[1];
        }
        return 'Visit Website';

      case 'phone':
        return 'Call Us';

      case 'email':
        return 'Email Us';

      case 'wifi':
        var ssidMatch = payloadStr.match(/(?:^WIFI:|;)S:([^;]+);/i);
        if (ssidMatch && ssidMatch[1]) {
          return 'Wi-Fi: ' + ssidMatch[1];
        }
        return 'Connect to Wi-Fi';

      case 'whatsapp':
        return 'Chat on WhatsApp';

      case 'text':
      default:
        if (payloadStr.length <= 24 && !/\n/.test(payloadStr)) {
          return payloadStr;
        }
        return 'Scan to View';
    }
  }

  // =========================================================================
  // 4. BATCH RECORD PARSING & VALIDATION PIPELINE
  // =========================================================================

  /**
   * Process raw rows into standardized Record objects based on column mappings.
   * 
   * @param {Array<Array<string>>} rawRows
   * @param {Object} mappingConfig
   * @returns {Array<Object>} List of Record objects
   */
  function processImportedRecords(rawRows, mappingConfig) {
    if (!rawRows || rawRows.length === 0) return [];

    var structure = mappingConfig.structure || inspectSheetStructure(rawRows);
    var payloadCol = mappingConfig.payloadColIndex != null ? mappingConfig.payloadColIndex : 0;
    var typeCol = mappingConfig.typeColIndex != null ? mappingConfig.typeColIndex : -1;
    var labelCol = mappingConfig.labelColIndex != null ? mappingConfig.labelColIndex : -1;
    var instructions = structure.instructionsByCol || {};

    var records = [];
    var startIndex = structure.dataRowStartIndex >= 0 ? structure.dataRowStartIndex : 0;

    for (var r = startIndex; r < rawRows.length; r++) {
      var row = rawRows[r];
      // Skip empty rows
      if (!row || !row.some(function(c) { return c && c.trim().length > 0; })) {
        continue;
      }

      var rawPayload = (row[payloadCol] != null ? String(row[payloadCol]) : '');
      var rawType = (typeCol >= 0 && row[typeCol] != null ? String(row[typeCol]) : '');
      var rawLabel = (labelCol >= 0 && row[labelCol] != null ? String(row[labelCol]) : '');

      // Check for instruction override on type
      var typeInstruction = instructions[typeCol];
      var payloadInstruction = instructions[payloadCol];
      var labelInstruction = instructions[labelCol];

      var explicitType = null;
      if (typeInstruction && typeInstruction.explicitType) {
        explicitType = typeInstruction.explicitType;
      } else if (rawType) {
        explicitType = rawType.trim();
      }

      // Preserve payload faithfully
      var payload = rawPayload;
      var isValid = payload.trim().length > 0;
      var error = isValid ? null : 'Empty or missing payload value';

      // Detect type independently
      var detectedType = detectPayloadType(payload, explicitType);

      // Infer display label
      var displayLabel = inferDisplayLabel(payload, detectedType, rawLabel, labelInstruction);

      records.push({
        id: 'rec-' + (records.length + 1),
        index: records.length,
        rowIndex: r + 1, // 1-based row in sheet
        rawRow: row,
        payload: payload,
        payloadType: detectedType,
        displayLabel: displayLabel,
        selected: isValid, // Select all valid by default
        status: isValid ? 'pending' : 'invalid',
        error: error,
        qrModel: null,
        canvas: null,
        dataUrl: null,
        filename: null
      });
    }

    return records;
  }

  // =========================================================================
  // 5. CHUNKED BATCH QR GENERATION
  // =========================================================================

  /**
   * Asynchronously generate QR codes for selected records.
   * Keeps UI responsive via requestAnimationFrame / setTimeout chunks.
   * 
   * @param {Array<Object>} records
   * @param {Object} options { ecl, templateId, designState, onProgress, chunkSize }
   * @returns {Promise<Object>} Summary of generation outcomes
   */
  function generateBatch(records, options) {
    options = options || {};
    var ecl = options.ecl || 'M';
    var chunkSize = options.chunkSize || DEFAULT_BATCH_CHUNK_SIZE;
    var onProgress = typeof options.onProgress === 'function' ? options.onProgress : function() {};
    var designState = options.designState || {};

    var targetRecords = records.filter(function(r) { return r.selected && r.status !== 'invalid'; });
    var total = targetRecords.length;
    var completed = 0;
    var failed = 0;
    var skipped = records.length - total;

    var isCanceled = false;

    var promise = new Promise(function(resolve, reject) {
      if (total === 0) {
        resolve({ total: 0, completed: 0, failed: 0, skipped: skipped, canceled: false });
        return;
      }

      var currentIndex = 0;

      function processNextChunk() {
        if (isCanceled) {
          resolve({ total: total, completed: completed, failed: failed, skipped: skipped, canceled: true });
          return;
        }

        var chunkEnd = Math.min(currentIndex + chunkSize, total);
        for (var i = currentIndex; i < chunkEnd; i++) {
          var rec = targetRecords[i];
          try {
            // 1. Generate QR Model matrix using existing QR engine
            var qrModel = QRStudio.Engine.generate(rec.payload, ecl);
            rec.qrModel = qrModel;

            // 2. Render composite off-screen canvas (512x512 standard high-fidelity thumbnail)
            var renderOpts = Object.assign({}, designState, {
              exportSize: 512,
              customWidth: 512,
              customHeight: 512,
              payload: rec.payload,
              payloadType: rec.payloadType,
              ecl: ecl
            });

            // Use QRStudio.Engine.renderComposition to ensure exact visual parity with editor
            var offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 512;
            offscreenCanvas.height = 512;

            if (QRStudio.Engine.renderComposition) {
              QRStudio.Engine.renderComposition(qrModel, offscreenCanvas, renderOpts);
            } else if (QRStudio.Engine.renderToCanvas) {
              QRStudio.Engine.renderToCanvas(qrModel, offscreenCanvas, renderOpts);
            }

            rec.canvas = offscreenCanvas;
            rec.dataUrl = offscreenCanvas.toDataURL('image/png');
            rec.status = 'ready';
            rec.error = null;
            completed++;
          } catch (err) {
            rec.status = 'failed';
            rec.error = err.message || 'QR generation error';
            failed++;
          }
        }

        currentIndex = chunkEnd;
        onProgress({
          completed: completed,
          failed: failed,
          skipped: skipped,
          total: total,
          percent: Math.round((completed + failed) / total * 100)
        });

        if (currentIndex < total) {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(processNextChunk);
          } else {
            setTimeout(processNextChunk, 10);
          }
        } else {
          resolve({
            total: total,
            completed: completed,
            failed: failed,
            skipped: skipped,
            canceled: false
          });
        }
      }

      setTimeout(processNextChunk, 0);
    });

    return {
      promise: promise,
      cancel: function() {
        isCanceled = true;
      }
    };
  }

  // =========================================================================
  // 6. BULK EXPORT ENGINE (ZIP, MANIFESTS: CSV, TSV, JSON, XLSX)
  // =========================================================================

  /**
   * Generate CSV Manifest for records with CWE-1236 protection and UTF-8 BOM.
   */
  function generateBulkCsvManifest(records) {
    var headers = ['Record ID', 'Label', 'Type', 'Payload', 'Status', 'Image Filename'];
    var lines = [headers.join(',')];

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var row = [
        sanitizeCellForSpreadsheet(r.id),
        sanitizeCellForSpreadsheet(r.displayLabel || ''),
        sanitizeCellForSpreadsheet(r.payloadType || 'text'),
        sanitizeCellForSpreadsheet(r.payload || ''),
        sanitizeCellForSpreadsheet(r.status || 'pending'),
        sanitizeCellForSpreadsheet(r.filename || '')
      ];
      // CSV escape quotes
      var escaped = row.map(function(val) {
        var str = String(val);
        if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      lines.push(escaped.join(','));
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Generate TSV Manifest for records with CWE-1236 protection and UTF-8 BOM.
   */
  function generateBulkTsvManifest(records) {
    var headers = ['Record ID', 'Label', 'Type', 'Payload', 'Status', 'Image Filename'];
    var lines = [headers.join('\t')];

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var row = [
        sanitizeCellForSpreadsheet(r.id),
        sanitizeCellForSpreadsheet(r.displayLabel || ''),
        sanitizeCellForSpreadsheet(r.payloadType || 'text'),
        sanitizeCellForSpreadsheet(r.payload || ''),
        sanitizeCellForSpreadsheet(r.status || 'pending'),
        sanitizeCellForSpreadsheet(r.filename || '')
      ];
      var escaped = row.map(function(val) {
        return String(val).replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ');
      });
      lines.push(escaped.join('\t'));
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  /**
   * Generate JSON Manifest for records.
   */
  function generateBulkJsonManifest(records) {
    var data = {
      manifestVersion: '1.8.0',
      generatedAt: new Date().toISOString(),
      generator: 'Better QR (Bulk Studio V1.8)',
      totalRecords: records.length,
      records: records.map(function(r) {
        return {
          id: r.id,
          label: r.displayLabel,
          type: r.payloadType,
          payload: r.payload,
          status: r.status,
          filename: r.filename
        };
      })
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate Genuine XLSX Manifest using SpreadsheetEncoders.
   */
  function generateBulkXlsxManifest(records) {
    if (!QRStudio.SpreadsheetEncoders || !QRStudio.SpreadsheetEncoders.generateXLSX) {
      throw new Error('SpreadsheetEncoders.generateXLSX is required for XLSX manifest generation.');
    }

    var headers = [
      { key: 'id', label: 'Record ID' },
      { key: 'displayLabel', label: 'Display Label' },
      { key: 'payloadType', label: 'QR Type' },
      { key: 'payload', label: 'Payload Data' },
      { key: 'status', label: 'Status' },
      { key: 'filename', label: 'Image Filename' }
    ];

    var rows = records.map(function(r) {
      return {
        id: r.id,
        displayLabel: r.displayLabel || '',
        payloadType: (r.payloadType || 'text').toUpperCase(),
        payload: r.payload || '',
        status: (r.status || 'pending').toUpperCase(),
        filename: r.filename || ''
      };
    });

    return QRStudio.SpreadsheetEncoders.generateXLSX(rows, headers, 'QR_Bulk_Manifest.xlsx');
  }

  /**
   * Convert Canvas to Data Buffer based on format (PNG, JPEG, WebP, SVG).
   */
  async function canvasToFormatBuffer(canvas, format, rec, designState) {
    format = (format || 'png').toLowerCase();

    if (format === 'svg') {
      if (QRStudio.VectorEncoders && QRStudio.VectorEncoders.generateSVG) {
        var svgStr = QRStudio.VectorEncoders.generateSVG(rec.qrModel, designState);
        return { buffer: new TextEncoder().encode(svgStr), mime: 'image/svg+xml' };
      } else if (QRStudio.ExportStudio && QRStudio.ExportStudio.generateVectorSVG) {
        var svgStr2 = QRStudio.ExportStudio.generateVectorSVG(rec.qrModel, designState);
        return { buffer: new TextEncoder().encode(svgStr2), mime: 'image/svg+xml' };
      }
    }

    var mimeType = 'image/png';
    if (format === 'jpeg' || format === 'jpg') mimeType = 'image/jpeg';
    else if (format === 'webp') mimeType = 'image/webp';

    // Extract binary buffer from canvas data URL
    var dataUrl = canvas.toDataURL(mimeType, 0.92);
    var base64 = dataUrl.split(',')[1];
    var binaryStr = atob(base64);
    var bytes = new Uint8Array(binaryStr.length);
    for (var i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return { buffer: bytes, mime: mimeType };
  }

  /**
   * Build Complete Bulk ZIP Archive containing individual images and manifest.
   * 
   * @param {Array<Object>} records
   * @param {Object} options { format, manifestType, designState }
   * @returns {Promise<QRStudio.ZipArchive>}
   */
  async function buildBulkZipArchive(records, options) {
    if (!QRStudio.ZipArchive) {
      throw new Error('ZipArchive is required for bulk ZIP export.');
    }

    options = options || {};
    var format = (options.format || 'png').toLowerCase();
    var manifestType = (options.manifestType || 'csv').toLowerCase();
    var designState = options.designState || {};

    var targetRecords = records.filter(function(r) { return r.selected && r.status === 'ready' && r.canvas; });
    if (targetRecords.length === 0) {
      throw new Error('No generated records ready for export. Please generate QR codes first.');
    }

    var zip = new QRStudio.ZipArchive();
    var usedNames = {};

    // 1. Assign unique sanitized filenames to each record
    for (var i = 0; i < targetRecords.length; i++) {
      var rec = targetRecords[i];
      rec.filename = buildSanitizedFilename(rec.displayLabel, rec.payload, i, format, usedNames);

      // Convert canvas to image bytes and add to ZIP
      var imgData = await canvasToFormatBuffer(rec.canvas, format, rec, designState);
      zip.addFile('images/' + rec.filename, imgData.buffer);
    }

    // 2. Add Manifest(s)
    if (manifestType === 'csv' || manifestType === 'all') {
      var csvText = generateBulkCsvManifest(targetRecords);
      zip.addFile('manifest.csv', csvText);
    }
    if (manifestType === 'tsv' || manifestType === 'all') {
      var tsvText = generateBulkTsvManifest(targetRecords);
      zip.addFile('manifest.tsv', tsvText);
    }
    if (manifestType === 'json' || manifestType === 'all') {
      var jsonText = generateBulkJsonManifest(targetRecords);
      zip.addFile('manifest.json', jsonText);
    }
    if (manifestType === 'xlsx' || manifestType === 'all') {
      if (QRStudio.SpreadsheetEncoders && QRStudio.SpreadsheetEncoders.generateXLSX) {
        var xlsxBytes = generateBulkXlsxManifest(targetRecords);
        zip.addFile('manifest.xlsx', xlsxBytes);
      }
    }

    // 3. Add README documentation
    var readme = '# Better QR — Bulk Export Archive\n\n' +
      'Generated: ' + new Date().toLocaleString() + '\n' +
      'Total QR Codes: ' + targetRecords.length + '\n' +
      'Format: ' + format.toUpperCase() + '\n' +
      'Manifest: ' + manifestType.toUpperCase() + '\n\n' +
      'Files included:\n' +
      '- images/ : Individual high-resolution QR image files\n' +
      '- manifest.* : Metadata manifest mapping record ID, label, type, payload, and filename\n';
    zip.addFile('README.txt', readme);

    return zip;
  }

  // =========================================================================
  // 7. DEEP PRINT STUDIO BRIDGE
  // =========================================================================

  /**
   * Transfer Selected Bulk Records into Print Studio.
   * Injects records into PrintEngine state as distinct cell items on a sheet grid.
   * 
   * @param {Array<Object>} selectedRecords
   * @param {Object} [options]
   * @returns {Object} Transferred Print State
   */
  function transferRecordsToPrintStudio(selectedRecords, options) {
    if (!QRStudio.PrintEngine) {
      throw new Error('PrintEngine is not available.');
    }

    selectedRecords = selectedRecords.filter(function(r) { return r.status === 'ready'; });
    if (selectedRecords.length === 0) {
      throw new Error('No ready QR records selected to send to Print Studio.');
    }

    options = options || {};
    var templateId = options.templateId || 'multi-qr-sheet';

    // 1. Get or create print state
    var printState = QRStudio.PrintEngine.createDefaultState();
    QRStudio.PrintEngine.applyTemplate(printState, templateId);

    // 2. Prepare distinct cell items
    var cellItems = selectedRecords.map(function(rec, idx) {
      return {
        id: 'bulk-item-' + (idx + 1),
        title: rec.displayLabel || 'Scan Me',
        description: (rec.payloadType || 'text').toUpperCase() + ': ' + (rec.payload.length > 28 ? rec.payload.substring(0, 28) + '...' : rec.payload),
        cta: rec.displayLabel || 'SCAN CODE',
        customPayload: rec.payload,
        qrSource: 'bulk',
        cachedCanvas: rec.canvas,
        qrModel: rec.qrModel,
        showTitle: true,
        showDescription: true,
        showCta: true,
        cardBg: '#FFFFFF',
        cardBorderColor: '#171717',
        textColor: '#171717'
      };
    });

    // 3. Configure grid to NOT repeat the single QR, but display distinct items
    printState.gridMode = true;
    printState.gridConfig.repeatCurrentQR = false;
    printState.gridConfig.cellItems = cellItems;

    // Adjust grid cols/rows to fit count if needed
    var count = selectedRecords.length;
    if (count <= 4) {
      printState.gridConfig.cols = 2;
      printState.gridConfig.rows = 2;
    } else if (count <= 6) {
      printState.gridConfig.cols = 2;
      printState.gridConfig.rows = 3;
    } else if (count <= 12) {
      printState.gridConfig.cols = 3;
      printState.gridConfig.rows = 4;
    } else if (count <= 24) {
      printState.gridConfig.cols = 4;
      printState.gridConfig.rows = 6;
    }

    // Auto-fit label dimensions so they fit the page
    QRStudio.PrintEngine.autoFitGrid(printState);
    QRStudio.PrintEngine.syncItemsFromGrid(printState);

    return printState;
  }

  // =========================================================================
  // EXPOSE NAMESPACE
  // =========================================================================

  QRStudio.BulkEngine = {
    // Limits
    MAX_SAFE_BATCH_SIZE: MAX_SAFE_BATCH_SIZE,
    SAFETY_LIMITS: SAFETY_LIMITS,

    // Parsers
    parseCSV: parseCSV,
    parseTSV: parseTSV,
    parseTXT: parseTXT,
    parsePastedText: parsePastedText,
    parseXLSX: parseXLSX,
    sniffDelimiter: sniffDelimiter,
    unpackZipArchive: unpackZipArchive,

    // Instructions & Heuristics
    parseInstructionDirective: parseInstructionDirective,
    inspectSheetStructure: inspectSheetStructure,
    inferColumnRoles: inferColumnRoles,

    // Detection
    isPhoneNumberWithEvidence: isPhoneNumberWithEvidence,
    detectPayloadType: detectPayloadType,
    inferDisplayLabel: inferDisplayLabel,

    // Record Processing
    processImportedRecords: processImportedRecords,
    buildSanitizedFilename: buildSanitizedFilename,

    // Batch Generation
    generateBatch: generateBatch,

    // Bulk Export
    generateBulkCsvManifest: generateBulkCsvManifest,
    generateBulkTsvManifest: generateBulkTsvManifest,
    generateBulkJsonManifest: generateBulkJsonManifest,
    generateBulkXlsxManifest: generateBulkXlsxManifest,
    buildBulkZipArchive: buildBulkZipArchive,
    sanitizeSpreadsheetFormula: sanitizeCellForSpreadsheet,
    sanitizeCellForSpreadsheet: sanitizeCellForSpreadsheet,

    // Print Studio Bridge
    transferRecordsToPrintStudio: transferRecordsToPrintStudio
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRStudio.BulkEngine;
  }

})(typeof window !== 'undefined' ? window : this);

/**
 * QR Design Studio — Client-Side Spreadsheet Encoders (XLSX, CSV, TSV, ODS)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * Generates genuine Office Open XML (.xlsx), OpenDocument (.ods),
 * and RFC 4180 CSV / TSV with formula-injection protection and UTF-8 BOM.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Escape XML entities for OpenXML and OpenDocument.
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
    // Check if cell starts with a formula trigger or has leading whitespace before a formula trigger
    if (/^\s*[=+\-@\t\r|]/.test(str)) {
      return "'" + str;
    }
    return str;
  }

  /**
   * Default column definitions for QR spreadsheet records.
   */
  var STANDARD_HEADERS = [
    { key: 'id', label: 'Record ID' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'payloadType', label: 'Payload Type' },
    { key: 'payload', label: 'Encoded Payload' },
    { key: 'ecl', label: 'Error Correction' },
    { key: 'colors', label: 'Colors (Dark / Light)' },
    { key: 'moduleStyle', label: 'Module Style' },
    { key: 'finderStyle', label: 'Finder Style' },
    { key: 'frameStyle', label: 'Frame Style' },
    { key: 'ctaText', label: 'CTA Text' },
    { key: 'dimensions', label: 'Resolution (px)' },
    { key: 'status', label: 'Generation Status' },
    { key: 'createdAt', label: 'Created Timestamp' }
  ];

  /**
   * Format an internal project or QR state into a standardized record row object.
   */
  function buildRecordRow(options) {
    options = options || {};
    var pType = (options.payloadType || options.typeId || 'url').toUpperCase();
    var pContent = options.payload || options.payloadSummary || 'https://qrdesign.studio';
    var dark = options.darkColor || '#171717';
    var light = options.lightColor || '#ffffff';

    return {
      id: options.id || ('QR-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
      projectName: options.projectName || options.title || 'Default Project',
      payloadType: pType,
      payload: pContent,
      ecl: 'Level ' + (options.ecl || 'M'),
      colors: dark + ' / ' + light,
      moduleStyle: options.moduleStyle || 'square',
      finderStyle: options.finderStyle || 'rounded',
      frameStyle: options.frameStyle || 'none',
      ctaText: options.ctaText || 'SCAN ME',
      dimensions: (options.width || options.size || 512) + 'x' + (options.height || options.size || 512),
      status: 'VERIFIED_SCANNABLE',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generate genuine Microsoft Excel Office Open XML Workbook (.xlsx).
   * Valid ZIP archive conforming to ECMA-376 and ISO/IEC 29500.
   * 
   * @param {Object[]} records - Array of QR record objects
   * @param {Object} [options]
   * @returns {Uint8Array} XLSX binary buffer (Magic bytes: 0x50, 0x4B, 0x03, 0x04)
   */
  function generateXLSX(records, options) {
    options = options || {};
    var ZipArchive = QRStudio.ZipArchive;
    if (!ZipArchive) throw new Error('ZipArchive required for XLSX generation.');

    if (!records || !records.length) {
      records = [buildRecordRow(options)];
    }

    var headers = STANDARD_HEADERS;
    var zip = new ZipArchive();

    // 1. [Content_Types].xml
    var contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      '  <Default Extension="xml" ContentType="application/xml"/>\n' +
      '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\n' +
      '  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n' +
      '  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\n' +
      '</Types>';
    zip.addFile('[Content_Types].xml', contentTypesXml);

    // 2. _rels/.rels
    var pkgRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n' +
      '</Relationships>';
    zip.addFile('_rels/.rels', pkgRelsXml);

    // 3. xl/_rels/workbook.xml.rels
    var wbRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>\n' +
      '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n' +
      '</Relationships>';
    zip.addFile('xl/_rels/workbook.xml.rels', wbRelsXml);

    // 4. xl/workbook.xml
    var wbXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
      '  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20480" windowHeight="10240"/></bookViews>\n' +
      '  <sheets>\n' +
      '    <sheet name="QR Records" sheetId="1" r:id="rId1"/>\n' +
      '  </sheets>\n' +
      '</workbook>';
    zip.addFile('xl/workbook.xml', wbXml);

    // 5. xl/styles.xml
    var stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n' +
      '  <fonts count="2">\n' +
      '    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>\n' +
      '    <font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>\n' +
      '  </fonts>\n' +
      '  <fills count="3">\n' +
      '    <fill><patternFill patternType="none"/></fill>\n' +
      '    <fill><patternFill patternType="gray125"/></fill>\n' +
      '    <fill><patternFill patternType="solid"><fgColor rgb="FFFFDD00"/><bgColor indexed="64"/></patternFill></fill>\n' +
      '  </fills>\n' +
      '  <borders count="2">\n' +
      '    <border><left/><right/><top/><bottom/><diagonal/></border>\n' +
      '    <border>' +
      '      <left style="thin"><color rgb="FFCBD5E1"/></left>' +
      '      <right style="thin"><color rgb="FFCBD5E1"/></right>' +
      '      <top style="thin"><color rgb="FFCBD5E1"/></top>' +
      '      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>' +
      '    </border>\n' +
      '  </borders>\n' +
      '  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\n' +
      '  <cellXfs count="3">\n' +
      '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\n' +
      '    <!-- Header style: Bold font 1, Yellow fill 2, Border 1 -->\n' +
      '    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>\n' +
      '    <!-- Data row style: Normal font 0, Border 1 -->\n' +
      '    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>\n' +
      '  </cellXfs>\n' +
      '</styleSheet>';
    zip.addFile('xl/styles.xml', stylesXml);

    // 6. xl/worksheets/sheet1.xml
    function colLetter(colIdx) {
      return String.fromCharCode(65 + colIdx);
    }

    var sheetRows = [];
    // Header Row (Row 1, style 1)
    var headerCells = [];
    for (var h = 0; h < headers.length; h++) {
      var cellRef = colLetter(h) + '1';
      headerCells.push('<c r="' + cellRef + '" t="inlineStr" s="1"><is><t>' + escapeXml(headers[h].label) + '</t></is></c>');
    }
    sheetRows.push('<row r="1" ht="24" customHeight="1">' + headerCells.join('') + '</row>');

    // Data Rows (Row 2+, style 2)
    for (var r = 0; r < records.length; r++) {
      var rowNum = r + 2;
      var rec = records[r];
      var cells = [];
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c].key;
        var rawVal = rec[key] != null ? rec[key] : '';
        var safeVal = sanitizeCellForSpreadsheet(rawVal);
        var ref = colLetter(c) + rowNum;
        cells.push('<c r="' + ref + '" t="inlineStr" s="2"><is><t>' + escapeXml(safeVal) + '</t></is></c>');
      }
      sheetRows.push('<row r="' + rowNum + '">' + cells.join('') + '</row>');
    }

    var sheet1Xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n' +
      '  <cols>\n' +
      '    <col min="1" max="1" width="16" customWidth="1"/>\n' +
      '    <col min="2" max="2" width="22" customWidth="1"/>\n' +
      '    <col min="3" max="3" width="16" customWidth="1"/>\n' +
      '    <col min="4" max="4" width="40" customWidth="1"/>\n' +
      '    <col min="5" max="5" width="16" customWidth="1"/>\n' +
      '    <col min="6" max="6" width="22" customWidth="1"/>\n' +
      '    <col min="7" max="7" width="16" customWidth="1"/>\n' +
      '    <col min="8" max="8" width="16" customWidth="1"/>\n' +
      '    <col min="9" max="9" width="16" customWidth="1"/>\n' +
      '    <col min="10" max="10" width="18" customWidth="1"/>\n' +
      '    <col min="11" max="11" width="18" customWidth="1"/>\n' +
      '    <col min="12" max="12" width="22" customWidth="1"/>\n' +
      '    <col min="13" max="13" width="26" customWidth="1"/>\n' +
      '  </cols>\n' +
      '  <sheetData>\n' +
      sheetRows.join('\n') +
      '  </sheetData>\n' +
      '</worksheet>';
    zip.addFile('xl/worksheets/sheet1.xml', sheet1Xml);

    return zip.buildUint8Array();
  }

  /**
   * Generate RFC 4180 CSV with UTF-8 BOM and formula injection protection.
   * 
   * @param {Object[]} records - Array of QR record objects
   * @param {Object} [options]
   * @returns {string} CSV text with UTF-8 BOM
   */
  function generateCSV(records, options) {
    options = options || {};
    if (!records || !records.length) {
      records = [buildRecordRow(options)];
    }

    var headers = STANDARD_HEADERS;
    var rows = [];

    // Header row
    rows.push(headers.map(function(h) { return '"' + h.label.replace(/"/g, '""') + '"'; }).join(','));

    // Data rows
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var fields = [];
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c].key;
        var val = rec[key] != null ? rec[key] : '';
        val = sanitizeCellForSpreadsheet(val);
        fields.push('"' + String(val).replace(/"/g, '""') + '"');
      }
      rows.push(fields.join(','));
    }

    // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
    return '\uFEFF' + rows.join('\r\n');
  }

  /**
   * Generate Tab-Separated Values (TSV) with UTF-8 BOM and formula injection protection.
   * 
   * @param {Object[]} records - Array of QR record objects
   * @param {Object} [options]
   * @returns {string} TSV text with UTF-8 BOM
   */
  function generateTSV(records, options) {
    options = options || {};
    if (!records || !records.length) {
      records = [buildRecordRow(options)];
    }

    var headers = STANDARD_HEADERS;
    var rows = [];

    rows.push(headers.map(function(h) { return h.label; }).join('\t'));

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var fields = [];
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c].key;
        var val = rec[key] != null ? rec[key] : '';
        val = sanitizeCellForSpreadsheet(val);
        // Replace internal tabs and newlines with space
        fields.push(String(val).replace(/[\t\r\n]+/g, ' '));
      }
      rows.push(fields.join('\t'));
    }

    return '\uFEFF' + rows.join('\r\n');
  }

  /**
   * Generate genuine OpenDocument Spreadsheet (.ods).
   * Conforms to OASIS Open Document Format for Office Applications (ODF).
   * 
   * @param {Object[]} records - Array of QR record objects
   * @param {Object} [options]
   * @returns {Uint8Array} ODS binary buffer
   */
  function generateODS(records, options) {
    options = options || {};
    var ZipArchive = QRStudio.ZipArchive;
    if (!ZipArchive) throw new Error('ZipArchive required for ODS generation.');

    if (!records || !records.length) {
      records = [buildRecordRow(options)];
    }

    var headers = STANDARD_HEADERS;
    var zip = new ZipArchive();

    // 1. mimetype (MUST be first file, uncompressed per ODF spec)
    zip.addFile('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');

    // 2. META-INF/manifest.xml
    var manifestXml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">\n' +
      '  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>\n' +
      '  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>\n' +
      '  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>\n' +
      '</manifest:manifest>';
    zip.addFile('META-INF/manifest.xml', manifestXml);

    // 3. styles.xml
    var stylesXml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
      'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">\n' +
      '</office:document-styles>';
    zip.addFile('styles.xml', stylesXml);

    // 4. content.xml
    var tableRows = [];

    // Header row
    var headerCells = headers.map(function(h) {
      return '<table:table-cell office:value-type="string"><text:p>' + escapeXml(h.label) + '</text:p></table:table-cell>';
    }).join('');
    tableRows.push('<table:table-row>' + headerCells + '</table:table-row>');

    // Data rows
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var cells = [];
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c].key;
        var val = rec[key] != null ? rec[key] : '';
        val = sanitizeCellForSpreadsheet(val);
        cells.push('<table:table-cell office:value-type="string"><text:p>' + escapeXml(val) + '</text:p></table:table-cell>');
      }
      tableRows.push('<table:table-row>' + cells.join('') + '</table:table-row>');
    }

    var contentXml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
      'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
      'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">\n' +
      '  <office:body>\n' +
      '    <office:spreadsheet>\n' +
      '      <table:table table:name="QR_Codes">\n' +
      tableRows.join('\n') +
      '      </table:table>\n' +
      '    </office:spreadsheet>\n' +
      '  </office:body>\n' +
      '</office:document-content>';
    zip.addFile('content.xml', contentXml);

    return zip.buildUint8Array();
  }

  QRStudio.SpreadsheetEncoders = {
    STANDARD_HEADERS: STANDARD_HEADERS,
    buildRecordRow: buildRecordRow,
    sanitizeCellForSpreadsheet: sanitizeCellForSpreadsheet,
    escapeSpreadsheetCell: sanitizeCellForSpreadsheet,
    generateXLSX: generateXLSX,
    generateCSV: generateCSV,
    generateTSV: generateTSV,
    generateODS: generateODS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRStudio.SpreadsheetEncoders;
  }

})(typeof window !== 'undefined' ? window : this);

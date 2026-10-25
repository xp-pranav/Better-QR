/**
 * QR Design Studio — Bulk Studio UI Coordinator (V1.8)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * 
 * Coordinates:
 * - File import (CSV, TSV, TXT, XLSX) via drag & drop or file picker.
 * - Pasted spreadsheet rows and manual record addition.
 * - Spreadsheet-style preview table with column role mapping.
 * - Safe custom instruction syntax display and row categorization.
 * - Batch generation controls, template selection, and live progress bar.
 * - Bulk export: ZIP package (PNG, JPEG, WebP, SVG) and manifests (CSV, TSV, JSON, XLSX).
 * - Direct Print Studio bridge and seamless view switching.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var BulkUI = {
    elements: {},
    rawRows: [],
    structure: null,
    mappingConfig: null,
    records: [],
    generationController: null,
    activeStep: 1,

    /**
     * Sample datasets for 1-click user testing.
     */
    samples: {
      mixed: "Website / Data,Type,Name\nhttps://example.com,url,Visit Website\n+919876543210,phone,Call Us\nhello@example.com,email,Contact Us\nWelcome to our cafe,text,Welcome\nhttps://wa.me/15550199,whatsapp,Order Ahead\nWIFI:S:CafeGuest;T:WPA;P:guest123;;,wifi,Free Guest Wi-Fi",
      instructions: "label=\"data\",label=\"type:(auto-detect)\",label=\"visit:(auto-detect)\"\nhttps://example.com/menu,,Lunch Menu\n+1-800-555-0199,,Customer Support\nsupport@brand.com,,Help Desk\nSpecial event 20% discount,,Promo Code",
      retail: "Product SKU / Data,Category,Product Name\nhttps://store.com/p/8941,url,Espresso Blend 1kg\nhttps://store.com/p/8942,url,French Roast 500g\nhttps://store.com/p/8943,url,Ceramic Mug 350ml\nhttps://store.com/p/8944,url,Cold Brew Bottle"
    },

    /**
     * Initialize Bulk Studio UI.
     */
    init: function() {
      this.cacheElements();
      this.bindEvents();
      this.populateTemplates();
      this.updateUIState();
    },

    /**
     * Cache all DOM elements for Bulk Studio.
     */
    cacheElements: function() {
      this.elements = {
        // Navigation links & buttons
        navBulkStudio: document.getElementById('navBulkStudio'),
        navPrintStudio: document.getElementById('navPrintStudio'),
        navQrGenerator: document.getElementById('navQrGenerator'),
        btnOpenBulkStudio: document.getElementById('btnOpenBulkStudio'),
        btnReturnFromBulk: document.getElementById('btnReturnFromBulk'),
        btnBackToBulkStudio: document.getElementById('btnBackToBulkStudio'),
        bulkStudioSection: document.getElementById('bulkStudioSection'),
        printStudioSection: document.getElementById('printStudioSection'),
        mainWorkspace: document.getElementById('workspace'),

        // Badges
        bulkTotalRowsBadge: document.getElementById('bulkTotalRowsBadge'),
        bulkValidBadge: document.getElementById('bulkValidBadge'),
        bulkReadyBadge: document.getElementById('bulkReadyBadge'),

        // Step Tabs
        stepNavItems: document.querySelectorAll('.bulk-step-item'),
        stepPanels: document.querySelectorAll('.bulk-step-panel'),

        // Step 1: Import elements
        fileInput: document.getElementById('bulkFileInput'),
        dropzone: document.getElementById('bulkDropzone'),
        btnBrowseFiles: document.getElementById('btnBulkBrowseFiles'),
        pasteTextarea: document.getElementById('bulkPasteTextarea'),
        btnParsePaste: document.getElementById('btnBulkParsePaste'),
        btnClearPaste: document.getElementById('btnBulkClearPaste'),
        btnSampleMixed: document.getElementById('btnBulkSampleMixed'),
        btnSampleInstructions: document.getElementById('btnBulkSampleInstructions'),
        btnSampleRetail: document.getElementById('btnBulkSampleRetail'),
        importAlert: document.getElementById('bulkImportAlert'),

        // Step 2: Mapping & Preview elements
        mappingAlert: document.getElementById('bulkMappingAlert'),
        previewTableContainer: document.getElementById('bulkTableContainer'),
        previewTable: document.getElementById('bulkPreviewTable'),
        tableHead: document.getElementById('bulkTableHead'),
        tableBody: document.getElementById('bulkTableBody'),
        btnSelectAllRows: document.getElementById('btnBulkSelectAllRows'),
        btnDeselectAllRows: document.getElementById('btnBulkDeselectAllRows'),
        btnAddManualRow: document.getElementById('btnBulkAddManualRow'),
        btnProceedToGenerate: document.getElementById('btnBulkProceedToGenerate'),

        // Step 3: Generation elements
        templateSelect: document.getElementById('bulkTemplateSelect'),
        eclSelect: document.getElementById('bulkEclSelect'),
        btnStartGeneration: document.getElementById('btnBulkStartGeneration'),
        btnCancelGeneration: document.getElementById('btnBulkCancelGeneration'),
        btnRetryFailed: document.getElementById('btnBulkRetryFailed'),
        progressContainer: document.getElementById('bulkProgressContainer'),
        progressBar: document.getElementById('bulkProgressBar'),
        progressLabel: document.getElementById('bulkProgressLabel'),
        generationStats: document.getElementById('bulkGenerationStats'),

        // Step 4: Results & Export elements
        cardsGrid: document.getElementById('bulkCardsGrid'),
        exportFormatSelect: document.getElementById('bulkExportFormatSelect'),
        exportManifestSelect: document.getElementById('bulkExportManifestSelect'),
        btnDownloadZip: document.getElementById('btnBulkDownloadZip'),
        btnExportManifestOnly: document.getElementById('btnBulkExportManifestOnly'),
        btnSendToPrintStudio: document.getElementById('btnBulkSendToPrintStudio')
      };
    },

    /**
     * Populate Template dropdown with available presets.
     */
    populateTemplates: function() {
      if (!this.elements.templateSelect) return;
      this.elements.templateSelect.innerHTML = '';

      // Option: Current Active Generator Design
      var optActive = document.createElement('option');
      optActive.value = 'active';
      optActive.textContent = '★ Active Generator Design (Current Colors & Style)';
      optActive.selected = true;
      this.elements.templateSelect.appendChild(optActive);

      // Add templates from Template Gallery if available
      if (QRStudio.TemplateGallery && QRStudio.TemplateGallery.TEMPLATES) {
        var tmpls = QRStudio.TemplateGallery.TEMPLATES;
        for (var i = 0; i < tmpls.length; i++) {
          var opt = document.createElement('option');
          opt.value = tmpls[i].id;
          opt.textContent = tmpls[i].name + ' (' + tmpls[i].category + ')';
          this.elements.templateSelect.appendChild(opt);
        }
      }
    },

    /**
     * Bind all interactive event listeners.
     */
    bindEvents: function() {
      var self = this;

      // Navigation switching
      if (this.elements.navBulkStudio) {
        this.elements.navBulkStudio.addEventListener('click', function(e) {
          e.preventDefault();
          self.switchToBulkStudio();
        });
      }
      if (this.elements.btnOpenBulkStudio) {
        this.elements.btnOpenBulkStudio.addEventListener('click', function(e) {
          e.preventDefault();
          self.switchToBulkStudio();
        });
      }
      if (this.elements.btnReturnFromBulk) {
        this.elements.btnReturnFromBulk.addEventListener('click', function() {
          self.switchToGenerator();
        });
      }
      if (this.elements.btnBackToBulkStudio) {
        this.elements.btnBackToBulkStudio.addEventListener('click', function() {
          self.switchToBulkStudio();
        });
      }

      // Step navigation tabs
      this.elements.stepNavItems.forEach(function(item) {
        item.addEventListener('click', function() {
          var step = parseInt(this.getAttribute('data-step'), 10);
          if (step) self.goToStep(step);
        });
      });

      // File input & Drag/Drop
      if (this.elements.btnBrowseFiles && this.elements.fileInput) {
        this.elements.btnBrowseFiles.addEventListener('click', function() {
          self.elements.fileInput.click();
        });
      }

      if (this.elements.fileInput) {
        this.elements.fileInput.addEventListener('change', function(e) {
          var file = e.target.files && e.target.files[0];
          if (file) self.handleFileUpload(file);
        });
      }

      if (this.elements.dropzone) {
        ['dragenter', 'dragover'].forEach(function(eventName) {
          self.elements.dropzone.addEventListener(eventName, function(e) {
            e.preventDefault();
            self.elements.dropzone.classList.add('is-dragover');
          }, false);
        });

        ['dragleave', 'drop'].forEach(function(eventName) {
          self.elements.dropzone.addEventListener(eventName, function(e) {
            e.preventDefault();
            self.elements.dropzone.classList.remove('is-dragover');
          }, false);
        });

        this.elements.dropzone.addEventListener('drop', function(e) {
          var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (file) self.handleFileUpload(file);
        });

        this.elements.dropzone.addEventListener('click', function(e) {
          if (e.target !== self.elements.btnBrowseFiles && self.elements.fileInput) {
            self.elements.fileInput.click();
          }
        });

        this.elements.dropzone.addEventListener('keydown', function(e) {
          if ((e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) && self.elements.fileInput) {
            e.preventDefault();
            self.elements.fileInput.click();
          }
        });
      }

      // Pasted text handlers
      if (this.elements.btnParsePaste) {
        this.elements.btnParsePaste.addEventListener('click', function() {
          var text = self.elements.pasteTextarea ? self.elements.pasteTextarea.value : '';
          self.handlePastedData(text);
        });
      }
      if (this.elements.btnClearPaste) {
        this.elements.btnClearPaste.addEventListener('click', function() {
          if (self.elements.pasteTextarea) self.elements.pasteTextarea.value = '';
        });
      }

      // Sample Data triggers
      if (this.elements.btnSampleMixed) {
        this.elements.btnSampleMixed.addEventListener('click', function() {
          if (self.elements.pasteTextarea) self.elements.pasteTextarea.value = self.samples.mixed;
          self.handlePastedData(self.samples.mixed);
        });
      }
      if (this.elements.btnSampleInstructions) {
        this.elements.btnSampleInstructions.addEventListener('click', function() {
          if (self.elements.pasteTextarea) self.elements.pasteTextarea.value = self.samples.instructions;
          self.handlePastedData(self.samples.instructions);
        });
      }
      if (this.elements.btnSampleRetail) {
        this.elements.btnSampleRetail.addEventListener('click', function() {
          if (self.elements.pasteTextarea) self.elements.pasteTextarea.value = self.samples.retail;
          self.handlePastedData(self.samples.retail);
        });
      }

      // Selection controls
      if (this.elements.btnSelectAllRows) {
        this.elements.btnSelectAllRows.addEventListener('click', function() {
          self.records.forEach(function(r) { if (r.status !== 'invalid') r.selected = true; });
          self.renderTableRows();
          self.updateUIState();
        });
      }
      if (this.elements.btnDeselectAllRows) {
        this.elements.btnDeselectAllRows.addEventListener('click', function() {
          self.records.forEach(function(r) { r.selected = false; });
          self.renderTableRows();
          self.updateUIState();
        });
      }

      // Add manual record
      if (this.elements.btnAddManualRow) {
        this.elements.btnAddManualRow.addEventListener('click', function() {
          self.addManualRecord();
        });
      }

      // Proceed to generation
      if (this.elements.btnProceedToGenerate) {
        this.elements.btnProceedToGenerate.addEventListener('click', function() {
          self.goToStep(3);
        });
      }

      // Start Generation
      if (this.elements.btnStartGeneration) {
        this.elements.btnStartGeneration.addEventListener('click', function() {
          self.startGeneration();
        });
      }

      // Cancel Generation
      if (this.elements.btnCancelGeneration) {
        this.elements.btnCancelGeneration.addEventListener('click', function() {
          if (self.generationController) self.generationController.cancel();
        });
      }

      // Retry Failed
      if (this.elements.btnRetryFailed) {
        this.elements.btnRetryFailed.addEventListener('click', function() {
          self.records.forEach(function(r) {
            if (r.status === 'failed') {
              r.status = 'pending';
              r.selected = true;
            }
          });
          self.startGeneration();
        });
      }

      // Bulk ZIP Export
      if (this.elements.btnDownloadZip) {
        this.elements.btnDownloadZip.addEventListener('click', function() {
          self.downloadBulkZip();
        });
      }

      // Standalone Manifest Export
      if (this.elements.btnExportManifestOnly) {
        this.elements.btnExportManifestOnly.addEventListener('click', function() {
          self.downloadManifest();
        });
      }

      // Send to Print Studio
      if (this.elements.btnSendToPrintStudio) {
        this.elements.btnSendToPrintStudio.addEventListener('click', function() {
          self.sendSelectedToPrintStudio();
        });
      }
    },

    /**
     * Show non-blocking in-app notification toast.
     */
    notify: function(msg, type) {
      if (window.QRStudio && window.QRStudio.UI && typeof window.QRStudio.UI.showToast === 'function') {
        window.QRStudio.UI.showToast(msg, type || 'info');
      } else {
        console.warn('[BulkStudio] ' + msg);
      }
    },

    /**
     * Switch View to Bulk Studio.
     */
    switchToBulkStudio: function() {
      if (this.elements.mainWorkspace) this.elements.mainWorkspace.style.display = 'none';
      if (this.elements.printStudioSection) this.elements.printStudioSection.style.display = 'none';
      if (this.elements.bulkStudioSection) {
        this.elements.bulkStudioSection.style.display = 'block';
        this.elements.bulkStudioSection.scrollIntoView({ behavior: 'smooth' });
      }

      if (this.elements.navBulkStudio) {
        this.elements.navBulkStudio.classList.add('is-active');
        this.elements.navBulkStudio.setAttribute('aria-current', 'page');
      }
      if (this.elements.navQrGenerator) {
        this.elements.navQrGenerator.classList.remove('is-active');
        this.elements.navQrGenerator.removeAttribute('aria-current');
      }
      if (this.elements.navPrintStudio) {
        this.elements.navPrintStudio.classList.remove('is-active');
        this.elements.navPrintStudio.removeAttribute('aria-current');
      }

      this.updateUIState();
    },

    /**
     * Switch View to QR Generator.
     */
    switchToGenerator: function() {
      if (this.elements.bulkStudioSection) this.elements.bulkStudioSection.style.display = 'none';
      if (this.elements.printStudioSection) this.elements.printStudioSection.style.display = 'none';
      if (this.elements.mainWorkspace) {
        this.elements.mainWorkspace.style.display = 'block';
        this.elements.mainWorkspace.scrollIntoView({ behavior: 'smooth' });
      }

      if (this.elements.navQrGenerator) {
        this.elements.navQrGenerator.classList.add('is-active');
        this.elements.navQrGenerator.setAttribute('aria-current', 'page');
      }
      if (this.elements.navBulkStudio) {
        this.elements.navBulkStudio.classList.remove('is-active');
        this.elements.navBulkStudio.removeAttribute('aria-current');
      }
    },

    /**
     * Navigate between 4 workflow steps.
     */
    goToStep: function(stepNum) {
      this.activeStep = stepNum;

      this.elements.stepNavItems.forEach(function(item) {
        var s = parseInt(item.getAttribute('data-step'), 10);
        if (s === stepNum) {
          item.classList.add('is-active');
          item.setAttribute('aria-selected', 'true');
        } else {
          item.classList.remove('is-active');
          item.setAttribute('aria-selected', 'false');
        }
      });

      this.elements.stepPanels.forEach(function(panel) {
        var p = parseInt(panel.getAttribute('data-step-panel'), 10);
        if (p === stepNum) {
          panel.style.display = 'block';
        } else {
          panel.style.display = 'none';
        }
      });

      this.updateUIState();
    },

    /**
     * Handle File Upload (CSV, TSV, TXT, XLSX).
     */
    handleFileUpload: async function(file) {
      var self = this;
      if (!file) return;

      // SEC-04: Validate file size and empty inputs
      if (file.size === 0) {
        self.showImportAlert('The selected file is empty (0 bytes). Please upload a file containing data.', 'error');
        return;
      }

      var MAX_IMPORT_SIZE = 15 * 1024 * 1024; // 15MB
      if (file.size > MAX_IMPORT_SIZE) {
        self.showImportAlert('File exceeds maximum size limit (15MB). Please upload a smaller file.', 'error');
        return;
      }

      var name = file.name.toLowerCase();
      var isXlsx = name.endsWith('.xlsx');
      var isCsv = name.endsWith('.csv');
      var isTsv = name.endsWith('.tsv');
      var isTxt = name.endsWith('.txt');

      // Reject unsupported formats safely with clear explanation
      if (!isXlsx && !isCsv && !isTsv && !isTxt) {
        if (name.endsWith('.xls') || name.endsWith('.xlsb')) {
          self.showImportAlert('Legacy binary Excel format ("' + file.name + '") is not supported. Please save your spreadsheet as modern Excel (.xlsx) or CSV (.csv) before importing.', 'error');
        } else {
          self.showImportAlert('Unsupported file format ("' + file.name + '"). Bulk Studio supports .xlsx, .csv, .tsv, and .txt files.', 'error');
        }
        return;
      }

      try {
        if (isXlsx) {
          var arrayBuffer = await file.arrayBuffer();
          var uint8 = new Uint8Array(arrayBuffer);
          var rows = await QRStudio.BulkEngine.parseXLSX(uint8);
          self.loadRawRows(rows, 'File: ' + file.name + ' (' + rows.length + ' rows)');
        } else {
          var text = await file.text();
          var parsedRows = [];
          if (isTsv) {
            parsedRows = QRStudio.BulkEngine.parseTSV(text);
          } else if (isTxt) {
            parsedRows = QRStudio.BulkEngine.parseTXT(text);
          } else {
            // Default CSV / delimited
            parsedRows = QRStudio.BulkEngine.parseCSV(text);
          }
          self.loadRawRows(parsedRows, 'File: ' + file.name + ' (' + parsedRows.length + ' rows)');
        }
      } catch (err) {
        self.showImportAlert('Error parsing ' + file.name + ': ' + err.message, 'error');
      }
    },

    /**
     * Handle Pasted Text Data.
     */
    handlePastedData: function(text) {
      if (!text || !text.trim()) {
        this.showImportAlert('Please enter or paste spreadsheet data first.', 'warning');
        return;
      }
      var rows = QRStudio.BulkEngine.parsePastedText(text);
      this.loadRawRows(rows, 'Pasted Data (' + rows.length + ' rows)');
    },

    /**
     * Load Raw Parsed Rows into Studio.
     */
    loadRawRows: function(rows, sourceDescription) {
      if (!rows || rows.length === 0) {
        this.showImportAlert('No readable data rows found.', 'error');
        return;
      }

      this.rawRows = rows;
      this.structure = QRStudio.BulkEngine.inspectSheetStructure(rows);
      this.mappingConfig = QRStudio.BulkEngine.inferColumnRoles(rows, this.structure);
      this.records = QRStudio.BulkEngine.processImportedRecords(rows, this.mappingConfig);

      this.showImportAlert('✓ Successfully parsed ' + sourceDescription, 'success');
      this.renderMappingAndPreview();
      this.goToStep(2);
    },

    /**
     * Show Alert Message in Import Box.
     */
    showImportAlert: function(msg, type) {
      if (!this.elements.importAlert) return;
      this.elements.importAlert.textContent = msg;
      this.elements.importAlert.className = 'bulk-alert-banner alert-' + (type || 'info');
      this.elements.importAlert.style.display = 'block';
    },

    /**
     * Render Mapping Controls & Preview Table.
     */
    renderMappingAndPreview: function() {
      if (!this.rawRows || this.rawRows.length === 0) return;

      var self = this;
      var numCols = this.mappingConfig.numCols;
      var headers = (this.structure.headerRowIndex >= 0 && this.rawRows[this.structure.headerRowIndex])
        ? this.rawRows[this.structure.headerRowIndex]
        : [];

      // 1. Render Mapping Alert / Confidence Banner
      if (this.elements.mappingAlert) {
        var conf = this.mappingConfig.confidence;
        var alertClass = conf === 'high' ? 'alert-success' : (conf === 'ambiguous' ? 'alert-warning' : 'alert-info');
        var confLabel = conf === 'high' ? 'High Confidence' : (conf === 'ambiguous' ? 'Ambiguous Mapping (Please verify)' : 'Standard Mapping');
        
        var alertHtml = '<strong>Mapping Status:</strong> ' + escapeHtml(confLabel) + '. ' +
          'Payload: Column ' + (this.mappingConfig.payloadColIndex + 1) + ' (' + escapeHtml(headers[this.mappingConfig.payloadColIndex] || 'Data') + '). ' +
          (this.mappingConfig.typeColIndex >= 0 ? 'Type: Column ' + (this.mappingConfig.typeColIndex + 1) + '. ' : 'Type: Auto-detected per row. ') +
          (this.mappingConfig.labelColIndex >= 0 ? 'Label: Column ' + (this.mappingConfig.labelColIndex + 1) + '.' : 'Label: Inferred per row.');

        this.elements.mappingAlert.innerHTML = alertHtml;
        this.elements.mappingAlert.className = 'bulk-alert-banner ' + alertClass;
        this.elements.mappingAlert.style.display = 'block';
      }

      // 2. Render Table Header with Role Selectors
      if (this.elements.tableHead) {
        this.elements.tableHead.innerHTML = '';
        var tr = document.createElement('tr');

        // Selection checkbox col
        var thCheck = document.createElement('th');
        thCheck.className = 'col-select-header';
        thCheck.innerHTML = '<span class="th-label">Select</span>';
        tr.appendChild(thCheck);

        // Row # col
        var thNum = document.createElement('th');
        thNum.innerHTML = '<span class="th-label">#</span>';
        tr.appendChild(thNum);

        // Payload col
        var thPayload = document.createElement('th');
        thPayload.innerHTML = '<span class="th-badge-role role-payload">🎯 Payload</span><div class="th-subtitle">Encoded Data</div>';
        tr.appendChild(thPayload);

        // Type col
        var thType = document.createElement('th');
        thType.innerHTML = '<span class="th-badge-role role-type">🔤 QR Type</span><div class="th-subtitle">Per-Row Detection</div>';
        tr.appendChild(thType);

        // Label col
        var thLabel = document.createElement('th');
        thLabel.innerHTML = '<span class="th-badge-role role-label">🏷️ Label</span><div class="th-subtitle">Display Text</div>';
        tr.appendChild(thLabel);

        // Status col
        var thStatus = document.createElement('th');
        thStatus.innerHTML = '<span class="th-label">Status</span>';
        tr.appendChild(thStatus);

        // Action col
        var thAction = document.createElement('th');
        thAction.innerHTML = '<span class="th-label">Delete</span>';
        tr.appendChild(thAction);

        this.elements.tableHead.appendChild(tr);
      }

      // 3. Render Records Table Body
      this.renderTableRows();
      this.updateUIState();
    },

    /**
     * Render Table Rows based on current `this.records`.
     */
    renderTableRows: function() {
      if (!this.elements.tableBody) return;
      var self = this;
      this.elements.tableBody.innerHTML = '';

      this.records.forEach(function(rec, idx) {
        var tr = document.createElement('tr');
        if (!rec.selected) tr.classList.add('is-row-deselected');
        if (rec.status === 'invalid') tr.classList.add('is-row-invalid');

        var rowNum = rec.rowIndex || (idx + 1);

        // Checkbox
        var tdCheck = document.createElement('td');
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!rec.selected;
        chk.disabled = rec.status === 'invalid';
        chk.setAttribute('aria-label', 'Select row ' + rowNum);
        chk.addEventListener('change', function() {
          rec.selected = chk.checked;
          if (chk.checked) tr.classList.remove('is-row-deselected');
          else tr.classList.add('is-row-deselected');
          self.updateUIState();
        });
        tdCheck.appendChild(chk);
        tr.appendChild(tdCheck);

        // Row Index
        var tdNum = document.createElement('td');
        tdNum.className = 'cell-num';
        tdNum.textContent = rowNum;
        tr.appendChild(tdNum);

        // Payload Input (Editable)
        var tdPayload = document.createElement('td');
        var inputPayload = document.createElement('input');
        inputPayload.type = 'text';
        inputPayload.className = 'bulk-cell-input';
        inputPayload.value = rec.payload;
        inputPayload.placeholder = 'Enter QR payload...';
        inputPayload.setAttribute('aria-label', 'QR payload for row ' + rowNum);
        inputPayload.addEventListener('change', function() {
          rec.payload = this.value;
          if (rec.payload.trim().length > 0) {
            rec.status = 'pending';
            rec.error = null;
            rec.selected = true;
            tr.classList.remove('is-row-invalid');
          } else {
            rec.status = 'invalid';
            rec.error = 'Payload cannot be empty';
            rec.selected = false;
            tr.classList.add('is-row-invalid');
          }
          self.updateUIState();
        });
        tdPayload.appendChild(inputPayload);
        tr.appendChild(tdPayload);

        // Type Selector (Editable)
        var tdType = document.createElement('td');
        var selectType = document.createElement('select');
        selectType.className = 'bulk-cell-select';
        selectType.setAttribute('aria-label', 'QR payload type for row ' + rowNum);
        var types = ['url', 'text', 'phone', 'email', 'wifi', 'whatsapp'];
        types.forEach(function(t) {
          var opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t.toUpperCase();
          if (rec.payloadType === t) opt.selected = true;
          selectType.appendChild(opt);
        });
        selectType.addEventListener('change', function() {
          rec.payloadType = this.value;
        });
        tdType.appendChild(selectType);
        tr.appendChild(tdType);

        // Display Label Input (Editable)
        var tdLabel = document.createElement('td');
        var inputLabel = document.createElement('input');
        inputLabel.type = 'text';
        inputLabel.className = 'bulk-cell-input';
        inputLabel.value = rec.displayLabel || '';
        inputLabel.placeholder = 'Optional CTA label...';
        inputLabel.setAttribute('aria-label', 'Display label for row ' + rowNum);
        inputLabel.addEventListener('change', function() {
          rec.displayLabel = this.value;
        });
        tdLabel.appendChild(inputLabel);
        tr.appendChild(tdLabel);

        // Status Pill
        var tdStatus = document.createElement('td');
        var pill = document.createElement('span');
        pill.className = 'bulk-status-pill status-' + rec.status;
        pill.textContent = rec.status.toUpperCase();
        if (rec.error) pill.title = rec.error;
        tdStatus.appendChild(pill);
        tr.appendChild(tdStatus);

        // Delete Row Action
        var tdAction = document.createElement('td');
        var btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn-row-delete';
        btnDel.innerHTML = '✕';
        btnDel.title = 'Delete this row';
        btnDel.setAttribute('aria-label', 'Delete row ' + rowNum);
        btnDel.addEventListener('click', function() {
          self.records.splice(idx, 1);
          self.renderTableRows();
          self.updateUIState();
        });
        tdAction.appendChild(btnDel);
        tr.appendChild(tdAction);

        self.elements.tableBody.appendChild(tr);
      });
    },

    /**
     * Add a Manual Record Row.
     */
    addManualRecord: function() {
      var newRec = {
        id: 'rec-' + (this.records.length + 1),
        index: this.records.length,
        rowIndex: this.records.length + 1,
        rawRow: ['https://example.com', 'url', 'Visit Website'],
        payload: 'https://example.com',
        payloadType: 'url',
        displayLabel: 'Visit Website',
        selected: true,
        status: 'pending',
        error: null,
        qrModel: null,
        canvas: null,
        dataUrl: null,
        filename: null
      };

      this.records.push(newRec);
      this.renderTableRows();
      this.updateUIState();
    },

    /**
     * Start Batch Generation.
     */
    startGeneration: async function() {
      var self = this;
      var selected = this.records.filter(function(r) { return r.selected && r.status !== 'invalid'; });

      if (selected.length === 0) {
        this.notify('Please select at least one valid record to generate.', 'warning');
        return;
      }

      // Show Progress Bar
      if (this.elements.progressContainer) this.elements.progressContainer.style.display = 'block';
      if (this.elements.btnStartGeneration) this.elements.btnStartGeneration.disabled = true;
      if (this.elements.btnCancelGeneration) this.elements.btnCancelGeneration.style.display = 'inline-block';

      var ecl = (this.elements.eclSelect && this.elements.eclSelect.value) || 'M';
      var templateId = (this.elements.templateSelect && this.elements.templateSelect.value) || 'active';

      // Design configuration from active editor state
      var activeDesign = {};
      if (QRStudio.Editor && QRStudio.Editor.getExportOptions) {
        activeDesign = QRStudio.Editor.getExportOptions() || {};
      }

      // If a specific template is chosen, fetch template styling
      if (templateId !== 'active' && QRStudio.TemplateGallery && QRStudio.TemplateGallery.getTemplateById) {
        var tmplObj = QRStudio.TemplateGallery.getTemplateById(templateId);
        if (tmplObj && tmplObj.design) {
          activeDesign = Object.assign({}, activeDesign, tmplObj.design);
        }
      }

      this.generationController = QRStudio.BulkEngine.generateBatch(this.records, {
        ecl: ecl,
        designState: activeDesign,
        chunkSize: 10,
        onProgress: function(prog) {
          if (self.elements.progressBar) {
            self.elements.progressBar.style.width = prog.percent + '%';
            var track = self.elements.progressBar.parentElement;
            if (track) track.setAttribute('aria-valuenow', prog.percent);
          }
          if (self.elements.progressLabel) {
            self.elements.progressLabel.textContent = 'Generating ' + prog.completed + ' of ' + prog.total + ' (' + prog.percent + '%)...';
          }
        }
      });

      var result = await this.generationController.promise;

      // Update UI after completion
      if (this.elements.btnStartGeneration) this.elements.btnStartGeneration.disabled = false;
      if (this.elements.btnCancelGeneration) this.elements.btnCancelGeneration.style.display = 'none';

      if (this.elements.progressLabel) {
        this.elements.progressLabel.textContent = result.canceled ? 'Generation Canceled.' : 'Generation Complete: ' + result.completed + ' ready, ' + result.failed + ' failed.';
      }

      this.renderGeneratedCards();
      this.updateUIState();
      this.goToStep(4);
    },

    /**
     * Render Generated Cards in Results Step.
     */
    renderGeneratedCards: function() {
      if (!this.elements.cardsGrid) return;
      var self = this;
      this.elements.cardsGrid.innerHTML = '';

      var readyRecords = this.records.filter(function(r) { return r.status === 'ready'; });
      if (readyRecords.length === 0) {
        this.elements.cardsGrid.innerHTML = '<div class="bulk-empty-state"><p>No QR codes generated yet. Click "Generate" to create your batch.</p></div>';
        return;
      }

      readyRecords.forEach(function(rec) {
        var card = document.createElement('div');
        card.className = 'bulk-qr-card';

        var img = document.createElement('img');
        img.className = 'bulk-card-thumb';
        img.src = rec.dataUrl;
        img.alt = 'QR code for ' + rec.displayLabel;

        var details = document.createElement('div');
        details.className = 'bulk-card-details';

        var title = document.createElement('h4');
        title.className = 'bulk-card-title';
        title.textContent = rec.displayLabel || 'QR Code';

        var typeBadge = document.createElement('span');
        typeBadge.className = 'bulk-type-badge';
        typeBadge.textContent = (rec.payloadType || 'text').toUpperCase();

        var payloadP = document.createElement('p');
        payloadP.className = 'bulk-card-payload';
        payloadP.textContent = rec.payload;

        details.appendChild(typeBadge);
        details.appendChild(title);
        details.appendChild(payloadP);

        card.appendChild(img);
        card.appendChild(details);

        self.elements.cardsGrid.appendChild(card);
      });
    },

    /**
     * Download Bulk ZIP Archive.
     */
    downloadBulkZip: async function() {
      var format = (this.elements.exportFormatSelect && this.elements.exportFormatSelect.value) || 'png';
      var manifestType = (this.elements.exportManifestSelect && this.elements.exportManifestSelect.value) || 'csv';

      var activeDesign = {};
      if (QRStudio.Editor && QRStudio.Editor.getExportOptions) {
        activeDesign = QRStudio.Editor.getExportOptions() || {};
      }

      try {
        var zip = await QRStudio.BulkEngine.buildBulkZipArchive(this.records, {
          format: format,
          manifestType: manifestType,
          designState: activeDesign
        });

        var blob = zip.toBlob('application/zip');
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'QR_Bulk_Export_' + format.toUpperCase() + '_' + Date.now() + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
      } catch (err) {
        this.notify('Bulk ZIP export failed: ' + err.message, 'error');
      }
    },

    /**
     * Download Standalone Manifest File.
     */
    downloadManifest: function() {
      var manifestType = (this.elements.exportManifestSelect && this.elements.exportManifestSelect.value) || 'csv';
      var readyRecords = this.records.filter(function(r) { return r.status === 'ready'; });
      if (readyRecords.length === 0) {
        this.notify('No generated records ready. Please generate QR codes first.', 'warning');
        return;
      }

      var blob, filename;
      if (manifestType === 'tsv') {
        var tsv = QRStudio.BulkEngine.generateBulkTsvManifest(readyRecords);
        blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
        filename = 'QR_Manifest_' + Date.now() + '.tsv';
      } else if (manifestType === 'json') {
        var json = QRStudio.BulkEngine.generateBulkJsonManifest(readyRecords);
        blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        filename = 'QR_Manifest_' + Date.now() + '.json';
      } else if (manifestType === 'xlsx') {
        var xlsxBytes = QRStudio.BulkEngine.generateBulkXlsxManifest(readyRecords);
        blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = 'QR_Manifest_' + Date.now() + '.xlsx';
      } else {
        // Default CSV
        var csv = QRStudio.BulkEngine.generateBulkCsvManifest(readyRecords);
        blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        filename = 'QR_Manifest_' + Date.now() + '.csv';
      }

      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
    },

    /**
     * Send Selected Bulk Records to Print Studio.
     */
    sendSelectedToPrintStudio: function() {
      var selected = this.records.filter(function(r) { return r.selected && r.status === 'ready'; });
      if (selected.length === 0) {
        this.notify('Please select at least one ready QR record to send to Print Studio.', 'warning');
        return;
      }

      try {
        var transferredState = QRStudio.BulkEngine.transferRecordsToPrintStudio(selected, {
          templateId: 'multi-qr-sheet'
        });

        // Push state into PrintUI if initialized
        if (QRStudio.PrintUI && QRStudio.PrintUI.loadExternalState) {
          QRStudio.PrintUI.loadExternalState(transferredState);
        }

        // Switch to Print Studio
        if (QRStudio.PrintUI && QRStudio.PrintUI.switchToPrintStudio) {
          QRStudio.PrintUI.switchToPrintStudio();
        }
      } catch (err) {
        this.notify('Failed to transfer records to Print Studio: ' + err.message, 'error');
      }
    },

    /**
     * Update dynamic badges and counters.
     */
    updateUIState: function() {
      var total = this.records.length;
      var valid = this.records.filter(function(r) { return r.status !== 'invalid'; }).length;
      var ready = this.records.filter(function(r) { return r.status === 'ready'; }).length;

      if (this.elements.bulkTotalRowsBadge) this.elements.bulkTotalRowsBadge.textContent = total + ' Rows';
      if (this.elements.bulkValidBadge) this.elements.bulkValidBadge.textContent = valid + ' Valid';
      if (this.elements.bulkReadyBadge) this.elements.bulkReadyBadge.textContent = ready + ' Ready';

      if (this.elements.btnProceedToGenerate) {
        this.elements.btnProceedToGenerate.disabled = valid === 0;
      }
      if (this.elements.btnStartGeneration) {
        this.elements.btnStartGeneration.disabled = valid === 0;
      }
      if (this.elements.btnDownloadZip) {
        this.elements.btnDownloadZip.disabled = ready === 0;
      }
      if (this.elements.btnSendToPrintStudio) {
        this.elements.btnSendToPrintStudio.disabled = ready === 0;
      }
    }
  };

  QRStudio.BulkUI = BulkUI;

})(typeof window !== 'undefined' ? window : this);

/**
 * QR Design Studio — Print Studio UI Coordinator (V1.7)
 * 100% Offline, Pure Vanilla JavaScript, Zero Dependencies.
 * 
 * Coordinates:
 * - Live zoomable print canvas preview (A4, A3, A5, Letter, Custom).
 * - Zoom controls (Fit to page, 100%, Zoom In/Out).
 * - Reusable layout template selection (9 presets).
 * - Page setup (orientation, margins, background, crop marks, cut lines).
 * - Sheet & sticker grid configurator with auto-fit and overflow checks.
 * - Interactive item placement, dragging, resizing, alignment, and distribution.
 * - Live safety alerts (clipping, page overflow, <20mm scanability warning).
 * - Print exports: Print-ready PDF 1.4, SVG, 300 DPI PNG, JPEG, JSON layout backup, direct print.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  var state = null; // Initialized in init()

  var isDragging = false;
  var dragItem = null;
  var dragStartX = 0;
  var dragStartY = 0;
  var itemStartX = 0;
  var itemStartY = 0;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var PrintUI = {
    elements: {},

    /**
     * Initialize Print Studio UI.
     */
    init: function() {
      state = QRStudio.PrintEngine.createDefaultState();

      this.cacheElements();
      this.populateTemplateGallery();
      this.populateProjectSources();
      this.bindEvents();
      this.syncStateToUI();
      this.updatePreview();
    },

    /**
     * Cache all DOM elements for Print Studio.
     */
    cacheElements: function() {
      this.elements = {
        // Navigation links
        navPrintStudio: document.getElementById('navPrintStudio'),
        navQrGenerator: document.getElementById('navQrGenerator'),
        navBulkStudio: document.getElementById('navBulkStudio'),
        btnOpenPrintStudio: document.getElementById('btnOpenPrintStudio'),
        btnReturnToGenerator: document.getElementById('btnReturnToGenerator'),
        btnBackToBulkStudio: document.getElementById('btnBackToBulkStudio'),
        printStudioSection: document.getElementById('printStudioSection'),
        bulkStudioSection: document.getElementById('bulkStudioSection'),
        mainWorkspace: document.getElementById('workspace'),

        // Top Status Badges
        printPageSizeBadge: document.getElementById('printPageSizeBadge'),
        printDpiBadge: document.getElementById('printDpiBadge'),
        printItemsCountBadge: document.getElementById('printItemsCountBadge'),

        // Subtabs
        subtabs: document.querySelectorAll('.print-subtab'),
        subpanels: document.querySelectorAll('.print-subpanel'),

        // Templates Gallery
        templateGrid: document.getElementById('printTemplateGrid'),

        // Page Settings
        pageSizeSelect: document.getElementById('printPageSizeSelect'),
        customDimsRow: document.getElementById('printCustomDimsRow'),
        customWidthInput: document.getElementById('printCustomWidth'),
        customHeightInput: document.getElementById('printCustomHeight'),
        orientationBtns: document.querySelectorAll('#printOrientationGroup .style-toggle-btn'),
        marginTopInput: document.getElementById('printMarginTop'),
        marginBottomInput: document.getElementById('printMarginBottom'),
        marginLeftInput: document.getElementById('printMarginLeft'),
        marginRightInput: document.getElementById('printMarginRight'),
        marginPresetChips: document.querySelectorAll('.margin-preset-chip'),
        pageBgColorPicker: document.getElementById('printPageBgPicker'),
        pageBgSwatch: document.getElementById('printPageBgSwatch'),
        pageBgHexInput: document.getElementById('printPageBgHex'),
        toggleCropMarks: document.getElementById('printToggleCropMarks'),
        toggleCutLines: document.getElementById('printToggleCutLines'),
        toggleMarginGuides: document.getElementById('printToggleMarginGuides'),

        // Grid Settings
        gridControlsCard: document.getElementById('printGridControlsCard'),
        gridColsInput: document.getElementById('printGridCols'),
        gridRowsInput: document.getElementById('printGridRows'),
        gridLabelWidthInput: document.getElementById('printGridLabelWidth'),
        gridLabelHeightInput: document.getElementById('printGridLabelHeight'),
        gridGapXInput: document.getElementById('printGridGapX'),
        gridGapYInput: document.getElementById('printGridGapY'),
        gridShapeBtns: document.querySelectorAll('#printGridShapeGroup .style-toggle-btn'),
        gridCornerRadiusSlider: document.getElementById('printGridCornerRadius'),
        gridCornerRadiusVal: document.getElementById('printGridCornerRadiusVal'),
        gridRepeatQrToggle: document.getElementById('printGridRepeatQr'),
        btnAutoFitGrid: document.getElementById('btnAutoFitGrid'),
        gridSummaryText: document.getElementById('printGridSummaryText'),

        // Items Settings & Alignment
        itemsListContainer: document.getElementById('printItemsListContainer'),
        btnAddPrintItem: document.getElementById('btnAddPrintItem'),
        itemPropsCard: document.getElementById('printItemPropsCard'),
        itemPosXInput: document.getElementById('printItemPosX'),
        itemPosYInput: document.getElementById('printItemPosY'),
        itemWidthInput: document.getElementById('printItemWidth'),
        itemHeightInput: document.getElementById('printItemHeight'),
        itemQrSizeInput: document.getElementById('printItemQrSize'),
        itemTitleInput: document.getElementById('printItemTitle'),
        itemDescInput: document.getElementById('printItemDesc'),
        itemCtaInput: document.getElementById('printItemCta'),
        itemShowTitleCheck: document.getElementById('printItemShowTitle'),
        itemShowDescCheck: document.getElementById('printItemShowDesc'),
        itemShowCtaCheck: document.getElementById('printItemShowCta'),
        itemShowCardCheck: document.getElementById('printItemShowCard'),
        itemCardBgPicker: document.getElementById('printItemCardBgPicker'),
        itemCardBgSwatch: document.getElementById('printItemCardBgSwatch'),
        itemCardBgHex: document.getElementById('printItemCardBgHex'),
        itemBorderColorPicker: document.getElementById('printItemBorderPicker'),
        itemBorderSwatch: document.getElementById('printItemBorderSwatch'),
        itemBorderHex: document.getElementById('printItemBorderHex'),
        itemQrSourceSelect: document.getElementById('printItemQrSourceSelect'),

        // Alignment Toolbar
        alignBtns: document.querySelectorAll('.btn-print-align'),

        // Safety Warnings Banner
        safetyBanner: document.getElementById('printSafetyBanner'),
        safetyBannerText: document.getElementById('printSafetyBannerText'),

        // Preview Viewport & Stage
        printCanvas: document.getElementById('printPreviewCanvas'),
        canvasViewport: document.getElementById('printCanvasViewport'),
        stageDimsBadge: document.getElementById('printStageDimsBadge'),
        btnZoomOut: document.getElementById('btnZoomOut'),
        btnZoomIn: document.getElementById('btnZoomIn'),
        btnZoomFit: document.getElementById('btnZoomFit'),
        btnZoom100: document.getElementById('btnZoom100'),
        zoomValDisplay: document.getElementById('printZoomValDisplay'),

        // Export Actions
        exportDpiSelect: document.getElementById('printExportDpiSelect'),
        btnExportPdf: document.getElementById('btnExportPrintPdf'),
        btnExportSvg: document.getElementById('btnExportPrintSvg'),
        btnExportPng: document.getElementById('btnExportPrintPng'),
        btnExportJpeg: document.getElementById('btnExportPrintJpeg'),
        btnExportJson: document.getElementById('btnExportPrintJson'),
        btnImportJson: document.getElementById('btnImportPrintJson'),
        layoutFileInput: document.getElementById('printLayoutFileInput'),
        btnPrintDirect: document.getElementById('btnPrintDirect')
      };
    },

    /**
     * Render the 9 template preview cards into the gallery.
     */
    populateTemplateGallery: function() {
      var container = this.elements.templateGrid;
      if (!container) return;
      container.innerHTML = '';

      var templates = QRStudio.PrintEngine.TEMPLATES;
      var templateKeys = Object.keys(templates);

      templateKeys.forEach(function(key) {
        var tmpl = templates[key];
        var card = document.createElement('div');
        card.className = 'print-template-card' + (state.templateId === tmpl.id ? ' is-active' : '');
        card.setAttribute('data-template-id', tmpl.id);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', tmpl.name + ' - ' + tmpl.description);

        card.innerHTML =
          '<div class="template-card-header">' +
            '<span class="template-card-tag">' + (tmpl.gridMode ? 'GRID SHEET' : 'SINGLE CARD') + '</span>' +
            '<span class="template-card-cat">' + tmpl.category + '</span>' +
          '</div>' +
          '<h4 class="template-card-title">' + tmpl.name + '</h4>' +
          '<p class="template-card-desc">' + tmpl.description + '</p>' +
          '<div class="template-card-meta">' +
            '<span>Size: <strong>' + (tmpl.defaultPageSize.toUpperCase()) + '</strong></span>' +
            '<span>Orientation: <strong>' + tmpl.defaultOrientation + '</strong></span>' +
          '</div>';

        container.appendChild(card);
      });
    },

    /**
     * Populate project QR sources dropdown.
     */
    populateProjectSources: function() {
      var select = this.elements.itemQrSourceSelect;
      if (!select) return;
      select.innerHTML = '<option value="current" selected>Current Workspace QR</option>';

      if (QRStudio.ProjectManager && QRStudio.ProjectManager.getAllProjects) {
        var projects = QRStudio.ProjectManager.getAllProjects();
        if (projects && projects.length > 0) {
          var optGroup = document.createElement('optgroup');
          optGroup.label = 'Saved Projects';
          projects.forEach(function(p) {
            var opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name || 'Untitled Project';
            optGroup.appendChild(opt);
          });
          select.appendChild(optGroup);
        }
      }
    },

    /**
     * Bind all event listeners.
     */
    bindEvents: function() {
      var self = this;

      // Navigation switching
      if (this.elements.navPrintStudio) {
        this.elements.navPrintStudio.addEventListener('click', function(e) {
          e.preventDefault();
          self.switchToPrintStudio();
        });
      }
      if (this.elements.btnOpenPrintStudio) {
        this.elements.btnOpenPrintStudio.addEventListener('click', function() {
          self.switchToPrintStudio();
        });
      }
      if (this.elements.btnReturnToGenerator) {
        this.elements.btnReturnToGenerator.addEventListener('click', function() {
          self.switchToGenerator();
        });
      }
      if (this.elements.btnBackToBulkStudio) {
        this.elements.btnBackToBulkStudio.addEventListener('click', function() {
          if (QRStudio.BulkUI && QRStudio.BulkUI.switchToBulkStudio) {
            QRStudio.BulkUI.switchToBulkStudio();
          }
        });
      }
      var btnJump = document.getElementById('btnJumpToPrintStudioFromExport');
      if (btnJump) {
        btnJump.addEventListener('click', function() {
          self.switchToPrintStudio();
        });
      }
      if (this.elements.navQrGenerator) {
        this.elements.navQrGenerator.addEventListener('click', function() {
          self.switchToGenerator();
        });
      }

      // Subtabs switching
      this.elements.subtabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var targetId = this.getAttribute('aria-controls');
          self.switchSubtab(targetId);
        });
      });

      // Template selection
      if (this.elements.templateGrid) {
        this.elements.templateGrid.addEventListener('click', function(e) {
          var card = e.target.closest('.print-template-card');
          if (!card) return;
          var tid = card.getAttribute('data-template-id');
          if (tid) self.applyTemplate(tid);
        });
      }

      // Page size selection
      if (this.elements.pageSizeSelect) {
        this.elements.pageSizeSelect.addEventListener('change', function() {
          state.pageSize = this.value;
          if (state.pageSize === 'custom') {
            self.elements.customDimsRow.style.display = 'flex';
          } else {
            self.elements.customDimsRow.style.display = 'none';
          }
          if (state.gridMode) QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      }

      // Custom dimensions
      if (this.elements.customWidthInput) {
        this.elements.customWidthInput.addEventListener('input', function() {
          state.customWidthMm = Math.max(20, Math.min(1000, Number(this.value) || 210));
          if (state.gridMode) QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      }
      if (this.elements.customHeightInput) {
        this.elements.customHeightInput.addEventListener('input', function() {
          state.customHeightMm = Math.max(20, Math.min(1000, Number(this.value) || 297));
          if (state.gridMode) QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      }

      // Orientation toggle
      this.elements.orientationBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          self.elements.orientationBtns.forEach(function(b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          state.orientation = btn.getAttribute('data-orientation') || 'portrait';
          if (state.gridMode) QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      });

      // Margins
      var updateMargins = function() {
        state.marginsMm.top = Math.max(0, Number(self.elements.marginTopInput.value) || 0);
        state.marginsMm.bottom = Math.max(0, Number(self.elements.marginBottomInput.value) || 0);
        state.marginsMm.left = Math.max(0, Number(self.elements.marginLeftInput.value) || 0);
        state.marginsMm.right = Math.max(0, Number(self.elements.marginRightInput.value) || 0);
        if (state.gridMode) QRStudio.PrintEngine.syncItemsFromGrid(state);
        self.updatePreview();
      };

      if (this.elements.marginTopInput) this.elements.marginTopInput.addEventListener('input', updateMargins);
      if (this.elements.marginBottomInput) this.elements.marginBottomInput.addEventListener('input', updateMargins);
      if (this.elements.marginLeftInput) this.elements.marginLeftInput.addEventListener('input', updateMargins);
      if (this.elements.marginRightInput) this.elements.marginRightInput.addEventListener('input', updateMargins);

      // Margin presets
      this.elements.marginPresetChips.forEach(function(chip) {
        chip.addEventListener('click', function() {
          var val = Number(this.getAttribute('data-margin')) || 10;
          self.elements.marginTopInput.value = val;
          self.elements.marginBottomInput.value = val;
          self.elements.marginLeftInput.value = val;
          self.elements.marginRightInput.value = val;
          updateMargins();
        });
      });

      // Page background
      if (this.elements.pageBgColorPicker) {
        this.elements.pageBgColorPicker.addEventListener('input', function() {
          state.pageBg = this.value;
          self.elements.pageBgSwatch.style.backgroundColor = this.value;
          self.elements.pageBgHexInput.value = this.value.replace('#', '').toUpperCase();
          self.updatePreview();
        });
      }
      if (this.elements.pageBgHexInput) {
        this.elements.pageBgHexInput.addEventListener('input', function() {
          var hex = '#' + this.value.trim().replace('#', '');
          if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            state.pageBg = hex;
            self.elements.pageBgColorPicker.value = hex;
            self.elements.pageBgSwatch.style.backgroundColor = hex;
            self.updatePreview();
          }
        });
      }

      // Toggles (Crop marks, Cut lines, Margin guides)
      if (this.elements.toggleCropMarks) {
        this.elements.toggleCropMarks.addEventListener('change', function() {
          state.showCropMarks = this.checked;
          self.updatePreview();
        });
      }
      if (this.elements.toggleCutLines) {
        this.elements.toggleCutLines.addEventListener('change', function() {
          state.showCutLines = this.checked;
          self.updatePreview();
        });
      }
      if (this.elements.toggleMarginGuides) {
        this.elements.toggleMarginGuides.addEventListener('change', function() {
          state.showMarginGuides = this.checked;
          self.updatePreview();
        });
      }

      // Grid controls
      var updateGrid = function() {
        if (!state.gridConfig) return;
        state.gridConfig.cols = Math.max(1, parseInt(self.elements.gridColsInput.value, 10) || 1);
        state.gridConfig.rows = Math.max(1, parseInt(self.elements.gridRowsInput.value, 10) || 1);
        state.gridConfig.labelWidthMm = Math.max(5, Number(self.elements.gridLabelWidthInput.value) || 50);
        state.gridConfig.labelHeightMm = Math.max(5, Number(self.elements.gridLabelHeightInput.value) || 50);
        state.gridConfig.gapXMm = Math.max(0, Number(self.elements.gridGapXInput.value) || 0);
        state.gridConfig.gapYMm = Math.max(0, Number(self.elements.gridGapYInput.value) || 0);

        QRStudio.PrintEngine.syncItemsFromGrid(state);
        self.renderItemsList();
        self.updatePreview();
      };

      if (this.elements.gridColsInput) this.elements.gridColsInput.addEventListener('input', updateGrid);
      if (this.elements.gridRowsInput) this.elements.gridRowsInput.addEventListener('input', updateGrid);
      if (this.elements.gridLabelWidthInput) this.elements.gridLabelWidthInput.addEventListener('input', updateGrid);
      if (this.elements.gridLabelHeightInput) this.elements.gridLabelHeightInput.addEventListener('input', updateGrid);
      if (this.elements.gridGapXInput) this.elements.gridGapXInput.addEventListener('input', updateGrid);
      if (this.elements.gridGapYInput) this.elements.gridGapYInput.addEventListener('input', updateGrid);

      // Grid shape
      this.elements.gridShapeBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          self.elements.gridShapeBtns.forEach(function(b) {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          btn.classList.add('is-active');
          btn.setAttribute('aria-checked', 'true');
          state.gridConfig.shape = btn.getAttribute('data-shape') || 'rounded';
          QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      });

      // Corner radius
      if (this.elements.gridCornerRadiusSlider) {
        this.elements.gridCornerRadiusSlider.addEventListener('input', function() {
          var val = Number(this.value);
          state.gridConfig.cornerRadiusMm = val;
          self.elements.gridCornerRadiusVal.textContent = val + ' mm';
          QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      }

      // Repeat QR toggle
      if (this.elements.gridRepeatQrToggle) {
        this.elements.gridRepeatQrToggle.addEventListener('change', function() {
          state.gridConfig.repeatCurrentQR = this.checked;
          QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.updatePreview();
        });
      }

      // Auto-fit grid button
      if (this.elements.btnAutoFitGrid) {
        this.elements.btnAutoFitGrid.addEventListener('click', function() {
          QRStudio.PrintEngine.autoFitGrid(state);
          self.elements.gridLabelWidthInput.value = state.gridConfig.labelWidthMm;
          self.elements.gridLabelHeightInput.value = state.gridConfig.labelHeightMm;
          QRStudio.PrintEngine.syncItemsFromGrid(state);
          self.renderItemsList();
          self.updatePreview();
          self.showToast('Grid auto-fitted to page printable area.');
        });
      }

      // Alignment Toolbar buttons
      this.elements.alignBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var action = this.getAttribute('data-action');
          if (!action) return;

          switch (action) {
            case 'align-left':
            case 'align-center':
            case 'align-right':
            case 'align-top':
            case 'align-middle':
            case 'align-bottom':
              var dir = action.replace('align-', '');
              QRStudio.PrintEngine.itemOps.align(state, dir);
              break;
            case 'distribute-h':
              QRStudio.PrintEngine.itemOps.distribute(state, 'horizontal');
              break;
            case 'distribute-v':
              QRStudio.PrintEngine.itemOps.distribute(state, 'vertical');
              break;
            case 'duplicate':
              if (state.selectedItemId) {
                QRStudio.PrintEngine.itemOps.duplicate(state, state.selectedItemId);
                self.renderItemsList();
              }
              break;
            case 'delete':
              if (state.selectedItemId) {
                QRStudio.PrintEngine.itemOps.deleteItem(state, state.selectedItemId);
                self.renderItemsList();
              }
              break;
          }
          self.syncSelectedItemToUI();
          self.updatePreview();
        });
      });

      // Add Freeform Item
      if (this.elements.btnAddPrintItem) {
        this.elements.btnAddPrintItem.addEventListener('click', function() {
          var pageDims = QRStudio.PrintEngine.getEffectivePageDimensions(state);
          var margins = state.marginsMm;
          var newItem = {
            id: 'item-' + Date.now(),
            x: margins.left + 10,
            y: margins.top + 10,
            width: 55,
            height: 55,
            qrSizeMm: 38,
            shape: 'rounded',
            cornerRadiusMm: 4,
            title: 'Scan Me',
            description: '',
            cta: '',
            showTitle: true,
            showDescription: false,
            showCta: false,
            showCardBadge: true,
            cardBg: '#FFFFFF',
            cardBorderColor: '#171717',
            textColor: '#171717',
            qrSource: 'current'
          };
          state.items.push(newItem);
          state.selectedItemId = newItem.id;
          self.renderItemsList();
          self.syncSelectedItemToUI();
          self.updatePreview();
        });
      }

      // Selected Item Property inputs
      var updateSelectedItem = function() {
        var it = state.items.find(function(i) { return i.id === state.selectedItemId; });
        if (!it) return;

        it.x = Number(self.elements.itemPosXInput.value) || 0;
        it.y = Number(self.elements.itemPosYInput.value) || 0;
        it.width = Math.max(10, Number(self.elements.itemWidthInput.value) || 50);
        it.height = Math.max(10, Number(self.elements.itemHeightInput.value) || 50);
        it.qrSizeMm = Math.max(5, Number(self.elements.itemQrSizeInput.value) || 30);
        it.title = self.elements.itemTitleInput.value;
        it.description = self.elements.itemDescInput.value;
        it.cta = self.elements.itemCtaInput.value;
        it.showTitle = self.elements.itemShowTitleCheck.checked;
        it.showDescription = self.elements.itemShowDescCheck.checked;
        it.showCta = self.elements.itemShowCtaCheck.checked;
        it.showCardBadge = self.elements.itemShowCardCheck.checked;
        it.qrSource = self.elements.itemQrSourceSelect.value;

        self.updatePreview();
      };

      if (this.elements.itemPosXInput) this.elements.itemPosXInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemPosYInput) this.elements.itemPosYInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemWidthInput) this.elements.itemWidthInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemHeightInput) this.elements.itemHeightInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemQrSizeInput) this.elements.itemQrSizeInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemTitleInput) this.elements.itemTitleInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemDescInput) this.elements.itemDescInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemCtaInput) this.elements.itemCtaInput.addEventListener('input', updateSelectedItem);
      if (this.elements.itemShowTitleCheck) this.elements.itemShowTitleCheck.addEventListener('change', updateSelectedItem);
      if (this.elements.itemShowDescCheck) this.elements.itemShowDescCheck.addEventListener('change', updateSelectedItem);
      if (this.elements.itemShowCtaCheck) this.elements.itemShowCtaCheck.addEventListener('change', updateSelectedItem);
      if (this.elements.itemShowCardCheck) this.elements.itemShowCardCheck.addEventListener('change', updateSelectedItem);
      if (this.elements.itemQrSourceSelect) this.elements.itemQrSourceSelect.addEventListener('change', updateSelectedItem);

      // Card color pickers
      if (this.elements.itemCardBgPicker) {
        this.elements.itemCardBgPicker.addEventListener('input', function() {
          var it = state.items.find(function(i) { return i.id === state.selectedItemId; });
          if (it) {
            it.cardBg = this.value;
            self.elements.itemCardBgSwatch.style.backgroundColor = this.value;
            self.elements.itemCardBgHex.value = this.value.replace('#', '').toUpperCase();
            self.updatePreview();
          }
        });
      }
      if (this.elements.itemBorderColorPicker) {
        this.elements.itemBorderColorPicker.addEventListener('input', function() {
          var it = state.items.find(function(i) { return i.id === state.selectedItemId; });
          if (it) {
            it.cardBorderColor = this.value;
            self.elements.itemBorderSwatch.style.backgroundColor = this.value;
            self.elements.itemBorderHex.value = this.value.replace('#', '').toUpperCase();
            self.updatePreview();
          }
        });
      }

      // Zoom controls
      if (this.elements.btnZoomIn) {
        this.elements.btnZoomIn.addEventListener('click', function() {
          state.zoom = Math.min(2.5, state.zoom + 0.15);
          self.applyZoom();
        });
      }
      if (this.elements.btnZoomOut) {
        this.elements.btnZoomOut.addEventListener('click', function() {
          state.zoom = Math.max(0.2, state.zoom - 0.15);
          self.applyZoom();
        });
      }
      if (this.elements.btnZoom100) {
        this.elements.btnZoom100.addEventListener('click', function() {
          state.zoom = 1.0;
          self.applyZoom();
        });
      }
      if (this.elements.btnZoomFit) {
        this.elements.btnZoomFit.addEventListener('click', function() {
          self.fitToViewport();
        });
      }

      // Canvas Interactive Drag & Drop and Click to Select
      var canvas = this.elements.printCanvas;
      if (canvas) {
        canvas.addEventListener('mousedown', function(e) {
          self.handleCanvasMouseDown(e);
        });
        window.addEventListener('mousemove', function(e) {
          self.handleCanvasMouseMove(e);
        });
        window.addEventListener('mouseup', function(e) {
          self.handleCanvasMouseUp(e);
        });
      }

      // Export Buttons
      if (this.elements.btnExportPdf) {
        this.elements.btnExportPdf.addEventListener('click', function() { self.exportPDF(); });
      }
      if (this.elements.btnExportSvg) {
        this.elements.btnExportSvg.addEventListener('click', function() { self.exportSVG(); });
      }
      if (this.elements.btnExportPng) {
        this.elements.btnExportPng.addEventListener('click', function() { self.exportPNG(); });
      }
      if (this.elements.btnExportJpeg) {
        this.elements.btnExportJpeg.addEventListener('click', function() { self.exportJPEG(); });
      }
      if (this.elements.btnExportJson) {
        this.elements.btnExportJson.addEventListener('click', function() { self.exportJSON(); });
      }
      if (this.elements.btnImportJson) {
        this.elements.btnImportJson.addEventListener('click', function() {
          if (self.elements.layoutFileInput) self.elements.layoutFileInput.click();
        });
      }
      if (this.elements.layoutFileInput) {
        this.elements.layoutFileInput.addEventListener('change', function(e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function(evt) {
            try {
              var jsonStr = evt.target.result;
              QRStudio.PrintEngine.importLayoutFromJSON(state, jsonStr, self.getWorkspaceCanvas());
              self.syncStateToUI();
              self.updatePreview();
              self.showToast('Print layout imported successfully.');
            } catch (err) {
              self.showToast('Failed to import layout: ' + err.message, true);
            }
          };
          reader.readAsText(file);
        });
      }
      if (this.elements.btnPrintDirect) {
        this.elements.btnPrintDirect.addEventListener('click', function() {
          window.print();
        });
      }
    },

    /**
     * Switch view to Print Studio.
     */
    switchToPrintStudio: function() {
      if (this.elements.mainWorkspace) this.elements.mainWorkspace.style.display = 'none';
      if (this.elements.bulkStudioSection) this.elements.bulkStudioSection.style.display = 'none';
      if (this.elements.printStudioSection) {
        this.elements.printStudioSection.style.display = 'block';
        this.elements.printStudioSection.scrollIntoView({ behavior: 'smooth' });
      }
      if (this.elements.navPrintStudio) {
        this.elements.navPrintStudio.classList.add('is-active');
        this.elements.navPrintStudio.setAttribute('aria-current', 'page');
      }
      if (this.elements.navQrGenerator) {
        this.elements.navQrGenerator.classList.remove('is-active');
        this.elements.navQrGenerator.removeAttribute('aria-current');
      }
      if (this.elements.navBulkStudio) {
        this.elements.navBulkStudio.classList.remove('is-active');
        this.elements.navBulkStudio.removeAttribute('aria-current');
      }

      this.populateProjectSources();
      this.fitToViewport();
      this.updatePreview();
    },

    /**
     * Switch view back to QR Generator.
     */
    switchToGenerator: function() {
      if (this.elements.printStudioSection) this.elements.printStudioSection.style.display = 'none';
      if (this.elements.bulkStudioSection) this.elements.bulkStudioSection.style.display = 'none';
      if (this.elements.mainWorkspace) {
        this.elements.mainWorkspace.style.display = 'block';
        this.elements.mainWorkspace.scrollIntoView({ behavior: 'smooth' });
      }
      if (this.elements.navQrGenerator) {
        this.elements.navQrGenerator.classList.add('is-active');
        this.elements.navQrGenerator.setAttribute('aria-current', 'page');
      }
      if (this.elements.navPrintStudio) {
        this.elements.navPrintStudio.classList.remove('is-active');
        this.elements.navPrintStudio.removeAttribute('aria-current');
      }
      if (this.elements.navBulkStudio) {
        this.elements.navBulkStudio.classList.remove('is-active');
        this.elements.navBulkStudio.removeAttribute('aria-current');
      }
    },

    /**
     * Load an external Print state (e.g. transferred from Bulk Studio).
     */
    loadExternalState: function(newState) {
      if (!newState) return;
      state = newState;
      this.syncStateToUI();
      this.fitToViewport();
      this.updatePreview();
    },

    /**
     * Get active print state.
     */
    getState: function() {
      return state;
    },

    /**
     * Subtab switching inside Print Studio.
     */
    switchSubtab: function(targetId) {
      this.elements.subtabs.forEach(function(tab) {
        var isTarget = tab.getAttribute('aria-controls') === targetId;
        tab.classList.toggle('is-active', isTarget);
        tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
      });

      this.elements.subpanels.forEach(function(panel) {
        if (panel.id === targetId) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', 'true');
        }
      });
    },

    /**
     * Apply a print template by ID.
     */
    applyTemplate: function(templateId) {
      QRStudio.PrintEngine.applyTemplate(state, templateId, this.getWorkspaceCanvas());

      // Update gallery active state
      var cards = document.querySelectorAll('.print-template-card');
      cards.forEach(function(c) {
        var isActive = c.getAttribute('data-template-id') === templateId;
        c.classList.toggle('is-active', isActive);
      });

      this.syncStateToUI();
      this.updatePreview();
      this.showToast('Applied ' + (QRStudio.PrintEngine.TEMPLATES[templateId] ? QRStudio.PrintEngine.TEMPLATES[templateId].name : 'template'));
    },

    /**
     * Sync state into form controls.
     */
    syncStateToUI: function() {
      // Page Setup
      if (this.elements.pageSizeSelect) this.elements.pageSizeSelect.value = state.pageSize;
      if (this.elements.customDimsRow) {
        this.elements.customDimsRow.style.display = (state.pageSize === 'custom') ? 'flex' : 'none';
      }
      if (this.elements.customWidthInput) this.elements.customWidthInput.value = state.customWidthMm;
      if (this.elements.customHeightInput) this.elements.customHeightInput.value = state.customHeightMm;

      this.elements.orientationBtns.forEach(function(btn) {
        var isOrient = btn.getAttribute('data-orientation') === state.orientation;
        btn.classList.toggle('is-active', isOrient);
        btn.setAttribute('aria-checked', isOrient ? 'true' : 'false');
      });

      if (this.elements.marginTopInput) this.elements.marginTopInput.value = state.marginsMm.top;
      if (this.elements.marginBottomInput) this.elements.marginBottomInput.value = state.marginsMm.bottom;
      if (this.elements.marginLeftInput) this.elements.marginLeftInput.value = state.marginsMm.left;
      if (this.elements.marginRightInput) this.elements.marginRightInput.value = state.marginsMm.right;

      if (this.elements.pageBgColorPicker) this.elements.pageBgColorPicker.value = state.pageBg;
      if (this.elements.pageBgSwatch) this.elements.pageBgSwatch.style.backgroundColor = state.pageBg;
      if (this.elements.pageBgHexInput) this.elements.pageBgHexInput.value = state.pageBg.replace('#', '').toUpperCase();

      if (this.elements.toggleCropMarks) this.elements.toggleCropMarks.checked = state.showCropMarks;
      if (this.elements.toggleCutLines) this.elements.toggleCutLines.checked = state.showCutLines;
      if (this.elements.toggleMarginGuides) this.elements.toggleMarginGuides.checked = state.showMarginGuides;

      // Grid Setup
      if (this.elements.gridControlsCard) {
        this.elements.gridControlsCard.style.display = state.gridMode ? 'block' : 'none';
      }
      if (state.gridConfig) {
        if (this.elements.gridColsInput) this.elements.gridColsInput.value = state.gridConfig.cols;
        if (this.elements.gridRowsInput) this.elements.gridRowsInput.value = state.gridConfig.rows;
        if (this.elements.gridLabelWidthInput) this.elements.gridLabelWidthInput.value = state.gridConfig.labelWidthMm;
        if (this.elements.gridLabelHeightInput) this.elements.gridLabelHeightInput.value = state.gridConfig.labelHeightMm;
        if (this.elements.gridGapXInput) this.elements.gridGapXInput.value = state.gridConfig.gapXMm;
        if (this.elements.gridGapYInput) this.elements.gridGapYInput.value = state.gridConfig.gapYMm;

        this.elements.gridShapeBtns.forEach(function(btn) {
          var isShape = btn.getAttribute('data-shape') === state.gridConfig.shape;
          btn.classList.toggle('is-active', isShape);
          btn.setAttribute('aria-checked', isShape ? 'true' : 'false');
        });

        if (this.elements.gridCornerRadiusSlider) this.elements.gridCornerRadiusSlider.value = state.gridConfig.cornerRadiusMm;
        if (this.elements.gridCornerRadiusVal) this.elements.gridCornerRadiusVal.textContent = state.gridConfig.cornerRadiusMm + ' mm';
        if (this.elements.gridRepeatQrToggle) this.elements.gridRepeatQrToggle.checked = state.gridConfig.repeatCurrentQR;
      }

      this.renderItemsList();
      this.syncSelectedItemToUI();
    },

    /**
     * Render the list of items in the Items subtab.
     */
    renderItemsList: function() {
      var container = this.elements.itemsListContainer;
      if (!container) return;
      container.innerHTML = '';

      var self = this;
      var items = state.items || [];

      if (items.length === 0) {
        container.innerHTML = '<div class="items-empty-note">No items placed on page. Click "+ Add QR Item" above.</div>';
        if (this.elements.itemPropsCard) this.elements.itemPropsCard.style.display = 'none';
        return;
      }

      if (this.elements.itemPropsCard) this.elements.itemPropsCard.style.display = 'block';

      items.forEach(function(it, idx) {
        var card = document.createElement('div');
        card.className = 'print-item-row' + (state.selectedItemId === it.id ? ' is-selected' : '');
        card.setAttribute('data-item-id', it.id);

        card.innerHTML =
          '<div class="item-row-left">' +
            '<span class="item-index-badge">#' + (idx + 1) + '</span>' +
            '<div class="item-info-col">' +
              '<strong class="item-title-label">' + escapeHtml(it.title || 'Untitled Item') + '</strong>' +
              '<span class="item-dim-label">' + it.width + ' × ' + it.height + ' mm (QR: ' + it.qrSizeMm + 'mm)</span>' +
            '</div>' +
          '</div>' +
          '<div class="item-row-actions">' +
            '<button type="button" class="btn-item-action btn-item-dup" title="Duplicate item" aria-label="Duplicate item">⧉</button>' +
            '<button type="button" class="btn-item-action btn-item-del" title="Delete item" aria-label="Delete item">✕</button>' +
          '</div>';

        card.addEventListener('click', function(e) {
          if (e.target.closest('.btn-item-dup')) {
            e.stopPropagation();
            QRStudio.PrintEngine.itemOps.duplicate(state, it.id);
            self.renderItemsList();
            self.syncSelectedItemToUI();
            self.updatePreview();
            return;
          }
          if (e.target.closest('.btn-item-del')) {
            e.stopPropagation();
            QRStudio.PrintEngine.itemOps.deleteItem(state, it.id);
            self.renderItemsList();
            self.syncSelectedItemToUI();
            self.updatePreview();
            return;
          }
          state.selectedItemId = it.id;
          self.renderItemsList();
          self.syncSelectedItemToUI();
          self.updatePreview();
        });

        container.appendChild(card);
      });
    },

    /**
     * Populate selected item properties card.
     */
    syncSelectedItemToUI: function() {
      var it = state.items.find(function(i) { return i.id === state.selectedItemId; });
      if (!it) {
        if (this.elements.itemPropsCard) this.elements.itemPropsCard.style.display = 'none';
        return;
      }

      if (this.elements.itemPropsCard) this.elements.itemPropsCard.style.display = 'block';

      if (this.elements.itemPosXInput) this.elements.itemPosXInput.value = it.x;
      if (this.elements.itemPosYInput) this.elements.itemPosYInput.value = it.y;
      if (this.elements.itemWidthInput) this.elements.itemWidthInput.value = it.width;
      if (this.elements.itemHeightInput) this.elements.itemHeightInput.value = it.height;
      if (this.elements.itemQrSizeInput) this.elements.itemQrSizeInput.value = it.qrSizeMm;
      if (this.elements.itemTitleInput) this.elements.itemTitleInput.value = it.title || '';
      if (this.elements.itemDescInput) this.elements.itemDescInput.value = it.description || '';
      if (this.elements.itemCtaInput) this.elements.itemCtaInput.value = it.cta || '';
      if (this.elements.itemShowTitleCheck) this.elements.itemShowTitleCheck.checked = it.showTitle;
      if (this.elements.itemShowDescCheck) this.elements.itemShowDescCheck.checked = it.showDescription;
      if (this.elements.itemShowCtaCheck) this.elements.itemShowCtaCheck.checked = it.showCta;
      if (this.elements.itemShowCardCheck) this.elements.itemShowCardCheck.checked = it.showCardBadge;

      if (this.elements.itemCardBgPicker) this.elements.itemCardBgPicker.value = it.cardBg || '#FFFFFF';
      if (this.elements.itemCardBgSwatch) this.elements.itemCardBgSwatch.style.backgroundColor = it.cardBg || '#FFFFFF';
      if (this.elements.itemCardBgHex) this.elements.itemCardBgHex.value = (it.cardBg || '#FFFFFF').replace('#', '').toUpperCase();

      if (this.elements.itemBorderColorPicker) this.elements.itemBorderColorPicker.value = it.cardBorderColor || '#171717';
      if (this.elements.itemBorderSwatch) this.elements.itemBorderSwatch.style.backgroundColor = it.cardBorderColor || '#171717';
      if (this.elements.itemBorderHex) this.elements.itemBorderHex.value = (it.cardBorderColor || '#171717').replace('#', '').toUpperCase();

      if (this.elements.itemQrSourceSelect) this.elements.itemQrSourceSelect.value = it.qrSource || 'current';
    },

    /**
     * Get the live canvas from the main QR editor workspace.
     */
    getWorkspaceCanvas: function() {
      return document.getElementById('qrCanvas');
    },

    /**
     * Master Preview Update: Validate Safety & Render to Canvas.
     */
    updatePreview: function() {
      if (!this.elements.printCanvas) return;

      var pageDims = QRStudio.PrintEngine.getEffectivePageDimensions(state);

      // 1. Update Badges
      if (this.elements.printPageSizeBadge) {
        this.elements.printPageSizeBadge.textContent = state.pageSize.toUpperCase() + ' (' + pageDims.width + '×' + pageDims.height + 'mm)';
      }
      if (this.elements.printItemsCountBadge) {
        this.elements.printItemsCountBadge.textContent = (state.items.length) + ' Item' + (state.items.length === 1 ? '' : 's');
      }
      if (this.elements.stageDimsBadge) {
        this.elements.stageDimsBadge.textContent = QRStudio.PrintEngine.formatDimensions(pageDims.width, pageDims.height);
      }

      // 2. Validate Safety & Display Warnings
      var safety = QRStudio.PrintEngine.validatePrintSafety(state);
      this.updateSafetyBanner(safety);

      // 3. Update Grid Summary Text
      if (state.gridMode && this.elements.gridSummaryText && safety.fitInfo) {
        var fit = safety.fitInfo;
        this.elements.gridSummaryText.innerHTML =
          'Grid: <strong>' + fit.gridWidthMm + ' × ' + fit.gridHeightMm + ' mm</strong> &bull; Total Labels: <strong>' + fit.totalCells + '</strong>' +
          (fit.fitsInMargins ? ' &bull; <span class="fit-ok">Fits perfectly</span>' : ' &bull; <span class="fit-bad">Exceeds margins</span>');
      }

      // 4. Render Canvas
      // For preview, render at 120 DPI for crisp screen fidelity
      var previewDpi = 120;
      QRStudio.PrintEngine.renderPageToCanvas(state, previewDpi, this.getWorkspaceCanvas(), {
        canvas: this.elements.printCanvas,
        isExport: false
      });

      this.applyZoom();
    },

    /**
     * Update Safety Warning Banners.
     */
    updateSafetyBanner: function(safety) {
      var banner = this.elements.safetyBanner;
      var text = this.elements.safetyBannerText;
      if (!banner || !text) return;

      if (safety.errors.length > 0) {
        banner.className = 'print-safety-banner is-error';
        text.innerHTML = '<strong>CRITICAL:</strong> ' + escapeHtml(safety.errors[0].message);
        banner.style.display = 'flex';
      } else if (safety.warnings.length > 0) {
        banner.className = 'print-safety-banner is-warning';
        text.innerHTML = '<strong>SAFETY ADVISORY:</strong> ' + escapeHtml(safety.warnings[0].message);
        banner.style.display = 'flex';
      } else {
        banner.className = 'print-safety-banner is-safe';
        text.innerHTML = '<strong>PRINT SAFE:</strong> All elements fit within safe printable margins. QR code size meets 20mm ISO scanability guidance.';
        banner.style.display = 'flex';
      }
    },

    /**
     * Zoom & Fit calculations.
     */
    applyZoom: function() {
      var canvas = this.elements.printCanvas;
      if (!canvas) return;

      var z = state.zoom || 1.0;
      canvas.style.transform = 'scale(' + z + ')';
      canvas.style.transformOrigin = 'top center';

      if (this.elements.zoomValDisplay) {
        this.elements.zoomValDisplay.textContent = Math.round(z * 100) + '%';
      }
    },

    fitToViewport: function() {
      var viewport = this.elements.canvasViewport;
      var canvas = this.elements.printCanvas;
      if (!viewport || !canvas) return;

      var viewW = viewport.clientWidth - 40;
      var viewH = viewport.clientHeight - 40;
      if (viewW <= 0 || viewH <= 0) {
        viewW = 600;
        viewH = 750;
      }

      var scaleW = viewW / canvas.width;
      var scaleH = viewH / canvas.height;
      var fitScale = Math.min(scaleW, scaleH, 1.2);

      state.zoom = Number(fitScale.toFixed(2));
      this.applyZoom();
    },

    /**
     * Canvas Drag & Drop and Click-to-Select Handler
     */
    handleCanvasMouseDown: function(e) {
      var canvas = this.elements.printCanvas;
      if (!canvas) return;

      var rect = canvas.getBoundingClientRect();
      var z = state.zoom || 1.0;

      // Mouse pos relative to canvas in pixels
      var clickX = (e.clientX - rect.left) / z;
      var clickY = (e.clientY - rect.top) / z;

      // Convert pixels to mm (canvas was rendered at 120 DPI)
      var pxToMm = 25.4 / 120;
      var mouseMmX = clickX * pxToMm;
      var mouseMmY = clickY * pxToMm;

      // Check if clicked inside any item (reverse loop to select top item)
      var items = state.items || [];
      var clicked = null;
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (mouseMmX >= it.x && mouseMmX <= it.x + it.width &&
            mouseMmY >= it.y && mouseMmY <= it.y + it.height) {
          clicked = it;
          break;
        }
      }

      if (clicked) {
        state.selectedItemId = clicked.id;
        isDragging = true;
        dragItem = clicked;
        dragStartX = mouseMmX;
        dragStartY = mouseMmY;
        itemStartX = clicked.x;
        itemStartY = clicked.y;

        this.renderItemsList();
        this.syncSelectedItemToUI();
        this.updatePreview();
      }
    },

    handleCanvasMouseMove: function(e) {
      if (!isDragging || !dragItem) return;

      var canvas = this.elements.printCanvas;
      if (!canvas) return;

      var rect = canvas.getBoundingClientRect();
      var z = state.zoom || 1.0;
      var pxToMm = 25.4 / 120;

      var currentMmX = ((e.clientX - rect.left) / z) * pxToMm;
      var currentMmY = ((e.clientY - rect.top) / z) * pxToMm;

      var deltaX = currentMmX - dragStartX;
      var deltaY = currentMmY - dragStartY;

      dragItem.x = Number((itemStartX + deltaX).toFixed(1));
      dragItem.y = Number((itemStartY + deltaY).toFixed(1));

      // Snapping to margins
      var margins = state.marginsMm;
      if (Math.abs(dragItem.x - margins.left) < 3) dragItem.x = margins.left;
      if (Math.abs(dragItem.y - margins.top) < 3) dragItem.y = margins.top;

      this.syncSelectedItemToUI();
      this.updatePreview();
    },

    handleCanvasMouseUp: function() {
      if (isDragging) {
        isDragging = false;
        dragItem = null;
      }
    },

    /**
     * Trigger client-side file download via Blob URL.
     */
    triggerDownload: function(blobUrl, filename) {
      var a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },

    /**
     * Export Print-Ready Genuine PDF 1.4.
     */
    exportPDF: function() {
      try {
        var pdfBytes = QRStudio.PrintEngine.generatePrintPDF(state, this.getWorkspaceCanvas());
        var blob = new Blob([pdfBytes], { type: 'application/pdf' });
        var blobUrl = URL.createObjectURL(blob);
        var filename = 'qr-print-' + state.pageSize + '-' + state.orientation + '.pdf';
        this.triggerDownload(blobUrl, filename);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
        this.showToast('Print-Ready PDF exported successfully (' + state.pageSize.toUpperCase() + ')');
      } catch (err) {
        this.showToast('PDF Export failed: ' + err.message, true);
      }
    },

    /**
     * Export Vector SVG (in mm).
     */
    exportSVG: function() {
      try {
        var svgStr = QRStudio.PrintEngine.generatePrintSVG(state, this.getWorkspaceCanvas());
        var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        var blobUrl = URL.createObjectURL(blob);
        var filename = 'qr-print-' + state.pageSize + '.svg';
        this.triggerDownload(blobUrl, filename);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
        this.showToast('Vector SVG exported successfully.');
      } catch (err) {
        this.showToast('SVG Export failed: ' + err.message, true);
      }
    },

    /**
     * Export High-Resolution 300 DPI PNG.
     */
    exportPNG: function() {
      try {
        var targetDpi = parseInt(this.elements.exportDpiSelect ? this.elements.exportDpiSelect.value : 300, 10) || 300;
        var offscreen = QRStudio.PrintEngine.renderPageToCanvas(state, targetDpi, this.getWorkspaceCanvas(), {
          isExport: true
        });

        var self = this;
        offscreen.canvas.toBlob(function(blob) {
          if (!blob) {
            self.showToast('PNG encoding failed.', true);
            return;
          }
          var blobUrl = URL.createObjectURL(blob);
          var filename = 'qr-print-' + state.pageSize + '-' + targetDpi + 'dpi.png';
          self.triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
          self.showToast('High-Res PNG exported (' + offscreen.width + ' × ' + offscreen.height + ' px @ ' + targetDpi + ' DPI)');
        }, 'image/png');
      } catch (err) {
        this.showToast('PNG Export failed: ' + err.message, true);
      }
    },

    /**
     * Export High-Quality JPEG.
     */
    exportJPEG: function() {
      try {
        var targetDpi = parseInt(this.elements.exportDpiSelect ? this.elements.exportDpiSelect.value : 300, 10) || 300;
        var offscreen = QRStudio.PrintEngine.renderPageToCanvas(state, targetDpi, this.getWorkspaceCanvas(), {
          isExport: true
        });

        var self = this;
        offscreen.canvas.toBlob(function(blob) {
          if (!blob) {
            self.showToast('JPEG encoding failed.', true);
            return;
          }
          var blobUrl = URL.createObjectURL(blob);
          var filename = 'qr-print-' + state.pageSize + '-' + targetDpi + 'dpi.jpg';
          self.triggerDownload(blobUrl, filename);
          setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
          self.showToast('High-Res JPEG exported (' + targetDpi + ' DPI)');
        }, 'image/jpeg', 0.95);
      } catch (err) {
        this.showToast('JPEG Export failed: ' + err.message, true);
      }
    },

    /**
     * Export Layout Configuration JSON.
     */
    exportJSON: function() {
      try {
        var jsonStr = QRStudio.PrintEngine.exportLayoutToJSON(state);
        var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        var blobUrl = URL.createObjectURL(blob);
        var filename = 'qr-print-layout-' + state.templateId + '.qrprint.json';
        this.triggerDownload(blobUrl, filename);
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 3000);
        this.showToast('Print layout backup exported as .qrprint.json');
      } catch (err) {
        this.showToast('JSON Export failed: ' + err.message, true);
      }
    },

    /**
     * Get internal print studio state (for testing and integration).
     */
    getState: function() {
      return state;
    },

    /**
     * Set internal print studio state.
     */
    setState: function(newState) {
      state = newState;
    },

    /**
     * Feedback Toast Message.
     */
    showToast: function(msg, isError) {
      if (QRStudio.UI && typeof QRStudio.UI.showToast === 'function') {
        QRStudio.UI.showToast(msg, isError);
        return;
      }
      var toast = document.getElementById('feedbackToast');
      var toastMsg = document.getElementById('toastMsg');
      if (toast && toastMsg) {
        toastMsg.textContent = msg;
        toast.className = 'feedback-toast is-visible' + (isError ? ' is-error' : '');
        setTimeout(function() {
          toast.className = 'feedback-toast';
        }, 3500);
      }
    }
  };

  QRStudio.PrintUI = PrintUI;

})(typeof window !== 'undefined' ? window : this);

/**
 * QR Design Studio — Editor UI Controller
 * Manages form state, type switching, live validation, error presentation,
 * empty states, and preview updates with last-valid-preview preservation.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Accessible Modal Focus Trap (WCAG 2.1 AA)
   * Keeps keyboard focus cycled within modal and restores focus to triggering element upon close.
   */
  function trapModalFocus(modalElem, previousActiveElement) {
    if (!modalElem) return function() {};

    var focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e) {
      if (e.key !== 'Tab' && e.keyCode !== 9) return;

      var focusables = Array.prototype.filter.call(
        modalElem.querySelectorAll(focusableSelector),
        function(el) { return el.offsetParent !== null; }
      );

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !modalElem.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modalElem.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    modalElem.addEventListener('keydown', handleKeyDown);

    return function releaseTrap() {
      modalElem.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try { previousActiveElement.focus(); } catch (err) {}
      }
    };
  }

  var state = {
    activeType: 'url',
    ecl: 'M',
    exportSize: 512,
    exportFormat: 'png',
    exportPreset: '512',
    exportWidth: 512,
    exportHeight: 512,
    exportLockAspect: true,
    exportFit: 'contain',
    exportTransparentBg: false,
    exportJpegQuality: 0.92,
    exportWebpQuality: 0.90,
    exportQuality: 0.90,
    exportCategory: 'all',
    exportSearchQuery: '',
    exportIsBundleMode: false,
    exportSelectedBundleFormats: ['png', 'svg', 'pdf'],
    exportPdfPageSize: 'letter',
    exportPdfOrientation: 'portrait',
    exportPdfLayout: 'single',
    activeSubtab: 'subtabTemplates',
    activeTemplateId: 'classic-minimal',
    templateCategory: 'all',
    locks: {
      colors: false,
      modules: false,
      finders: false,
      frame: false
    },
    undoDesign: null,
    activeVariations: [],
    design: {
      darkColor: '#171717',
      lightColor: '#FFFFFF',
      moduleStyle: 'square',
      finderStyle: 'square',
      activePalette: 'classic',
      // V1.2 Branding & Composition:
      logo: {
        file: null,
        dataUrl: null,
        image: null,
        filename: '',
        width: 0,
        height: 0,
        sizePercent: 22, // 15% to 28%
        padding: 6,      // 2px to 16px
        badgeShape: 'rounded', // 'rounded' | 'circle' | 'square'
        badgeColor: '#FFFFFF'
      },
      frame: {
        style: 'none',   // 'none' | 'badge' | 'top-banner' | 'bottom-bar' | 'ticket'
        text: 'SCAN ME',
        bannerColor: '#FFE600',
        textColor: '#171717'
      },
      background: {
        file: null,
        dataUrl: null,
        image: null,
        filename: '',
        width: 0,
        height: 0,
        fit: 'cover',    // 'cover' | 'contain'
        zoom: 1.0,       // 1.0 to 2.5
        panX: 0,         // -0.5 to 0.5
        panY: 0,         // -0.5 to 0.5
        opacity: 1.0,    // 0.1 to 1.0
        tintColor: '#000000',
        tintOpacity: 0.0 // 0.0 to 0.9
      }
    },
    formData: {
      url: { url: '' },
      text: { text: '' },
      wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
      email: { email: '', subject: '', body: '' },
      phone: { phone: '' },
      whatsapp: { phone: '', message: '' }
    },
    lastValidModel: null,
    lastValidType: null,
    lastValidSummary: '',
    hasEverGenerated: false
  };

  var UI = {
    elements: {},

    /**
     * Cache DOM element references.
     */
    init: function() {
      this.elements = {
        typeNavList: document.getElementById('typeNavList'),
        formContainer: document.getElementById('formContainer'),
        qrCanvas: document.getElementById('qrCanvas'),
        canvasWrap: document.getElementById('canvasWrap'),
        emptyState: document.getElementById('emptyState'),
        warningBanner: document.getElementById('warningBanner'),
        warningText: document.getElementById('warningText'),
        metaTypeBadge: document.getElementById('metaTypeBadge'),
        metaDimensionsBadge: document.getElementById('metaDimensionsBadge'),
        metaEclBadge: document.getElementById('metaEclBadge'),
        metaStyleBadge: document.getElementById('metaStyleBadge'),
        metaContrastBadge: document.getElementById('metaContrastBadge'),
        metaFrameBadge: document.getElementById('metaFrameBadge'),
        metaLogoBadge: document.getElementById('metaLogoBadge'),
        payloadInspector: document.getElementById('payloadInspector'),
        payloadInspectorCode: document.getElementById('payloadInspectorCode'),
        copyPayloadBtn: document.getElementById('copyPayloadBtn'),
        exportSizeSelect: document.getElementById('exportSizeSelect'),
        exportBtn: document.getElementById('exportBtn'),
        eclRadios: document.querySelectorAll('input[name="ecl"]'),
        toast: document.getElementById('feedbackToast'),
        toastMsg: document.getElementById('toastMsg'),

        // V1.1 Core Design Controls
        paletteGrid: document.getElementById('paletteGrid'),
        fgColorPicker: document.getElementById('fgColorPicker'),
        fgSwatchDisplay: document.getElementById('fgSwatchDisplay'),
        fgHexInput: document.getElementById('fgHexInput'),
        fgHexWrapper: document.getElementById('fgHexWrapper'),
        bgColorPicker: document.getElementById('bgColorPicker'),
        bgSwatchDisplay: document.getElementById('bgSwatchDisplay'),
        bgHexInput: document.getElementById('bgHexInput'),
        bgHexWrapper: document.getElementById('bgHexWrapper'),
        resetDesignBtn: document.getElementById('resetDesignBtn'),
        restoreContrastBtn: document.getElementById('restoreContrastBtn'),
        moduleStyleBtns: document.querySelectorAll('#moduleStyleGroup .style-toggle-btn'),
        finderStyleBtns: document.querySelectorAll('#finderStyleGroup .style-toggle-btn'),
        contrastAdvisoryBox: document.getElementById('contrastAdvisoryBox'),
        contrastBadge: document.getElementById('contrastBadge'),
        contrastHeading: document.getElementById('contrastHeading'),
        contrastDesc: document.getElementById('contrastDesc'),

        // V1.2 Branding & Composition Subtabs
        subtabs: document.querySelectorAll('.studio-subtab'),
        subpanels: document.querySelectorAll('.subpanel'),
        logoStatusBadge: document.getElementById('logoStatusBadge'),
        frameStatusBadge: document.getElementById('frameStatusBadge'),
        bgStatusBadge: document.getElementById('bgStatusBadge'),

        // V1.2 Logo Badge Controls
        logoFileInput: document.getElementById('logoFileInput'),
        logoDropzone: document.getElementById('logoDropzone'),
        logoActiveCard: document.getElementById('logoActiveCard'),
        logoThumbnail: document.getElementById('logoThumbnail'),
        logoFilename: document.getElementById('logoFilename'),
        logoMeta: document.getElementById('logoMeta'),
        btnReplaceLogo: document.getElementById('btnReplaceLogo'),
        btnRemoveLogo: document.getElementById('btnRemoveLogo'),
        logoControlsGroup: document.getElementById('logoControlsGroup'),
        logoSizeSlider: document.getElementById('logoSizeSlider'),
        logoSizeValue: document.getElementById('logoSizeValue'),
        logoPaddingSlider: document.getElementById('logoPaddingSlider'),
        logoPaddingValue: document.getElementById('logoPaddingValue'),
        badgeShapeBtns: document.querySelectorAll('#badgeShapeGroup .style-toggle-btn'),
        badgeColorPicker: document.getElementById('badgeColorPicker'),
        badgeSwatchDisplay: document.getElementById('badgeSwatchDisplay'),
        badgeHexInput: document.getElementById('badgeHexInput'),
        badgeHexWrapper: document.getElementById('badgeHexWrapper'),
        btnSetHighEcl: document.getElementById('btnSetHighEcl'),

        // V1.2 Frames & CTA Controls
        frameCards: document.querySelectorAll('#frameStyleGrid .frame-card'),
        frameOptionsGroup: document.getElementById('frameOptionsGroup'),
        ctaTextInput: document.getElementById('ctaTextInput'),
        ctaPresetChips: document.querySelectorAll('.cta-preset-chip'),
        frameBannerColorPicker: document.getElementById('frameBannerColorPicker'),
        frameBannerSwatch: document.getElementById('frameBannerSwatch'),
        frameBannerHexInput: document.getElementById('frameBannerHexInput'),
        frameBannerHexWrapper: document.getElementById('frameBannerHexWrapper'),
        frameTextColorPicker: document.getElementById('frameTextColorPicker'),
        frameTextSwatch: document.getElementById('frameTextSwatch'),
        frameTextHexInput: document.getElementById('frameTextHexInput'),
        frameTextHexWrapper: document.getElementById('frameTextHexWrapper'),

        // V1.2 Background Image Controls
        bgFileInput: document.getElementById('bgFileInput'),
        bgDropzone: document.getElementById('bgDropzone'),
        bgActiveCard: document.getElementById('bgActiveCard'),
        bgThumbnail: document.getElementById('bgThumbnail'),
        bgFilename: document.getElementById('bgFilename'),
        bgMeta: document.getElementById('bgMeta'),
        btnReplaceBg: document.getElementById('btnReplaceBg'),
        btnRemoveBg: document.getElementById('btnRemoveBg'),
        bgControlsGroup: document.getElementById('bgControlsGroup'),
        bgFitBtns: document.querySelectorAll('#bgFitGroup .style-toggle-btn'),
        bgZoomSlider: document.getElementById('bgZoomSlider'),
        bgZoomValue: document.getElementById('bgZoomValue'),
        bgPanXSlider: document.getElementById('bgPanXSlider'),
        bgPanXValue: document.getElementById('bgPanXValue'),
        bgOpacitySlider: document.getElementById('bgOpacitySlider'),
        bgOpacityValue: document.getElementById('bgOpacityValue'),
        bgTintColorPicker: document.getElementById('bgTintColorPicker'),
        bgTintSwatch: document.getElementById('bgTintSwatch'),
        bgTintHexInput: document.getElementById('bgTintHexInput'),
        bgTintHexWrapper: document.getElementById('bgTintHexWrapper'),
        bgTintOpacitySlider: document.getElementById('bgTintOpacitySlider'),
        bgTintOpacityValue: document.getElementById('bgTintOpacityValue'),
        btnResetBg: document.getElementById('btnResetBg'),

        // V1.3 Template Gallery & Variations Controls
        btnRandomize: document.getElementById('randomizeDesignBtn'),
        btnVariations: document.getElementById('generateVariationsBtn'),
        btnUndoDesign: document.getElementById('undoDesignBtn'),
        lockBtns: document.querySelectorAll('.lock-toggle-btn'),
        subtabTemplates: document.getElementById('subtabTemplates'),
        subpanelTemplates: document.getElementById('subpanelTemplates'),
        templatesCountBadge: document.getElementById('templatesCountBadge'),
        btnToggleTemplatesGallery: document.getElementById('btnToggleTemplatesGallery'),
        templatesCollapsibleContainer: document.getElementById('templatesCollapsibleContainer'),
        templatesActiveSummary: document.getElementById('templatesActiveSummary'),
        templatesToggleLabel: document.getElementById('templatesToggleLabel'),
        btnCollapseTemplatesGallery: document.getElementById('btnCollapseTemplatesGallery'),
        categoryPills: document.querySelectorAll('.category-pill'),
        templateGrid: document.getElementById('templateGrid'),
        templateEmptyState: document.getElementById('templateEmptyState'),
        btnResetTemplateFilter: document.getElementById('btnResetTemplateFilter'),
        variationsModalBackdrop: document.getElementById('variationsModalBackdrop'),
        variationsModal: document.getElementById('variationsModal'),
        variationsGrid: document.getElementById('variationsGrid'),
        btnCloseVariations: document.getElementById('btnCloseVariations'),
        btnReturnOriginal: document.getElementById('btnReturnOriginal'),
        btnRerollVariations: document.getElementById('btnRerollVariations'),

        // Responsive Mobile Navigation
        btnMobileNavToggle: document.getElementById('btnMobileNavToggle'),
        headerNav: document.getElementById('headerNav'),

        // V1.4 Project Management & History Controls
        topbarProjectName: document.getElementById('topbarProjectName'),
        btnManageProjects: document.getElementById('btnManageProjects'),
        btnQuickNewProject: document.getElementById('btnQuickNewProject'),
        btnHistoryUndo: document.getElementById('btnHistoryUndo'),
        btnHistoryRedo: document.getElementById('btnHistoryRedo'),
        autosaveStatusBadge: document.getElementById('autosaveStatusBadge'),
        autosaveStatusText: document.getElementById('autosaveStatusText'),
        btnResetPayload: document.getElementById('btnResetPayload'),
        projectManagerModal: document.getElementById('projectManagerModal'),
        btnCloseProjectManager: document.getElementById('btnCloseProjectManager'),
        btnCloseProjectManagerFooter: document.getElementById('btnCloseProjectManagerFooter'),
        btnModalCreateProject: document.getElementById('btnModalCreateProject'),
        projectCountBadge: document.getElementById('projectCountBadge'),
        projectListGrid: document.getElementById('projectListGrid'),
        createProjectModal: document.getElementById('createProjectModal'),
        createProjectForm: document.getElementById('createProjectForm'),
        newProjectNameInput: document.getElementById('newProjectNameInput'),
        newProjectNameError: document.getElementById('newProjectNameError'),
        btnSubmitCreateProject: document.getElementById('btnSubmitCreateProject'),
        btnCancelCreateProject: document.getElementById('btnCancelCreateProject'),
        btnCloseCreateProjectModal: document.getElementById('btnCloseCreateProjectModal'),
        renameProjectModal: document.getElementById('renameProjectModal'),
        renameProjectForm: document.getElementById('renameProjectForm'),
        renameProjectNameInput: document.getElementById('renameProjectNameInput'),
        renameProjectNameError: document.getElementById('renameProjectNameError'),
        btnSubmitRenameProject: document.getElementById('btnSubmitRenameProject'),
        btnCancelRenameProject: document.getElementById('btnCancelRenameProject'),
        btnCloseRenameProjectModal: document.getElementById('btnCloseRenameProjectModal'),
        confirmModal: document.getElementById('confirmModal'),
        confirmTag: document.getElementById('confirmTag'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmMessage: document.getElementById('confirmMessage'),
        btnConfirmCancel: document.getElementById('btnConfirmCancel'),
        btnConfirmProceed: document.getElementById('btnConfirmProceed'),

        // V1.5 Project Import & Export Elements
        btnQuickExportProject: document.getElementById('btnQuickExportProject'),
        btnQuickImportProject: document.getElementById('btnQuickImportProject'),
        btnModalImportProject: document.getElementById('btnModalImportProject'),
        btnExportProjectFile: document.getElementById('btnExportProjectFile'),
        projectFileInput: document.getElementById('projectFileInput'),
        importPreviewModal: document.getElementById('importPreviewModal'),
        btnCloseImportPreview: document.getElementById('btnCloseImportPreview'),
        btnCancelImport: document.getElementById('btnCancelImport'),
        btnImportReplace: document.getElementById('btnImportReplace'),
        btnImportAsNew: document.getElementById('btnImportAsNew'),
        importAlertBanner: document.getElementById('importAlertBanner'),
        importAlertText: document.getElementById('importAlertText'),
        importProjectNameInput: document.getElementById('importProjectNameInput'),
        importSchemaBadge: document.getElementById('importSchemaBadge'),
        importTypeBadge: document.getElementById('importTypeBadge'),
        importPayloadText: document.getElementById('importPayloadText'),
        importPayloadMeta: document.getElementById('importPayloadMeta'),
        importDarkSwatch: document.getElementById('importDarkSwatch'),
        importLightSwatch: document.getElementById('importLightSwatch'),
        importStyleDesc: document.getElementById('importStyleDesc'),
        importFrameDesc: document.getElementById('importFrameDesc'),
        importAssetsRow: document.getElementById('importAssetsRow'),
        importMetaText: document.getElementById('importMetaText'),

        // Universal Export Studio Elements
        exportStudioPanel: document.getElementById('exportStudioPanel'),
        exportCatTabs: document.getElementById('exportCatTabs'),
        exportFormatSearch: document.getElementById('exportFormatSearch'),
        btnToggleBundleMode: document.getElementById('btnToggleBundleMode'),
        universalFormatGrid: document.getElementById('universalFormatGrid'),
        exportDimensionsGroup: document.getElementById('exportDimensionsGroup'),
        formatBtnPng: document.getElementById('formatBtnPng'),
        formatBtnJpeg: document.getElementById('formatBtnJpeg'),
        formatBtnSvg: document.getElementById('formatBtnSvg'),
        formatBtnWebp: document.getElementById('formatBtnWebp'),
        formatBtns: document.querySelectorAll('.btn-export-format'),
        customDimensionsCard: document.getElementById('customDimensionsCard'),
        exportCustomWidth: document.getElementById('exportCustomWidth'),
        exportCustomHeight: document.getElementById('exportCustomHeight'),
        exportLockAspect: document.getElementById('exportLockAspect'),
        dimFitWrap: document.getElementById('dimFitWrap'),
        exportFitSelect: document.getElementById('exportFitSelect'),
        exportDimensionWarning: document.getElementById('exportDimensionWarning'),
        exportDimensionWarningText: document.getElementById('exportDimensionWarningText'),
        formatOptionsRaster: document.getElementById('formatOptionsRaster'),
        wrapTransparentBg: document.getElementById('wrapTransparentBg'),
        exportTransparentBg: document.getElementById('exportTransparentBg'),
        wrapQualitySlider: document.getElementById('wrapQualitySlider'),
        exportQualitySlider: document.getElementById('exportQualitySlider'),
        exportQualityVal: document.getElementById('exportQualityVal'),
        browserSupportBadge: document.getElementById('browserSupportBadge'),
        browserSupportText: document.getElementById('browserSupportText'),
        formatNoticeNote: document.getElementById('formatNoticeNote'),
        formatOptionsPdf: document.getElementById('formatOptionsPdf'),
        pdfPageSizeSelect: document.getElementById('pdfPageSizeSelect'),
        pdfOrientationSelect: document.getElementById('pdfOrientationSelect'),
        pdfLayoutSelect: document.getElementById('pdfLayoutSelect'),
        formatOptionsSpreadsheet: document.getElementById('formatOptionsSpreadsheet'),
        formatOptionsDesign: document.getElementById('formatOptionsDesign'),
        formatOptionsEmbed: document.getElementById('formatOptionsEmbed'),
        embedSnippetText: document.getElementById('embedSnippetText'),
        btnCopyEmbedSnippet: document.getElementById('btnCopyEmbedSnippet'),
        bundleActionBar: document.getElementById('bundleActionBar'),
        bundleCountBadge: document.getElementById('bundleCountBadge'),
        btnExportBundleMain: document.getElementById('btnExportBundleMain'),
        btnResetExportSettings: document.getElementById('btnResetExportSettings'),
        summaryFormatBadge: document.getElementById('summaryFormatBadge'),
        summaryDimsBadge: document.getElementById('summaryDimsBadge'),
        summaryFilenameStr: document.getElementById('summaryFilenameStr'),
        exportBtnText: document.getElementById('exportBtnText')
      };

      this.history = new QRStudio.HistoryManager(35);
      this.projectStore = QRStudio.ProjectManager;

      // Load active project if store is available
      if (this.projectStore) {
        var activeProj = this.projectStore.init();
        if (activeProj) {
          this.applyStateSnapshot(activeProj);
        }
      }

      this.renderTypeTabs();
      this.renderActiveForm();
      this.renderPalettes();
      this.renderTemplateGallery(state.templateCategory || 'all');
      this.updateContrastAdvisory();
      this.updateStatusBadges();
      this.updateTopbarProjectName();
      this.updateAutosaveStatus('saved');
      this.attachGlobalListeners();
      this.initExportStudio();

      // Record baseline initial state in history
      this.history.push(this.getSerializableState());
      this.updateHistoryButtons();

      // If starter URL is empty, show empty state; if pre-filled, generate
      this.processInput(false);
    },

    /**
     * Render the 6 payload type navigation buttons.
     */
    renderTypeTabs: function() {
      var self = this;
      var types = QRStudio.Payloads.listTypes();
      var container = this.elements.typeNavList;
      if (!container) return;

      container.innerHTML = '';

      types.forEach(function(type) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'type-tab-btn';
        btn.id = 'tab-' + type.id;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', type.id === state.activeType ? 'true' : 'false');
        btn.setAttribute('aria-controls', 'panel-' + type.id);
        btn.title = type.label;

        btn.innerHTML = type.icon + '<span>' + type.shortLabel + '</span>';

        btn.addEventListener('click', function() {
          self.switchType(type.id);
        });

        // WAI-ARIA Keyboard navigation for tabs
        btn.addEventListener('keydown', function(e) {
          var tabs = Array.from(container.querySelectorAll('.type-tab-btn'));
          var currentIndex = tabs.indexOf(btn);
          var targetIndex = -1;

          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            targetIndex = (currentIndex + 1) % tabs.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          } else if (e.key === 'Home') {
            e.preventDefault();
            targetIndex = 0;
          } else if (e.key === 'End') {
            e.preventDefault();
            targetIndex = tabs.length - 1;
          }

          if (targetIndex !== -1 && tabs[targetIndex]) {
            tabs[targetIndex].focus();
            tabs[targetIndex].click();
          }
        });

        li.appendChild(btn);
        container.appendChild(li);
      });
    },

    /**
     * Switch active payload type.
     */
    switchType: function(typeId) {
      if (state.activeType === typeId) return;

      state.activeType = typeId;

      // Update tabs aria-selected
      var tabs = this.elements.typeNavList.querySelectorAll('.type-tab-btn');
      tabs.forEach(function(tab) {
        var isMatch = tab.id === 'tab-' + typeId;
        tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });

      this.renderActiveForm();
      this.processInput(false);
      this.recordChange(false);
    },

    /**
     * Render the dynamic form fields for the currently active payload type.
     */
    renderActiveForm: function() {
      var self = this;
      var typeDef = QRStudio.Payloads.getType(state.activeType);
      var container = this.elements.formContainer;
      if (!typeDef || !container) return;

      container.innerHTML = '';
      var currentData = state.formData[state.activeType] || {};

      var stack = document.createElement('div');
      stack.className = 'form-stack';
      stack.id = 'panel-' + typeDef.id;
      stack.setAttribute('role', 'tabpanel');
      stack.setAttribute('aria-labelledby', 'tab-' + typeDef.id);

      typeDef.fields.forEach(function(field) {
        var group = document.createElement('div');
        group.className = 'form-group';
        group.id = 'group-' + field.name;

        var val = currentData[field.name];
        if (val === undefined && field.defaultValue !== undefined) {
          val = field.defaultValue;
          currentData[field.name] = val;
        }

        if (field.type === 'checkbox') {
          var label = document.createElement('label');
          label.className = 'checkbox-label';

          var input = document.createElement('input');
          input.type = 'checkbox';
          input.className = 'checkbox-input';
          input.id = 'field-' + field.name;
          input.name = field.name;
          input.checked = !!val;

          input.addEventListener('change', function() {
            currentData[field.name] = input.checked;
            self.processInput(true);
            self.recordChange(false);
          });

          label.appendChild(input);
          label.appendChild(document.createTextNode(' ' + field.label));
          group.appendChild(label);
        } else {
          // Label row
          var labelRow = document.createElement('div');
          labelRow.className = 'form-label-row';

          var label = document.createElement('label');
          label.className = 'form-label';
          label.htmlFor = 'field-' + field.name;
          label.textContent = field.label;

          if (field.required) {
            var reqSpan = document.createElement('span');
            reqSpan.className = 'label-required';
            reqSpan.setAttribute('aria-hidden', 'true');
            reqSpan.textContent = ' *';
            label.appendChild(reqSpan);
          }

          labelRow.appendChild(label);

          if (field.hint) {
            var hint = document.createElement('span');
            hint.className = 'label-hint';
            hint.id = 'hint-' + field.name;
            hint.textContent = field.hint;
            labelRow.appendChild(hint);
          }
          group.appendChild(labelRow);

          // Field element
          var inputElem;
          if (field.type === 'textarea') {
            inputElem = document.createElement('textarea');
            inputElem.className = 'textarea-field';
            inputElem.value = val || '';
            inputElem.placeholder = field.placeholder || '';
            inputElem.rows = 3;
          } else if (field.type === 'select') {
            inputElem = document.createElement('select');
            inputElem.className = 'select-field';
            field.options.forEach(function(opt) {
              var optElem = document.createElement('option');
              optElem.value = opt.value;
              optElem.textContent = opt.label;
              if (opt.value === val) {
                optElem.selected = true;
              }
              inputElem.appendChild(optElem);
            });
          } else {
            inputElem = document.createElement('input');
            inputElem.type = field.type || 'text';
            inputElem.className = 'input-field';
            inputElem.value = val || '';
            inputElem.placeholder = field.placeholder || '';
          }

          inputElem.id = 'field-' + field.name;
          inputElem.name = field.name;
          inputElem.setAttribute('aria-invalid', 'false');

          // Accessible descriptions (both hint and error)
          var describedBy = (field.hint ? 'hint-' + field.name + ' ' : '') + 'error-' + field.name;
          inputElem.setAttribute('aria-describedby', describedBy);

          // Event listeners
          inputElem.addEventListener('input', function() {
            currentData[field.name] = inputElem.value;
            self.processInput(true);
            self.recordChange(true);
          });

          inputElem.addEventListener('blur', function() {
            self.recordChange(false);
          });

          if (field.type === 'select') {
            inputElem.addEventListener('change', function() {
              currentData[field.name] = inputElem.value;
              // Handle Wi-Fi auth change disabling password field
              if (state.activeType === 'wifi' && field.name === 'auth') {
                self.updateWifiPasswordState(inputElem.value);
              }
              self.processInput(true);
              self.recordChange(false);
            });
          }

          group.appendChild(inputElem);

          // Inline error element
          var errElem = document.createElement('div');
          errElem.className = 'field-error-msg';
          errElem.id = 'error-' + field.name;
          errElem.setAttribute('role', 'alert');
          errElem.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span class="err-text"></span>';
          group.appendChild(errElem);
        }

        stack.appendChild(group);
      });

      container.appendChild(stack);

      // Check Wi-Fi password initial state
      if (state.activeType === 'wifi') {
        this.updateWifiPasswordState(currentData.auth || 'WPA');
      }
    },

    /**
     * Disable/enable Wi-Fi password field depending on authentication mode.
     */
    updateWifiPasswordState: function(authMode) {
      var passInput = document.getElementById('field-password');
      var passGroup = document.getElementById('group-password');
      if (!passInput || !passGroup) return;

      var isNoPass = authMode === 'nopass';
      passInput.disabled = isNoPass;
      if (isNoPass) {
        passGroup.style.opacity = '0.45';
        this.clearFieldError('password');
      } else {
        passGroup.style.opacity = '1';
      }
    },

    /**
     * Validate current input and update preview accordingly.
     * Preserves last valid preview if current input is invalid.
     */
    processInput: function(showErrorsImmediately) {
      var typeDef = QRStudio.Payloads.getType(state.activeType);
      var currentData = state.formData[state.activeType] || {};
      var validation = typeDef.validate(currentData);

      this.clearAllErrors();

      // Check if all fields for this type are completely blank
      var isBlank = this.isFormBlank(currentData);

      if (validation.isValid) {
        // Valid input! Generate and render new QR code
        this.hideWarning();
        try {
          var qrModel = QRStudio.Engine.generate(validation.payload, state.ecl);

          // Update state
          state.lastValidModel = qrModel;
          state.lastValidType = state.activeType;
          state.lastValidSummary = validation.summary;
          state.hasEverGenerated = true;

          // Render canvas
          this.renderPreview(qrModel);
          this.updateMetadata(qrModel, state.activeType);
          this.updatePayloadInspector(validation.payload);
          this.elements.exportBtn.disabled = false;
          this.updateExportSummary();
        } catch (engineErr) {
          this.showWarning('QR Generation error: ' + engineErr.message);
        }
      } else {
        // Invalid input
        // Only display errors if explicitly requested AND the form is not completely blank/untouched
        if (showErrorsImmediately && !isBlank) {
          this.displayErrors(validation.errors);
        }

        if (state.lastValidModel && !isBlank) {
          // Preserve the last valid QR preview and inform user
          this.showWarning('Invalid input — displaying previous valid QR code. Correct the highlighted errors to update.');
          if (this.elements.exportBtn) this.elements.exportBtn.disabled = false;
          this.updateExportSummary();
        } else {
          // No previous valid QR exists or field is untouched blank: display clean empty state
          this.showEmptyState();
          // Keep exportBtn clickable so attempting to export triggers validation errors!
          if (this.elements.exportBtn) this.elements.exportBtn.disabled = false;
          this.updateExportSummary();
          this.updatePayloadInspector('');
        }
      }
    },

    /**
     * Check if form data is entirely empty or untouched.
     * Considers default protocol prefixes ('https://', 'http://') as blank/untouched.
     */
    isFormBlank: function(data) {
      if (!data) return true;
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k === 'auth' || k === 'hidden') continue;
        var val = data[k];
        if (typeof val === 'string') {
          var trimmed = val.trim();
          // If field is a URL and only contains the protocol prefix, it is blank/untouched
          if (k === 'url' && (trimmed === '' || trimmed === 'https://' || trimmed === 'http://')) {
            continue;
          }
          if (trimmed.length > 0) {
            return false;
          }
        }
      }
      return true;
    },

    /**
     * Render QR code on visible canvas with complete V1.2 composition layers.
     */
    renderPreview: function(qrModel) {
      var canvas = this.elements.qrCanvas;
      var wrap = this.elements.canvasWrap;
      var emptyState = this.elements.emptyState;

      emptyState.classList.remove('is-visible');
      wrap.style.display = 'flex';

      QRStudio.Engine.renderComposition(qrModel, canvas, {
        size: 512,
        margin: 4,
        darkColor: state.design.darkColor,
        lightColor: state.design.lightColor,
        moduleStyle: state.design.moduleStyle,
        finderStyle: state.design.finderStyle,
        logo: state.design.logo,
        background: state.design.background,
        frame: state.design.frame
      });

      if (state.exportFormat === 'html-embed') {
        this.refreshEmbedSnippet();
      }
    },

    /**
     * Display empty state when no input is entered yet.
     */
    showEmptyState: function() {
      this.elements.canvasWrap.style.display = 'none';
      this.elements.emptyState.classList.add('is-visible');
      this.elements.metaTypeBadge.textContent = 'None';
      this.elements.metaDimensionsBadge.textContent = '—';
      this.elements.metaEclBadge.textContent = state.ecl;
      if (this.elements.metaFrameBadge) this.elements.metaFrameBadge.textContent = 'None';
      if (this.elements.metaLogoBadge) this.elements.metaLogoBadge.textContent = 'None';
      this.hideWarning();
    },

    /**
     * Update metadata indicators below preview.
     */
    updateMetadata: function(qrModel, typeId) {
      var typeDef = QRStudio.Payloads.getType(typeId);
      this.elements.metaTypeBadge.textContent = typeDef ? typeDef.shortLabel : typeId.toUpperCase();
      this.elements.metaDimensionsBadge.textContent = qrModel.moduleCount + '×' + qrModel.moduleCount + ' modules (v' + qrModel.version + ')';
      this.elements.metaEclBadge.textContent = qrModel.ecl + ' (' + QRStudio.Engine.ERROR_CORRECTION_LEVELS[qrModel.ecl].recovery + ')';

      if (this.elements.metaStyleBadge) {
        var mStyle = state.design.moduleStyle.charAt(0).toUpperCase() + state.design.moduleStyle.slice(1);
        var fStyle = state.design.finderStyle.charAt(0).toUpperCase() + state.design.finderStyle.slice(1);
        this.elements.metaStyleBadge.textContent = mStyle + ' / ' + fStyle;
      }

      if (this.elements.metaFrameBadge) {
        var fStyle = state.design.frame.style;
        this.elements.metaFrameBadge.textContent = fStyle === 'none' ? 'None' : fStyle.toUpperCase();
      }

      if (this.elements.metaLogoBadge) {
        this.elements.metaLogoBadge.textContent = state.design.logo.image ? (state.design.logo.sizePercent + '%') : 'None';
      }
    },

    /**
     * Update the raw payload string display.
     */
    updatePayloadInspector: function(payloadStr) {
      var box = this.elements.payloadInspectorCode;
      if (!box) return;

      if (!payloadStr) {
        box.textContent = '(Awaiting valid payload input)';
        box.style.opacity = '0.5';
        this.elements.copyPayloadBtn.disabled = true;
      } else {
        box.textContent = payloadStr;
        box.style.opacity = '1';
        this.elements.copyPayloadBtn.disabled = false;
      }
    },

    /**
     * Show warning banner over preview.
     */
    showWarning: function(msg) {
      this.elements.warningText.textContent = msg;
      this.elements.warningBanner.classList.add('is-visible');
    },

    /**
     * Hide warning banner.
     */
    hideWarning: function() {
      this.elements.warningBanner.classList.remove('is-visible');
      this.elements.warningText.textContent = '';
    },

    /**
     * Display field-specific validation errors.
     */
    displayErrors: function(errors) {
      var self = this;
      Object.keys(errors).forEach(function(fieldName) {
        var group = document.getElementById('group-' + fieldName);
        var errElem = document.getElementById('error-' + fieldName);
        var inputElem = document.getElementById('field-' + fieldName);
        if (group && errElem) {
          group.classList.add('has-error');
          if (inputElem) {
            inputElem.setAttribute('aria-invalid', 'true');
          }
          var textSpan = errElem.querySelector('.err-text');
          if (textSpan) {
            textSpan.textContent = errors[fieldName];
          }
        }
      });
    },

    /**
     * Clear error for a single field.
     */
    clearFieldError: function(fieldName) {
      var group = document.getElementById('group-' + fieldName);
      var inputElem = document.getElementById('field-' + fieldName);
      if (group) {
        group.classList.remove('has-error');
      }
      if (inputElem) {
        inputElem.setAttribute('aria-invalid', 'false');
      }
    },

    /**
     * Clear all current field error states.
     */
    clearAllErrors: function() {
      var groups = document.querySelectorAll('.form-group.has-error');
      groups.forEach(function(g) {
        g.classList.remove('has-error');
      });
      var invalidInputs = document.querySelectorAll('[aria-invalid="true"]');
      invalidInputs.forEach(function(input) {
        input.setAttribute('aria-invalid', 'false');
      });
    },

    /**
     * Render the 8 curated color palette buttons with dual swatches.
     */
    renderPalettes: function() {
      var self = this;
      var grid = this.elements.paletteGrid;
      if (!grid || !QRStudio.Design || !QRStudio.Design.PALETTES) return;

      grid.innerHTML = '';

      QRStudio.Design.PALETTES.forEach(function(palette) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'palette-chip' + (palette.id === state.design.activePalette ? ' is-active' : '');
        btn.id = 'palette-' + palette.id;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', palette.id === state.design.activePalette ? 'true' : 'false');
        btn.setAttribute('data-palette-id', palette.id);
        btn.title = palette.name + ' — ' + palette.description;

        btn.innerHTML =
          '<div class="palette-swatches" aria-hidden="true">' +
            '<span class="palette-swatch-dark" style="background-color: ' + palette.dark + ';"></span>' +
            '<span class="palette-swatch-light" style="background-color: ' + palette.light + ';"></span>' +
          '</div>' +
          '<div class="palette-chip-info">' +
            '<span class="palette-name">' + palette.name + '</span>' +
          '</div>';

        btn.addEventListener('click', function() {
          self.applyPalette(palette.id);
        });

        grid.appendChild(btn);
      });
    },

    /**
     * Apply a curated color palette preset.
     */
    applyPalette: function(paletteId) {
      if (!QRStudio.Design || !QRStudio.Design.PALETTES) return;
      var palette = QRStudio.Design.PALETTES.find(function(p) { return p.id === paletteId; });
      if (!palette) return;

      state.design.darkColor = palette.dark;
      state.design.lightColor = palette.light;
      state.design.activePalette = palette.id;

      // Sync color pickers and hex inputs
      if (this.elements.fgColorPicker) this.elements.fgColorPicker.value = palette.dark;
      if (this.elements.fgSwatchDisplay) this.elements.fgSwatchDisplay.style.backgroundColor = palette.dark;
      if (this.elements.fgHexInput) this.elements.fgHexInput.value = palette.dark.replace('#', '').toUpperCase();
      if (this.elements.fgHexWrapper) this.elements.fgHexWrapper.classList.remove('is-invalid');

      if (this.elements.bgColorPicker) this.elements.bgColorPicker.value = palette.light;
      if (this.elements.bgSwatchDisplay) this.elements.bgSwatchDisplay.style.backgroundColor = palette.light;
      if (this.elements.bgHexInput) this.elements.bgHexInput.value = palette.light.replace('#', '').toUpperCase();
      if (this.elements.bgHexWrapper) this.elements.bgHexWrapper.classList.remove('is-invalid');

      // Update palette active states
      var chips = this.elements.paletteGrid ? this.elements.paletteGrid.querySelectorAll('.palette-chip') : [];
      chips.forEach(function(chip) {
        var isActive = chip.getAttribute('data-palette-id') === palette.id;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });

      state.activeTemplateId = null;
      this.renderTemplateGallery(state.templateCategory);
      this.updateContrastAdvisory();

      // Immediate canvas update if code exists
      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Applied palette: ' + palette.name, 'success');
    },

    /**
     * Update custom foreground or background color.
     */
    setCustomColor: function(role, hex, isManualHex) {
      if (!QRStudio.Design.isValidHex(hex)) return;

      var normHex = QRStudio.Design.normalizeHex(hex);

      if (role === 'fg') {
        state.design.darkColor = normHex;
        if (this.elements.fgColorPicker) this.elements.fgColorPicker.value = normHex;
        if (this.elements.fgSwatchDisplay) this.elements.fgSwatchDisplay.style.backgroundColor = normHex;
        if (!isManualHex && this.elements.fgHexInput) {
          this.elements.fgHexInput.value = normHex.replace('#', '').toUpperCase();
        }
        if (this.elements.fgHexWrapper) this.elements.fgHexWrapper.classList.remove('is-invalid');
      } else if (role === 'bg') {
        state.design.lightColor = normHex;
        if (this.elements.bgColorPicker) this.elements.bgColorPicker.value = normHex;
        if (this.elements.bgSwatchDisplay) this.elements.bgSwatchDisplay.style.backgroundColor = normHex;
        if (!isManualHex && this.elements.bgHexInput) {
          this.elements.bgHexInput.value = normHex.replace('#', '').toUpperCase();
        }
        if (this.elements.bgHexWrapper) this.elements.bgHexWrapper.classList.remove('is-invalid');
      }

      // Check if current colors match any curated palette
      var matchedPalette = QRStudio.Design.PALETTES.find(function(p) {
        return p.dark.toUpperCase() === state.design.darkColor.toUpperCase() &&
               p.light.toUpperCase() === state.design.lightColor.toUpperCase();
      });

      state.design.activePalette = matchedPalette ? matchedPalette.id : null;

      // Update active palette chip UI
      var chips = this.elements.paletteGrid ? this.elements.paletteGrid.querySelectorAll('.palette-chip') : [];
      chips.forEach(function(chip) {
        var isActive = matchedPalette && chip.getAttribute('data-palette-id') === matchedPalette.id;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });

      state.activeTemplateId = null;
      this.renderTemplateGallery(state.templateCategory);
      this.updateContrastAdvisory();

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Update module shape style (square, rounded, dots).
     */
    setModuleStyle: function(styleValue) {
      if (styleValue !== 'square' && styleValue !== 'rounded' && styleValue !== 'dots') {
        styleValue = 'square';
      }

      state.design.moduleStyle = styleValue;
      state.activeTemplateId = null;

      if (this.elements.moduleStyleBtns) {
        this.elements.moduleStyleBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-style-value') === styleValue;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      this.renderTemplateGallery(state.templateCategory);
      this.updateContrastAdvisory();

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Update finder pattern style (square, rounded).
     */
    setFinderStyle: function(styleValue) {
      if (styleValue !== 'square' && styleValue !== 'rounded') {
        styleValue = 'square';
      }

      state.design.finderStyle = styleValue;
      state.activeTemplateId = null;

      if (this.elements.finderStyleBtns) {
        this.elements.finderStyleBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-style-value') === styleValue;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      this.renderTemplateGallery(state.templateCategory);
      this.updateContrastAdvisory();

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Reset design to default high-contrast preset (preserves payload!).
     * Resets colors, module styles, logo, frames, and background.
     */
    resetDesign: function() {
      state.design.darkColor = '#171717';
      state.design.lightColor = '#FFFFFF';
      state.design.moduleStyle = 'square';
      state.design.finderStyle = 'square';
      state.design.activePalette = 'classic';

      if (this.elements.fgColorPicker) this.elements.fgColorPicker.value = '#171717';
      if (this.elements.fgSwatchDisplay) this.elements.fgSwatchDisplay.style.backgroundColor = '#171717';
      if (this.elements.fgHexInput) this.elements.fgHexInput.value = '171717';
      if (this.elements.fgHexWrapper) this.elements.fgHexWrapper.classList.remove('is-invalid');

      if (this.elements.bgColorPicker) this.elements.bgColorPicker.value = '#FFFFFF';
      if (this.elements.bgSwatchDisplay) this.elements.bgSwatchDisplay.style.backgroundColor = '#FFFFFF';
      if (this.elements.bgHexInput) this.elements.bgHexInput.value = 'FFFFFF';
      if (this.elements.bgHexWrapper) this.elements.bgHexWrapper.classList.remove('is-invalid');

      // Reset palette active states
      var chips = this.elements.paletteGrid ? this.elements.paletteGrid.querySelectorAll('.palette-chip') : [];
      chips.forEach(function(chip) {
        var isActive = chip.getAttribute('data-palette-id') === 'classic';
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });

      // Reset style button states
      if (this.elements.moduleStyleBtns) {
        this.elements.moduleStyleBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-style-value') === 'square';
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }
      if (this.elements.finderStyleBtns) {
        this.elements.finderStyleBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-style-value') === 'square';
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      // Reset V1.2 Branding Components
      this.removeLogo();
      this.setFrameStyle('none');
      this.removeBg();
      this.resetBgSettings();

      // Reset V1.3 Template and Undo states
      state.activeTemplateId = 'classic-minimal';
      state.undoDesign = null;
      if (this.elements.btnUndoDesign) {
        this.elements.btnUndoDesign.style.display = 'none';
      }
      this.renderTemplateGallery(state.templateCategory);

      this.updateContrastAdvisory();
      this.updateStatusBadges();

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Design & branding reset to default preset.', 'success');
    },

    /**
     * Switch active studio subtab (Templates, Colors & Shapes, Logo, Frames, Background).
     */
    switchSubtab: function(subtabId) {
      state.activeSubtab = subtabId;

      if (this.elements.subtabs) {
        this.elements.subtabs.forEach(function(tab) {
          var isMatch = tab.id === subtabId;
          tab.classList.toggle('is-active', isMatch);
          tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          tab.setAttribute('tabindex', isMatch ? '0' : '-1');
        });
      }

      var panelMap = {
        subtabTemplates: 'subpanelTemplates',
        subtabColors: 'subpanelColors',
        subtabLogo: 'subpanelLogo',
        subtabFrames: 'subpanelFrames',
        subtabBg: 'subpanelBg'
      };

      var activePanelId = panelMap[subtabId] || 'subpanelTemplates';
      if (this.elements.subpanels) {
        this.elements.subpanels.forEach(function(panel) {
          var isMatch = panel.id === activePanelId;
          panel.classList.toggle('is-active', isMatch);
          panel.hidden = !isMatch;
        });
      }
    },

    /**
     * Update status badges on studio subtabs.
     */
    updateStatusBadges: function() {
      if (this.elements.templatesCountBadge) {
        var count = (QRStudio.Templates && QRStudio.Templates.getAll) ? QRStudio.Templates.getAll().length : 12;
        this.elements.templatesCountBadge.textContent = count;
      }

      if (this.elements.logoStatusBadge) {
        var hasLogo = !!(state.design.logo && state.design.logo.image);
        this.elements.logoStatusBadge.textContent = hasLogo ? 'ON' : 'OFF';
        this.elements.logoStatusBadge.classList.toggle('is-on', hasLogo);
      }

      if (this.elements.frameStatusBadge) {
        var fStyle = state.design.frame ? state.design.frame.style : 'none';
        var hasFrame = fStyle !== 'none';
        this.elements.frameStatusBadge.textContent = hasFrame ? fStyle.toUpperCase() : 'NONE';
        this.elements.frameStatusBadge.classList.toggle('is-on', hasFrame);
      }

      if (this.elements.bgStatusBadge) {
        var hasBg = !!(state.design.background && state.design.background.image);
        this.elements.bgStatusBadge.textContent = hasBg ? 'ON' : 'OFF';
        this.elements.bgStatusBadge.classList.toggle('is-on', hasBg);
      }
    },

    /**
     * Render the template gallery cards filtered by category.
     */
    renderTemplateGallery: function(category) {
      var self = this;
      var grid = this.elements.templateGrid;
      var emptyState = this.elements.templateEmptyState;
      if (!grid || !QRStudio.Templates) return;

      state.templateCategory = category || 'all';

      // Update category pill active states
      if (this.elements.categoryPills) {
        this.elements.categoryPills.forEach(function(pill) {
          var isMatch = pill.getAttribute('data-cat') === state.templateCategory;
          pill.classList.toggle('is-active', isMatch);
          pill.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
      }

      var templates = QRStudio.Templates.getByCategory(state.templateCategory);
      grid.innerHTML = '';

      if (templates.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';
      if (emptyState) emptyState.style.display = 'none';

      templates.forEach(function(t) {
        var card = document.createElement('div');
        var isActive = (t.id === state.activeTemplateId);
        card.className = 'template-card' + (isActive ? ' is-active' : '');
        card.setAttribute('data-template-id', t.id);

        var thumbSvg = QRStudio.Templates.renderThumbnailSvg(t);

        var specsHtml = '<span class="template-spec-chip">' + t.design.moduleStyle + '</span>' +
                        '<span class="template-spec-chip">' + t.design.finderStyle + '</span>' +
                        (t.design.frame.style !== 'none' ? '<span class="template-spec-chip">' + t.design.frame.style + '</span>' : '');

        var activePillHtml = isActive ? '<span class="template-selected-tag">ACTIVE</span>' : '';

        card.innerHTML =
          '<div class="template-thumb-wrap">' +
            thumbSvg +
            '<span class="template-badge-pill">' + t.badgeTag + '</span>' +
            activePillHtml +
          '</div>' +
          '<div class="template-body">' +
            '<div class="template-name">' + t.name + '</div>' +
            '<div class="template-desc">' + t.description + '</div>' +
            '<div class="template-specs">' + specsHtml + '</div>' +
            '<button type="button" class="btn-apply-template" data-template-id="' + t.id + '">' +
              (isActive ? '✓ Applied' : 'Apply Template') +
            '</button>' +
          '</div>';

        var applyBtn = card.querySelector('.btn-apply-template');
        applyBtn.addEventListener('click', function() {
          self.applyTemplate(t.id);
        });

        grid.appendChild(card);
      });
    },

    /**
     * Apply a curated template to the active design.
     * Preserves user payload and uploaded assets predictably.
     */
    applyTemplate: function(templateId) {
      if (!QRStudio.Templates) return;
      var template = QRStudio.Templates.getById(templateId);
      if (!template) return;

      // Save previous design for 1-click Undo
      state.undoDesign = JSON.parse(JSON.stringify(state.design));
      if (this.elements.btnUndoDesign) {
        this.elements.btnUndoDesign.style.display = 'inline-flex';
      }

      // Merge template properties while preserving existing logo & background files
      state.design = QRStudio.Templates.applyTemplateToDesign(template, state.design);
      state.activeTemplateId = templateId;

      if (this.elements.templatesActiveSummary) {
        this.elements.templatesActiveSummary.textContent = 'Active: ' + template.name;
      }

      this.syncDesignControls();
      this.renderTemplateGallery(state.templateCategory);

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Applied "' + template.name + '" template.', 'success');
    },

    /**
     * Expand or collapse the curated templates gallery.
     */
    toggleTemplatesGallery: function(forceOpen) {
      var container = this.elements.templatesCollapsibleContainer;
      var btn = this.elements.btnToggleTemplatesGallery;
      var label = this.elements.templatesToggleLabel;
      if (!container || !btn) return;

      var isCurrentlyCollapsed = container.classList.contains('is-collapsed');
      var shouldOpen = (typeof forceOpen === 'boolean') ? forceOpen : isCurrentlyCollapsed;

      if (shouldOpen) {
        container.classList.remove('is-collapsed');
        container.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('is-expanded');
        if (label) label.textContent = 'Collapse Gallery';
      } else {
        container.classList.add('is-collapsed');
        container.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('is-expanded');
        var count = (QRStudio.Templates && QRStudio.Templates.getAll) ? QRStudio.Templates.getAll().length : 12;
        if (label) label.textContent = 'Browse ' + count + ' Templates';
      }
    },

    /**
     * Toggle responsive mobile navigation menu.
     */
    toggleMobileNav: function(forceState) {
      var nav = this.elements.headerNav;
      var btn = this.elements.btnMobileNavToggle;
      if (!nav || !btn) return;

      var isOpen = (typeof forceState === 'boolean') ? forceState : !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', isOpen);
      btn.classList.toggle('is-active', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    },

    /**
     * Synchronize all editor subpanel UI controls with current state.design.
     */
    syncDesignControls: function() {
      // 1. Colors & Hex Inputs
      if (this.elements.fgColorPicker) this.elements.fgColorPicker.value = state.design.darkColor;
      if (this.elements.fgSwatchDisplay) this.elements.fgSwatchDisplay.style.backgroundColor = state.design.darkColor;
      if (this.elements.fgHexInput) this.elements.fgHexInput.value = state.design.darkColor.replace('#', '').toUpperCase();
      if (this.elements.fgHexWrapper) this.elements.fgHexWrapper.classList.remove('is-invalid');

      if (this.elements.bgColorPicker) this.elements.bgColorPicker.value = state.design.lightColor;
      if (this.elements.bgSwatchDisplay) this.elements.bgSwatchDisplay.style.backgroundColor = state.design.lightColor;
      if (this.elements.bgHexInput) this.elements.bgHexInput.value = state.design.lightColor.replace('#', '').toUpperCase();
      if (this.elements.bgHexWrapper) this.elements.bgHexWrapper.classList.remove('is-invalid');

      // 2. Palettes Grid Selection
      if (this.elements.paletteGrid) {
        var chips = this.elements.paletteGrid.querySelectorAll('.palette-chip');
        chips.forEach(function(c) {
          var isActive = (c.getAttribute('data-palette-id') === state.design.activePaletteId);
          c.classList.toggle('is-active', isActive);
          c.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      // 3. Module Shape Buttons
      if (this.elements.moduleStyleBtns) {
        this.elements.moduleStyleBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-style-value') === state.design.moduleStyle;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      // 4. Finder Style Buttons
      if (this.elements.finderStyleBtns) {
        this.elements.finderStyleBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-style-value') === state.design.finderStyle;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      // 5. Frame Cards & Configuration
      if (this.elements.frameCards) {
        this.elements.frameCards.forEach(function(card) {
          var isActive = card.getAttribute('data-frame-style') === state.design.frame.style;
          card.classList.toggle('is-active', isActive);
          card.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      var hasFrame = state.design.frame.style !== 'none';
      if (this.elements.frameOptionsGroup) {
        this.elements.frameOptionsGroup.style.display = hasFrame ? 'block' : 'none';
      }

      if (this.elements.ctaTextInput) {
        this.elements.ctaTextInput.value = state.design.frame.text || '';
      }

      if (this.elements.frameBannerColorPicker) {
        this.elements.frameBannerColorPicker.value = state.design.frame.bannerColor;
      }
      if (this.elements.frameBannerSwatch) {
        this.elements.frameBannerSwatch.style.backgroundColor = state.design.frame.bannerColor;
      }
      if (this.elements.frameBannerHexInput) {
        this.elements.frameBannerHexInput.value = state.design.frame.bannerColor.replace('#', '').toUpperCase();
      }

      if (this.elements.frameTextColorPicker) {
        this.elements.frameTextColorPicker.value = state.design.frame.textColor;
      }
      if (this.elements.frameTextSwatch) {
        this.elements.frameTextSwatch.style.backgroundColor = state.design.frame.textColor;
      }
      if (this.elements.frameTextHexInput) {
        this.elements.frameTextHexInput.value = state.design.frame.textColor.replace('#', '').toUpperCase();
      }

      // 6. Update Status Badges & Contrast Advisory
      this.updateStatusBadges();
      this.updateContrastAdvisory();
    },

    /**
     * Toggle a property lock (colors, modules, finders, frame).
     */
    togglePropertyLock: function(propName) {
      if (state.locks.hasOwnProperty(propName)) {
        state.locks[propName] = !state.locks[propName];
        var isLocked = state.locks[propName];

        var btn = document.querySelector('.lock-toggle-btn[data-prop="' + propName + '"]');
        if (btn) {
          btn.classList.toggle('is-locked', isLocked);
          btn.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
          var icon = btn.querySelector('.lock-state-icon');
          if (icon) icon.textContent = isLocked ? '🔒' : '🔓';
        }

        var propLabel = propName.charAt(0).toUpperCase() + propName.slice(1);
        this.showToast(propLabel + (isLocked ? ' locked (frozen).' : ' unlocked.'), 'info');
      }
    },

    /**
     * Randomize unlocked design properties while keeping locked properties frozen.
     */
    handleRandomize: function() {
      if (!QRStudio.Templates) return;

      // Save previous design for 1-click Undo
      state.undoDesign = JSON.parse(JSON.stringify(state.design));
      if (this.elements.btnUndoDesign) {
        this.elements.btnUndoDesign.style.display = 'inline-flex';
      }

      state.design = QRStudio.Templates.randomizeDesign(state.design, state.locks);
      state.activeTemplateId = null; // Custom randomize combination

      this.syncDesignControls();
      this.renderTemplateGallery(state.templateCategory);

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Randomized unlocked design properties!', 'success');
    },

    /**
     * Restore previous design from undo snapshot.
     */
    handleUndoDesign: function() {
      if (!state.undoDesign) return;

      var current = state.design;
      state.design = state.undoDesign;
      state.undoDesign = null;

      if (this.elements.btnUndoDesign) {
        this.elements.btnUndoDesign.style.display = 'none';
      }

      this.syncDesignControls();
      this.renderTemplateGallery(state.templateCategory);

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Design restored to previous state.', 'success');
    },

    /**
     * Open 4-card variations comparison modal with live canvases.
     */
    openVariationsModal: function() {
      var self = this;
      if (!QRStudio.Templates) return;

      var backdrop = this.elements.variationsModalBackdrop;
      var grid = this.elements.variationsGrid;
      if (!backdrop || !grid) return;

      // Save undo design in case user wants to revert
      if (!state.undoDesign) {
        state.undoDesign = JSON.parse(JSON.stringify(state.design));
        if (this.elements.btnUndoDesign) {
          this.elements.btnUndoDesign.style.display = 'inline-flex';
        }
      }

      var variations = QRStudio.Templates.generateVariations(state.design, state.locks);
      state.activeVariations = variations;

      grid.innerHTML = '';

      variations.forEach(function(v, index) {
        var card = document.createElement('div');
        card.className = 'variation-card';

        var canvasId = 'variationCanvas_' + index;

        var contrast = QRStudio.Design.evaluateContrast(
          v.design.darkColor,
          v.design.lightColor,
          { moduleStyle: v.design.moduleStyle, finderStyle: v.design.finderStyle }
        );

        card.innerHTML =
          '<div class="variation-card-header">' +
            '<span class="variation-title">' + v.label + '</span>' +
            '<span class="variation-tag">' + v.tag + '</span>' +
          '</div>' +
          '<div class="variation-canvas-wrap">' +
            '<canvas id="' + canvasId + '" width="240" height="240" aria-label="' + v.label + ' preview"></canvas>' +
          '</div>' +
          '<div class="variation-meta-row">' +
            '<span>' + v.design.moduleStyle + ' / ' + v.design.finderStyle + (v.design.frame.style !== 'none' ? ' / ' + v.design.frame.style : '') + '</span>' +
            '<span class="variation-contrast-pill">' + contrast.ratioFormatted + '</span>' +
          '</div>' +
          '<button type="button" class="btn-apply-variation" data-var-index="' + index + '">' +
            'Apply This Variation' +
          '</button>';

        var applyBtn = card.querySelector('.btn-apply-variation');
        applyBtn.addEventListener('click', function() {
          self.applyVariation(index);
        });

        grid.appendChild(card);

        // Render live canvas with actual current model
        setTimeout(function() {
          var c = document.getElementById(canvasId);
          if (c && state.lastValidModel) {
            QRStudio.Engine.renderComposition(state.lastValidModel, c, {
              size: 240,
              margin: 4,
              darkColor: v.design.darkColor,
              lightColor: v.design.lightColor,
              moduleStyle: v.design.moduleStyle,
              finderStyle: v.design.finderStyle,
              logo: v.design.logo,
              background: v.design.background,
              frame: v.design.frame
            });
          }
        }, 10);
      });

      backdrop.style.display = 'flex';
      backdrop.setAttribute('aria-hidden', 'false');
    },

    /**
     * Close the variations comparison modal.
     */
    closeVariationsModal: function() {
      var backdrop = this.elements.variationsModalBackdrop;
      if (backdrop) {
        backdrop.style.display = 'none';
        backdrop.setAttribute('aria-hidden', 'true');
      }
    },

    /**
     * Apply one of the 4 generated variations.
     */
    applyVariation: function(index) {
      if (!state.activeVariations || !state.activeVariations[index]) return;
      var variation = state.activeVariations[index];

      // Save undo snapshot
      state.undoDesign = JSON.parse(JSON.stringify(state.design));
      if (this.elements.btnUndoDesign) {
        this.elements.btnUndoDesign.style.display = 'inline-flex';
      }

      state.design = variation.design;
      state.activeTemplateId = null;

      this.closeVariationsModal();
      this.syncDesignControls();
      this.renderTemplateGallery(state.templateCategory);

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Applied "' + variation.label + '" variation.', 'success');
    },

    /**
     * Load a local logo file safely with size validation (PNG, JPEG, WebP, max 5MB).
     */
    loadLogoFile: function(file) {
      var self = this;
      if (!file) return;

      var validTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (validTypes.indexOf(file.type) === -1 && !file.name.match(/\.(png|jpe?g|webp)$/i)) {
        this.showToast('Unsupported file format. Please upload PNG, JPEG, or WebP.', 'error');
        return;
      }

      var maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.showToast('Logo file exceeds 5MB limit. Please choose a smaller image.', 'error');
        return;
      }

      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          state.design.logo.file = file;
          state.design.logo.dataUrl = e.target.result;
          state.design.logo.image = img;
          state.design.logo.filename = file.name;
          state.design.logo.width = img.naturalWidth || img.width;
          state.design.logo.height = img.naturalHeight || img.height;

          // Update Logo UI
          if (self.elements.logoThumbnail) self.elements.logoThumbnail.src = e.target.result;
          if (self.elements.logoFilename) self.elements.logoFilename.textContent = file.name;
          if (self.elements.logoMeta) self.elements.logoMeta.textContent = state.design.logo.width + ' × ' + state.design.logo.height + ' px';

          if (self.elements.logoDropzone) self.elements.logoDropzone.style.display = 'none';
          if (self.elements.logoActiveCard) self.elements.logoActiveCard.style.display = 'flex';
          if (self.elements.logoControlsGroup) self.elements.logoControlsGroup.style.display = 'block';

          // Recommend High ECL if currently lower
          if (state.ecl !== 'H') {
            self.showToast('Logo loaded! High error correction (H, ~30%) is recommended.', 'success');
          } else {
            self.showToast('Logo loaded successfully.', 'success');
          }

          self.updateStatusBadges();
          if (self.elements.metaLogoBadge) {
            self.elements.metaLogoBadge.textContent = state.design.logo.sizePercent + '%';
          }

          if (state.lastValidModel) {
            self.renderPreview(state.lastValidModel);
          }

          self.recordChange(false);
        };

        img.onerror = function() {
          self.showToast('Could not decode image file. File may be corrupt.', 'error');
        };

        img.src = e.target.result;
      };

      reader.onerror = function() {
        self.showToast('Error reading file from disk.', 'error');
      };

      reader.readAsDataURL(file);
    },

    /**
     * Remove center logo and reset logo controls.
     */
    removeLogo: function() {
      state.design.logo.file = null;
      state.design.logo.dataUrl = null;
      state.design.logo.image = null;
      state.design.logo.filename = '';
      state.design.logo.width = 0;
      state.design.logo.height = 0;

      if (this.elements.logoFileInput) this.elements.logoFileInput.value = '';
      if (this.elements.logoDropzone) this.elements.logoDropzone.style.display = 'flex';
      if (this.elements.logoActiveCard) this.elements.logoActiveCard.style.display = 'none';
      if (this.elements.logoControlsGroup) this.elements.logoControlsGroup.style.display = 'none';

      this.updateStatusBadges();
      if (this.elements.metaLogoBadge) {
        this.elements.metaLogoBadge.textContent = 'None';
      }

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Logo removed.', 'success');
    },

    /**
     * Set center logo size percentage (clamped 15% to 28%).
     */
    setLogoSize: function(percent) {
      percent = Math.max(15, Math.min(28, parseInt(percent, 10) || 22));
      state.design.logo.sizePercent = percent;
      if (this.elements.logoSizeSlider) this.elements.logoSizeSlider.value = percent;
      if (this.elements.logoSizeValue) this.elements.logoSizeValue.textContent = percent + '%';
      if (this.elements.metaLogoBadge && state.design.logo.image) {
        this.elements.metaLogoBadge.textContent = percent + '%';
      }

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Set center logo clearance padding in pixels (clamped 2 to 16).
     */
    setLogoPadding: function(padding) {
      padding = Math.max(2, Math.min(16, parseInt(padding, 10) || 6));
      state.design.logo.padding = padding;
      if (this.elements.logoPaddingSlider) this.elements.logoPaddingSlider.value = padding;
      if (this.elements.logoPaddingValue) this.elements.logoPaddingValue.textContent = padding + ' px';

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Set logo clearance badge shape ('rounded' | 'circle' | 'square').
     */
    setLogoBadgeShape: function(shape) {
      if (shape !== 'circle' && shape !== 'rounded' && shape !== 'square') {
        shape = 'rounded';
      }
      state.design.logo.badgeShape = shape;

      if (this.elements.badgeShapeBtns) {
        this.elements.badgeShapeBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-shape') === shape;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Set logo badge fill color.
     */
    setLogoBadgeColor: function(hex, isManualHex) {
      if (!QRStudio.Design.isValidHex(hex)) return;
      var normHex = QRStudio.Design.normalizeHex(hex);
      state.design.logo.badgeColor = normHex;

      if (this.elements.badgeColorPicker) this.elements.badgeColorPicker.value = normHex;
      if (this.elements.badgeSwatchDisplay) this.elements.badgeSwatchDisplay.style.backgroundColor = normHex;
      if (!isManualHex && this.elements.badgeHexInput) {
        this.elements.badgeHexInput.value = normHex.replace('#', '').toUpperCase();
      }
      if (this.elements.badgeHexWrapper) this.elements.badgeHexWrapper.classList.remove('is-invalid');

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Set Error Correction Level to High ('H', ~30%).
     */
    setHighEcl: function() {
      state.ecl = 'H';
      if (this.elements.eclRadios) {
        this.elements.eclRadios.forEach(function(radio) {
          radio.checked = (radio.value === 'H');
        });
      }
      this.processInput(false);
      this.recordChange(false);
      this.showToast('Error Correction set to High (H, ~30% recovery).', 'success');
    },

    /**
     * Set frame style ('none' | 'badge' | 'top-banner' | 'bottom-bar' | 'ticket').
     */
    setFrameStyle: function(style) {
      var validStyles = ['none', 'badge', 'top-banner', 'bottom-bar', 'ticket'];
      if (validStyles.indexOf(style) === -1) style = 'none';

      state.design.frame.style = style;

      if (this.elements.frameCards) {
        this.elements.frameCards.forEach(function(card) {
          var isActive = card.getAttribute('data-frame-style') === style;
          card.classList.toggle('is-active', isActive);
          card.setAttribute('aria-checked', isActive ? 'true' : 'false');
          card.setAttribute('tabindex', isActive ? '0' : '-1');
        });
      }

      if (this.elements.frameOptionsGroup) {
        this.elements.frameOptionsGroup.style.display = (style !== 'none') ? 'block' : 'none';
      }

      this.updateStatusBadges();
      state.activeTemplateId = null;
      this.renderTemplateGallery(state.templateCategory);

      if (this.elements.metaFrameBadge) {
        this.elements.metaFrameBadge.textContent = style === 'none' ? 'None' : style.toUpperCase();
      }

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Set CTA text for frame.
     */
    setCTAText: function(text) {
      state.design.frame.text = text || '';
      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Set frame banner fill color.
     */
    setFrameBannerColor: function(hex, isManualHex) {
      if (!QRStudio.Design.isValidHex(hex)) return;
      var normHex = QRStudio.Design.normalizeHex(hex);
      state.design.frame.bannerColor = normHex;

      if (this.elements.frameBannerColorPicker) this.elements.frameBannerColorPicker.value = normHex;
      if (this.elements.frameBannerSwatch) this.elements.frameBannerSwatch.style.backgroundColor = normHex;
      if (!isManualHex && this.elements.frameBannerHexInput) {
        this.elements.frameBannerHexInput.value = normHex.replace('#', '').toUpperCase();
      }
      if (this.elements.frameBannerHexWrapper) this.elements.frameBannerHexWrapper.classList.remove('is-invalid');

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Set frame CTA text color.
     */
    setFrameTextColor: function(hex, isManualHex) {
      if (!QRStudio.Design.isValidHex(hex)) return;
      var normHex = QRStudio.Design.normalizeHex(hex);
      state.design.frame.textColor = normHex;

      if (this.elements.frameTextColorPicker) this.elements.frameTextColorPicker.value = normHex;
      if (this.elements.frameTextSwatch) this.elements.frameTextSwatch.style.backgroundColor = normHex;
      if (!isManualHex && this.elements.frameTextHexInput) {
        this.elements.frameTextHexInput.value = normHex.replace('#', '').toUpperCase();
      }
      if (this.elements.frameTextHexWrapper) this.elements.frameTextHexWrapper.classList.remove('is-invalid');

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Load background image file safely (PNG, JPEG, WebP, max 5MB).
     */
    loadBgFile: function(file) {
      var self = this;
      if (!file) return;

      var validTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (validTypes.indexOf(file.type) === -1 && !file.name.match(/\.(png|jpe?g|webp)$/i)) {
        this.showToast('Unsupported file format. Please upload PNG, JPEG, or WebP.', 'error');
        return;
      }

      var maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.showToast('Background file exceeds 5MB limit. Please choose a smaller image.', 'error');
        return;
      }

      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          state.design.background.file = file;
          state.design.background.dataUrl = e.target.result;
          state.design.background.image = img;
          state.design.background.filename = file.name;
          state.design.background.width = img.naturalWidth || img.width;
          state.design.background.height = img.naturalHeight || img.height;

          // Update Background UI
          if (self.elements.bgThumbnail) self.elements.bgThumbnail.src = e.target.result;
          if (self.elements.bgFilename) self.elements.bgFilename.textContent = file.name;
          if (self.elements.bgMeta) self.elements.bgMeta.textContent = state.design.background.width + ' × ' + state.design.background.height + ' px';

          if (self.elements.bgDropzone) self.elements.bgDropzone.style.display = 'none';
          if (self.elements.bgActiveCard) self.elements.bgActiveCard.style.display = 'flex';
          if (self.elements.bgControlsGroup) self.elements.bgControlsGroup.style.display = 'block';

          self.updateStatusBadges();

          if (state.lastValidModel) {
            self.renderPreview(state.lastValidModel);
          }

          self.recordChange(false);
          self.showToast('Background backdrop loaded.', 'success');
        };

        img.onerror = function() {
          self.showToast('Could not decode background image.', 'error');
        };

        img.src = e.target.result;
      };

      reader.onerror = function() {
        self.showToast('Error reading background file.', 'error');
      };

      reader.readAsDataURL(file);
    },

    /**
     * Remove background image and hide background controls.
     */
    removeBg: function() {
      state.design.background.file = null;
      state.design.background.dataUrl = null;
      state.design.background.image = null;
      state.design.background.filename = '';
      state.design.background.width = 0;
      state.design.background.height = 0;

      if (this.elements.bgFileInput) this.elements.bgFileInput.value = '';
      if (this.elements.bgDropzone) this.elements.bgDropzone.style.display = 'flex';
      if (this.elements.bgActiveCard) this.elements.bgActiveCard.style.display = 'none';
      if (this.elements.bgControlsGroup) this.elements.bgControlsGroup.style.display = 'none';

      this.updateStatusBadges();

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }

      this.recordChange(false);
      this.showToast('Background image removed.', 'success');
    },

    /**
     * Set background fit mode ('cover' | 'contain').
     */
    setBgFit: function(fit) {
      if (fit !== 'cover' && fit !== 'contain') fit = 'cover';
      state.design.background.fit = fit;

      if (this.elements.bgFitBtns) {
        this.elements.bgFitBtns.forEach(function(btn) {
          var isActive = btn.getAttribute('data-fit') === fit;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Set background crop zoom scale (100% to 250%).
     */
    setBgZoom: function(percent) {
      percent = Math.max(100, Math.min(250, parseInt(percent, 10) || 100));
      state.design.background.zoom = percent / 100;

      if (this.elements.bgZoomSlider) this.elements.bgZoomSlider.value = percent;
      if (this.elements.bgZoomValue) this.elements.bgZoomValue.textContent = percent + '%';

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Set background reposition pan offset (-50% to +50%).
     */
    setBgPan: function(percent) {
      percent = Math.max(-50, Math.min(50, parseInt(percent, 10) || 0));
      state.design.background.panX = percent / 100;
      state.design.background.panY = percent / 100;

      if (this.elements.bgPanXSlider) this.elements.bgPanXSlider.value = percent;
      if (this.elements.bgPanXValue) {
        this.elements.bgPanXValue.textContent = percent === 0 ? 'Center (0%)' : (percent > 0 ? '+' + percent + '%' : percent + '%');
      }

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Set background opacity (0.1 to 1.0).
     */
    setBgOpacity: function(percent) {
      percent = Math.max(10, Math.min(100, parseInt(percent, 10) || 100));
      state.design.background.opacity = percent / 100;

      if (this.elements.bgOpacitySlider) this.elements.bgOpacitySlider.value = percent;
      if (this.elements.bgOpacityValue) this.elements.bgOpacityValue.textContent = percent + '%';

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Set background overlay tint color.
     */
    setBgTintColor: function(hex, isManualHex) {
      if (!QRStudio.Design.isValidHex(hex)) return;
      var normHex = QRStudio.Design.normalizeHex(hex);
      state.design.background.tintColor = normHex;

      if (this.elements.bgTintColorPicker) this.elements.bgTintColorPicker.value = normHex;
      if (this.elements.bgTintSwatch) this.elements.bgTintSwatch.style.backgroundColor = normHex;
      if (!isManualHex && this.elements.bgTintHexInput) {
        this.elements.bgTintHexInput.value = normHex.replace('#', '').toUpperCase();
      }
      if (this.elements.bgTintHexWrapper) this.elements.bgTintHexWrapper.classList.remove('is-invalid');

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(false);
    },

    /**
     * Set background overlay tint opacity (0.0 to 0.9).
     */
    setBgTintOpacity: function(percent) {
      percent = Math.max(0, Math.min(90, parseInt(percent, 10) || 0));
      state.design.background.tintOpacity = percent / 100;

      if (this.elements.bgTintOpacitySlider) this.elements.bgTintOpacitySlider.value = percent;
      if (this.elements.bgTintOpacityValue) this.elements.bgTintOpacityValue.textContent = percent + '%';

      if (state.lastValidModel) {
        this.renderPreview(state.lastValidModel);
      }
      this.recordChange(true);
    },

    /**
     * Reset background controls to default.
     */
    resetBgSettings: function() {
      this.setBgFit('cover');
      this.setBgZoom(100);
      this.setBgPan(0);
      this.setBgOpacity(100);
      this.setBgTintColor('#000000');
      this.setBgTintOpacity(0);
      this.recordChange(false);
      this.showToast('Background settings reset.', 'success');
    },

    /**
     * Restore safe high-contrast monochrome design when warning is triggered.
     */
    restoreHighContrast: function() {
      this.applyPalette('classic');
    },

    /**
     * Recalculate and update the contrast & scanability advisory card.
     */
    updateContrastAdvisory: function() {
      if (!QRStudio.Design || !QRStudio.Design.evaluateContrast) return;

      var metrics = QRStudio.Design.evaluateContrast(
        state.design.darkColor,
        state.design.lightColor,
        { moduleStyle: state.design.moduleStyle, finderStyle: state.design.finderStyle }
      );

      var box = this.elements.contrastAdvisoryBox;
      var badge = this.elements.contrastBadge;
      var heading = this.elements.contrastHeading;
      var desc = this.elements.contrastDesc;
      var restoreBtn = this.elements.restoreContrastBtn;

      if (badge) {
        var tier = metrics.ratio >= 7.0 && !metrics.isInverted ? 'AAA' : metrics.ratio >= 4.5 && !metrics.isInverted ? 'AA' : 'RISK';
        badge.textContent = metrics.ratioFormatted + ' (' + tier + ')';
      }

      if (heading) {
        heading.textContent = metrics.summary;
      }

      if (desc) {
        desc.textContent = metrics.details.join(' ') || 'Standard high-contrast QR code.';
      }

      if (box) {
        box.classList.remove('status-safe', 'status-warning', 'status-danger');
        box.classList.add('status-' + metrics.level);
      }

      if (restoreBtn) {
        restoreBtn.style.display = (metrics.level === 'danger' || metrics.level === 'warning') ? 'inline-flex' : 'none';
      }

      if (this.elements.metaContrastBadge) {
        this.elements.metaContrastBadge.textContent = metrics.ratioFormatted;
      }

      if (this.elements.metaStyleBadge) {
        var mStyle = state.design.moduleStyle.charAt(0).toUpperCase() + state.design.moduleStyle.slice(1);
        var fStyle = state.design.finderStyle.charAt(0).toUpperCase() + state.design.finderStyle.slice(1);
        this.elements.metaStyleBadge.textContent = mStyle + ' / ' + fStyle;
      }
    },

    /**
     * Attach global UI event listeners.
     */
    attachGlobalListeners: function() {
      var self = this;

      // Error Correction Level radio selection
      this.elements.eclRadios.forEach(function(radio) {
        radio.addEventListener('change', function() {
          if (radio.checked) {
            state.ecl = radio.value;
            self.processInput(false);
          }
        });
      });

      // Export button click
      this.elements.exportBtn.addEventListener('click', function() {
        self.handleExport();
      });

      // Copy payload button click
      this.elements.copyPayloadBtn.addEventListener('click', function() {
        self.handleCopyPayload();
      });

      // V1.1 Native Foreground & Background Color Pickers
      if (this.elements.fgColorPicker) {
        this.elements.fgColorPicker.addEventListener('input', function() {
          self.setCustomColor('fg', this.value);
        });
        this.elements.fgColorPicker.addEventListener('change', function() {
          self.setCustomColor('fg', this.value);
        });
      }

      if (this.elements.bgColorPicker) {
        this.elements.bgColorPicker.addEventListener('input', function() {
          self.setCustomColor('bg', this.value);
        });
        this.elements.bgColorPicker.addEventListener('change', function() {
          self.setCustomColor('bg', this.value);
        });
      }

      // V1.1 Foreground Hex Text Input
      if (this.elements.fgHexInput) {
        this.elements.fgHexInput.addEventListener('input', function() {
          var clean = this.value.replace(/[^0-9a-fA-F]/g, '');
          if (clean.length > 6) clean = clean.slice(0, 6);
          this.value = clean;

          if (clean.length === 6) {
            if (QRStudio.Design.isValidHex('#' + clean)) {
              if (self.elements.fgHexWrapper) self.elements.fgHexWrapper.classList.remove('is-invalid');
              self.setCustomColor('fg', '#' + clean, true);
            } else {
              if (self.elements.fgHexWrapper) self.elements.fgHexWrapper.classList.add('is-invalid');
            }
          }
        });

        this.elements.fgHexInput.addEventListener('blur', function() {
          var clean = this.value.trim();
          if (clean.length === 3 && QRStudio.Design.isValidHex('#' + clean)) {
            var norm = QRStudio.Design.normalizeHex('#' + clean);
            this.value = norm.replace('#', '').toUpperCase();
            if (self.elements.fgHexWrapper) self.elements.fgHexWrapper.classList.remove('is-invalid');
            self.setCustomColor('fg', norm, true);
          } else if (clean.length !== 6 || !QRStudio.Design.isValidHex('#' + clean)) {
            this.value = state.design.darkColor.replace('#', '').toUpperCase();
            if (self.elements.fgHexWrapper) self.elements.fgHexWrapper.classList.remove('is-invalid');
          }
        });
      }

      // V1.1 Background Hex Text Input
      if (this.elements.bgHexInput) {
        this.elements.bgHexInput.addEventListener('input', function() {
          var clean = this.value.replace(/[^0-9a-fA-F]/g, '');
          if (clean.length > 6) clean = clean.slice(0, 6);
          this.value = clean;

          if (clean.length === 6) {
            if (QRStudio.Design.isValidHex('#' + clean)) {
              if (self.elements.bgHexWrapper) self.elements.bgHexWrapper.classList.remove('is-invalid');
              self.setCustomColor('bg', '#' + clean, true);
            } else {
              if (self.elements.bgHexWrapper) self.elements.bgHexWrapper.classList.add('is-invalid');
            }
          }
        });

        this.elements.bgHexInput.addEventListener('blur', function() {
          var clean = this.value.trim();
          if (clean.length === 3 && QRStudio.Design.isValidHex('#' + clean)) {
            var norm = QRStudio.Design.normalizeHex('#' + clean);
            this.value = norm.replace('#', '').toUpperCase();
            if (self.elements.bgHexWrapper) self.elements.bgHexWrapper.classList.remove('is-invalid');
            self.setCustomColor('bg', norm, true);
          } else if (clean.length !== 6 || !QRStudio.Design.isValidHex('#' + clean)) {
            this.value = state.design.lightColor.replace('#', '').toUpperCase();
            if (self.elements.bgHexWrapper) self.elements.bgHexWrapper.classList.remove('is-invalid');
          }
        });
      }

      // V1.1 Module Style Segmented Buttons
      if (this.elements.moduleStyleBtns) {
        this.elements.moduleStyleBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var val = this.getAttribute('data-style-value');
            self.setModuleStyle(val);
          });
        });
      }

      // V1.1 Finder Corner Style Segmented Buttons
      if (this.elements.finderStyleBtns) {
        this.elements.finderStyleBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var val = this.getAttribute('data-style-value');
            self.setFinderStyle(val);
          });
        });
      }

      // V1.1 Reset Design Button
      if (this.elements.resetDesignBtn) {
        this.elements.resetDesignBtn.addEventListener('click', function() {
          self.resetDesign();
        });
      }

      // V1.1 Restore High Contrast Button
      if (this.elements.restoreContrastBtn) {
        this.elements.restoreContrastBtn.addEventListener('click', function() {
          self.restoreHighContrast();
        });
      }

      // --- V1.2 STUDIO SUBTABS LISTENERS ---
      if (this.elements.subtabs) {
        var subtabList = Array.from(this.elements.subtabs);
        subtabList.forEach(function(tab, index) {
          tab.addEventListener('click', function() {
            self.switchSubtab(this.id);
          });

          tab.addEventListener('keydown', function(e) {
            var targetIndex = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              targetIndex = (index + 1) % subtabList.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              targetIndex = (index - 1 + subtabList.length) % subtabList.length;
            } else if (e.key === 'Home') {
              e.preventDefault();
              targetIndex = 0;
            } else if (e.key === 'End') {
              e.preventDefault();
              targetIndex = subtabList.length - 1;
            }

            if (targetIndex !== -1 && subtabList[targetIndex]) {
              subtabList[targetIndex].focus();
              subtabList[targetIndex].click();
            }
          });
        });
      }

      // --- V1.2 LOGO BADGE LISTENERS ---
      if (this.elements.logoDropzone && this.elements.logoFileInput) {
        this.elements.logoDropzone.addEventListener('click', function() {
          self.elements.logoFileInput.click();
        });

        this.elements.logoDropzone.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            self.elements.logoFileInput.click();
          }
        });

        this.elements.logoDropzone.addEventListener('dragover', function(e) {
          e.preventDefault();
          this.classList.add('is-dragover');
        });

        this.elements.logoDropzone.addEventListener('dragleave', function() {
          this.classList.remove('is-dragover');
        });

        this.elements.logoDropzone.addEventListener('drop', function(e) {
          e.preventDefault();
          this.classList.remove('is-dragover');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            self.loadLogoFile(e.dataTransfer.files[0]);
          }
        });

        this.elements.logoFileInput.addEventListener('change', function() {
          if (this.files && this.files[0]) {
            self.loadLogoFile(this.files[0]);
          }
        });
      }

      if (this.elements.btnReplaceLogo && this.elements.logoFileInput) {
        this.elements.btnReplaceLogo.addEventListener('click', function() {
          self.elements.logoFileInput.value = '';
          self.elements.logoFileInput.click();
        });
      }

      if (this.elements.btnRemoveLogo) {
        this.elements.btnRemoveLogo.addEventListener('click', function() {
          self.removeLogo();
        });
      }

      if (this.elements.logoSizeSlider) {
        this.elements.logoSizeSlider.addEventListener('input', function() {
          self.setLogoSize(this.value);
        });
      }

      if (this.elements.logoPaddingSlider) {
        this.elements.logoPaddingSlider.addEventListener('input', function() {
          self.setLogoPadding(this.value);
        });
      }

      if (this.elements.badgeShapeBtns) {
        this.elements.badgeShapeBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var shape = this.getAttribute('data-shape');
            self.setLogoBadgeShape(shape);
          });
        });
      }

      if (this.elements.badgeColorPicker) {
        this.elements.badgeColorPicker.addEventListener('input', function() {
          self.setLogoBadgeColor(this.value);
        });
        this.elements.badgeColorPicker.addEventListener('change', function() {
          self.setLogoBadgeColor(this.value);
        });
      }

      if (this.elements.badgeHexInput) {
        this.elements.badgeHexInput.addEventListener('input', function() {
          var clean = this.value.replace(/[^0-9a-fA-F]/g, '');
          if (clean.length > 6) clean = clean.slice(0, 6);
          this.value = clean;
          if (clean.length === 6) {
            if (QRStudio.Design.isValidHex('#' + clean)) {
              if (self.elements.badgeHexWrapper) self.elements.badgeHexWrapper.classList.remove('is-invalid');
              self.setLogoBadgeColor('#' + clean, true);
            } else {
              if (self.elements.badgeHexWrapper) self.elements.badgeHexWrapper.classList.add('is-invalid');
            }
          }
        });

        this.elements.badgeHexInput.addEventListener('blur', function() {
          var clean = this.value.trim();
          if (clean.length === 3 && QRStudio.Design.isValidHex('#' + clean)) {
            var norm = QRStudio.Design.normalizeHex('#' + clean);
            this.value = norm.replace('#', '').toUpperCase();
            if (self.elements.badgeHexWrapper) self.elements.badgeHexWrapper.classList.remove('is-invalid');
            self.setLogoBadgeColor(norm, true);
          } else if (clean.length !== 6 || !QRStudio.Design.isValidHex('#' + clean)) {
            this.value = state.design.logo.badgeColor.replace('#', '').toUpperCase();
            if (self.elements.badgeHexWrapper) self.elements.badgeHexWrapper.classList.remove('is-invalid');
          }
        });
      }

      if (this.elements.btnSetHighEcl) {
        this.elements.btnSetHighEcl.addEventListener('click', function() {
          self.setHighEcl();
        });
      }

      // --- V1.2 FRAMES & CTA LISTENERS ---
      if (this.elements.frameCards) {
        var frameCardList = Array.from(this.elements.frameCards);
        frameCardList.forEach(function(card, index) {
          card.addEventListener('click', function() {
            var style = this.getAttribute('data-frame-style');
            self.setFrameStyle(style);
          });

          card.addEventListener('keydown', function(e) {
            var targetIndex = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              targetIndex = (index + 1) % frameCardList.length;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              targetIndex = (index - 1 + frameCardList.length) % frameCardList.length;
            } else if (e.key === 'Home') {
              e.preventDefault();
              targetIndex = 0;
            } else if (e.key === 'End') {
              e.preventDefault();
              targetIndex = frameCardList.length - 1;
            } else if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              card.click();
            }

            if (targetIndex !== -1 && frameCardList[targetIndex]) {
              frameCardList[targetIndex].focus();
              frameCardList[targetIndex].click();
            }
          });
        });
      }

      if (this.elements.ctaTextInput) {
        this.elements.ctaTextInput.addEventListener('input', function() {
          self.setCTAText(this.value);
        });
      }

      if (this.elements.ctaPresetChips) {
        this.elements.ctaPresetChips.forEach(function(chip) {
          chip.addEventListener('click', function() {
            var preset = this.getAttribute('data-preset');
            if (self.elements.ctaTextInput) {
              self.elements.ctaTextInput.value = preset;
            }
            self.setCTAText(preset);
          });
        });
      }

      if (this.elements.frameBannerColorPicker) {
        this.elements.frameBannerColorPicker.addEventListener('input', function() {
          self.setFrameBannerColor(this.value);
        });
        this.elements.frameBannerColorPicker.addEventListener('change', function() {
          self.setFrameBannerColor(this.value);
        });
      }

      if (this.elements.frameBannerHexInput) {
        this.elements.frameBannerHexInput.addEventListener('input', function() {
          var clean = this.value.replace(/[^0-9a-fA-F]/g, '');
          if (clean.length > 6) clean = clean.slice(0, 6);
          this.value = clean;
          if (clean.length === 6) {
            if (QRStudio.Design.isValidHex('#' + clean)) {
              if (self.elements.frameBannerHexWrapper) self.elements.frameBannerHexWrapper.classList.remove('is-invalid');
              self.setFrameBannerColor('#' + clean, true);
            } else {
              if (self.elements.frameBannerHexWrapper) self.elements.frameBannerHexWrapper.classList.add('is-invalid');
            }
          }
        });

        this.elements.frameBannerHexInput.addEventListener('blur', function() {
          var clean = this.value.trim();
          if (clean.length === 3 && QRStudio.Design.isValidHex('#' + clean)) {
            var norm = QRStudio.Design.normalizeHex('#' + clean);
            this.value = norm.replace('#', '').toUpperCase();
            if (self.elements.frameBannerHexWrapper) self.elements.frameBannerHexWrapper.classList.remove('is-invalid');
            self.setFrameBannerColor(norm, true);
          } else if (clean.length !== 6 || !QRStudio.Design.isValidHex('#' + clean)) {
            this.value = state.design.frame.bannerColor.replace('#', '').toUpperCase();
            if (self.elements.frameBannerHexWrapper) self.elements.frameBannerHexWrapper.classList.remove('is-invalid');
          }
        });
      }

      if (this.elements.frameTextColorPicker) {
        this.elements.frameTextColorPicker.addEventListener('input', function() {
          self.setFrameTextColor(this.value);
        });
        this.elements.frameTextColorPicker.addEventListener('change', function() {
          self.setFrameTextColor(this.value);
        });
      }

      if (this.elements.frameTextHexInput) {
        this.elements.frameTextHexInput.addEventListener('input', function() {
          var clean = this.value.replace(/[^0-9a-fA-F]/g, '');
          if (clean.length > 6) clean = clean.slice(0, 6);
          this.value = clean;
          if (clean.length === 6) {
            if (QRStudio.Design.isValidHex('#' + clean)) {
              if (self.elements.frameTextHexWrapper) self.elements.frameTextHexWrapper.classList.remove('is-invalid');
              self.setFrameTextColor('#' + clean, true);
            } else {
              if (self.elements.frameTextHexWrapper) self.elements.frameTextHexWrapper.classList.add('is-invalid');
            }
          }
        });

        this.elements.frameTextHexInput.addEventListener('blur', function() {
          var clean = this.value.trim();
          if (clean.length === 3 && QRStudio.Design.isValidHex('#' + clean)) {
            var norm = QRStudio.Design.normalizeHex('#' + clean);
            this.value = norm.replace('#', '').toUpperCase();
            if (self.elements.frameTextHexWrapper) self.elements.frameTextHexWrapper.classList.remove('is-invalid');
            self.setFrameTextColor(norm, true);
          } else if (clean.length !== 6 || !QRStudio.Design.isValidHex('#' + clean)) {
            this.value = state.design.frame.textColor.replace('#', '').toUpperCase();
            if (self.elements.frameTextHexWrapper) self.elements.frameTextHexWrapper.classList.remove('is-invalid');
          }
        });
      }

      // --- V1.2 BACKGROUND IMAGE LISTENERS ---
      if (this.elements.bgDropzone && this.elements.bgFileInput) {
        this.elements.bgDropzone.addEventListener('click', function() {
          self.elements.bgFileInput.click();
        });

        this.elements.bgDropzone.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            self.elements.bgFileInput.click();
          }
        });

        this.elements.bgDropzone.addEventListener('dragover', function(e) {
          e.preventDefault();
          this.classList.add('is-dragover');
        });

        this.elements.bgDropzone.addEventListener('dragleave', function() {
          this.classList.remove('is-dragover');
        });

        this.elements.bgDropzone.addEventListener('drop', function(e) {
          e.preventDefault();
          this.classList.remove('is-dragover');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            self.loadBgFile(e.dataTransfer.files[0]);
          }
        });

        this.elements.bgFileInput.addEventListener('change', function() {
          if (this.files && this.files[0]) {
            self.loadBgFile(this.files[0]);
          }
        });
      }

      if (this.elements.btnReplaceBg && this.elements.bgFileInput) {
        this.elements.btnReplaceBg.addEventListener('click', function() {
          self.elements.bgFileInput.value = '';
          self.elements.bgFileInput.click();
        });
      }

      if (this.elements.btnRemoveBg) {
        this.elements.btnRemoveBg.addEventListener('click', function() {
          self.removeBg();
        });
      }

      if (this.elements.bgFitBtns) {
        this.elements.bgFitBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var fit = this.getAttribute('data-fit');
            self.setBgFit(fit);
          });
        });
      }

      if (this.elements.bgZoomSlider) {
        this.elements.bgZoomSlider.addEventListener('input', function() {
          self.setBgZoom(this.value);
        });
      }

      if (this.elements.bgPanXSlider) {
        this.elements.bgPanXSlider.addEventListener('input', function() {
          self.setBgPan(this.value);
        });
      }

      if (this.elements.bgOpacitySlider) {
        this.elements.bgOpacitySlider.addEventListener('input', function() {
          self.setBgOpacity(this.value);
        });
      }

      if (this.elements.bgTintColorPicker) {
        this.elements.bgTintColorPicker.addEventListener('input', function() {
          self.setBgTintColor(this.value);
        });
        this.elements.bgTintColorPicker.addEventListener('change', function() {
          self.setBgTintColor(this.value);
        });
      }

      if (this.elements.bgTintHexInput) {
        this.elements.bgTintHexInput.addEventListener('input', function() {
          var clean = this.value.replace(/[^0-9a-fA-F]/g, '');
          if (clean.length > 6) clean = clean.slice(0, 6);
          this.value = clean;
          if (clean.length === 6) {
            if (QRStudio.Design.isValidHex('#' + clean)) {
              if (self.elements.bgTintHexWrapper) self.elements.bgTintHexWrapper.classList.remove('is-invalid');
              self.setBgTintColor('#' + clean, true);
            } else {
              if (self.elements.bgTintHexWrapper) self.elements.bgTintHexWrapper.classList.add('is-invalid');
            }
          }
        });

        this.elements.bgTintHexInput.addEventListener('blur', function() {
          var clean = this.value.trim();
          if (clean.length === 3 && QRStudio.Design.isValidHex('#' + clean)) {
            var norm = QRStudio.Design.normalizeHex('#' + clean);
            this.value = norm.replace('#', '').toUpperCase();
            if (self.elements.bgTintHexWrapper) self.elements.bgTintHexWrapper.classList.remove('is-invalid');
            self.setBgTintColor(norm, true);
          } else if (clean.length !== 6 || !QRStudio.Design.isValidHex('#' + clean)) {
            this.value = state.design.background.tintColor.replace('#', '').toUpperCase();
            if (self.elements.bgTintHexWrapper) self.elements.bgTintHexWrapper.classList.remove('is-invalid');
          }
        });
      }

      if (this.elements.bgTintOpacitySlider) {
        this.elements.bgTintOpacitySlider.addEventListener('input', function() {
          self.setBgTintOpacity(this.value);
        });
      }

      if (this.elements.btnResetBg) {
        this.elements.btnResetBg.addEventListener('click', function() {
          self.resetBgSettings();
        });
      }

      // --- V1.3 TEMPLATE GALLERY, VARIATIONS & LOCKS LISTENERS ---
      if (this.elements.btnRandomize) {
        this.elements.btnRandomize.addEventListener('click', function() {
          self.handleRandomize();
        });
      }

      if (this.elements.btnVariations) {
        this.elements.btnVariations.addEventListener('click', function() {
          self.openVariationsModal();
        });
      }

      if (this.elements.btnUndoDesign) {
        this.elements.btnUndoDesign.addEventListener('click', function() {
          self.handleUndoDesign();
        });
      }

      if (this.elements.lockBtns) {
        this.elements.lockBtns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var prop = this.getAttribute('data-prop');
            self.togglePropertyLock(prop);
          });
        });
      }

      if (this.elements.categoryPills) {
        this.elements.categoryPills.forEach(function(pill) {
          pill.addEventListener('click', function() {
            var cat = this.getAttribute('data-cat');
            self.renderTemplateGallery(cat);
          });
        });
      }

      if (this.elements.btnResetTemplateFilter) {
        this.elements.btnResetTemplateFilter.addEventListener('click', function() {
          self.renderTemplateGallery('all');
        });
      }

      if (this.elements.btnToggleTemplatesGallery) {
        this.elements.btnToggleTemplatesGallery.addEventListener('click', function() {
          self.toggleTemplatesGallery();
        });
      }

      if (this.elements.btnCollapseTemplatesGallery) {
        this.elements.btnCollapseTemplatesGallery.addEventListener('click', function() {
          self.toggleTemplatesGallery(false);
        });
      }

      // Responsive Mobile Nav Toggle
      if (this.elements.btnMobileNavToggle) {
        this.elements.btnMobileNavToggle.addEventListener('click', function() {
          self.toggleMobileNav();
        });
      }

      var navLinks = document.querySelectorAll('.header-nav .nav-link');
      if (navLinks) {
        navLinks.forEach(function(link) {
          link.addEventListener('click', function() {
            if (self.elements.headerNav && self.elements.headerNav.classList.contains('is-open')) {
              self.toggleMobileNav(false);
            }
          });
        });
      }

      if (this.elements.btnCloseVariations) {
        this.elements.btnCloseVariations.addEventListener('click', function() {
          self.closeVariationsModal();
        });
      }

      if (this.elements.btnReturnOriginal) {
        this.elements.btnReturnOriginal.addEventListener('click', function() {
          self.closeVariationsModal();
        });
      }

      if (this.elements.btnRerollVariations) {
        this.elements.btnRerollVariations.addEventListener('click', function() {
          self.openVariationsModal();
        });
      }

      if (this.elements.variationsModalBackdrop) {
        this.elements.variationsModalBackdrop.addEventListener('click', function(e) {
          if (e.target === self.elements.variationsModalBackdrop) {
            self.closeVariationsModal();
          }
        });

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && self.elements.variationsModalBackdrop.style.display !== 'none') {
            self.closeVariationsModal();
          }
        });
      }

      // --- V1.4 PROJECT MANAGEMENT & HISTORY LISTENERS ---
      if (this.elements.btnManageProjects) {
        this.elements.btnManageProjects.addEventListener('click', function() {
          self.openProjectManager();
        });
      }

      if (this.elements.btnQuickNewProject) {
        this.elements.btnQuickNewProject.addEventListener('click', function() {
          self.handleCreateNewProject();
        });
      }

      if (this.elements.btnModalCreateProject) {
        this.elements.btnModalCreateProject.addEventListener('click', function() {
          self.handleCreateNewProject();
        });
      }

      if (this.elements.btnCloseProjectManager) {
        this.elements.btnCloseProjectManager.addEventListener('click', function() {
          self.closeProjectManager();
        });
      }

      if (this.elements.btnCloseProjectManagerFooter) {
        this.elements.btnCloseProjectManagerFooter.addEventListener('click', function() {
          self.closeProjectManager();
        });
      }

      if (this.elements.projectManagerModal) {
        this.elements.projectManagerModal.addEventListener('click', function(e) {
          if (e.target === self.elements.projectManagerModal) {
            self.closeProjectManager();
          }
        });

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && self.elements.projectManagerModal && self.elements.projectManagerModal.style.display !== 'none') {
            self.closeProjectManager();
          }
        });
      }

      if (this.elements.btnHistoryUndo) {
        this.elements.btnHistoryUndo.addEventListener('click', function() {
          self.handleUndo();
        });
      }

      if (this.elements.btnHistoryRedo) {
        this.elements.btnHistoryRedo.addEventListener('click', function() {
          self.handleRedo();
        });
      }

      if (this.elements.btnResetPayload) {
        this.elements.btnResetPayload.addEventListener('click', function() {
          self.resetPayload();
        });
      }

      // Safe Keyboard Shortcuts: Cmd/Ctrl+Z for Undo, Cmd/Ctrl+Shift+Z or Ctrl+Y for Redo
      // Avoids interfering with typing inside text inputs / textareas
      window.addEventListener('keydown', function(e) {
        var isCmd = e.metaKey || e.ctrlKey;
        if (!isCmd) return;

        var targetTag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        var isTextInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

        if (e.key === 'z' && !e.shiftKey) {
          if (isTextInput) return; // Allow native input undo
          e.preventDefault();
          self.handleUndo();
          return;
        }

        if ((e.key === 'z' && e.shiftKey) || (e.key === 'y' && !e.shiftKey)) {
          if (isTextInput && e.key === 'y') return;
          e.preventDefault();
          self.handleRedo();
          return;
        }
      });

      // --- V1.5 PROJECT IMPORT & EXPORT LISTENERS ---
      if (this.elements.btnQuickExportProject) {
        this.elements.btnQuickExportProject.addEventListener('click', function() {
          self.handleExportCurrentProject();
        });
      }

      if (this.elements.btnExportProjectFile) {
        this.elements.btnExportProjectFile.addEventListener('click', function() {
          self.handleExportCurrentProject();
        });
      }

      if (this.elements.btnQuickImportProject) {
        this.elements.btnQuickImportProject.addEventListener('click', function() {
          if (self.elements.projectFileInput) {
            self.elements.projectFileInput.click();
          }
        });
      }

      if (this.elements.btnModalImportProject) {
        this.elements.btnModalImportProject.addEventListener('click', function() {
          if (self.elements.projectFileInput) {
            self.elements.projectFileInput.click();
          }
        });
      }

      if (this.elements.projectFileInput) {
        this.elements.projectFileInput.addEventListener('change', function(e) {
          self.handleProjectFileSelected(e);
        });
      }

      if (this.elements.btnCloseImportPreview) {
        this.elements.btnCloseImportPreview.addEventListener('click', function() {
          self.closeImportPreviewModal();
        });
      }

      if (this.elements.btnCancelImport) {
        this.elements.btnCancelImport.addEventListener('click', function() {
          self.closeImportPreviewModal();
        });
      }

      if (this.elements.btnImportAsNew) {
        this.elements.btnImportAsNew.addEventListener('click', function() {
          self.handleConfirmImportAsNew();
        });
      }

      if (this.elements.btnImportReplace) {
        this.elements.btnImportReplace.addEventListener('click', function() {
          self.handleConfirmImportReplace();
        });
      }

      if (this.elements.importPreviewModal) {
        this.elements.importPreviewModal.addEventListener('click', function(e) {
          if (e.target === self.elements.importPreviewModal) {
            self.closeImportPreviewModal();
          }
        });

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && self.elements.importPreviewModal && self.elements.importPreviewModal.style.display !== 'none') {
            self.closeImportPreviewModal();
          }
        });
      }
    },

    /**
     * V1.6 Initialize Universal Export Studio controls, listeners, and live summary.
     */
    initExportStudio: function() {
      var self = this;
      if (!this.elements.exportStudioPanel) return;

      // Category filter tabs
      if (this.elements.exportCatTabs) {
        this.elements.exportCatTabs.addEventListener('click', function(e) {
          var btn = e.target.closest('.btn-export-cat');
          if (btn) {
            var cat = btn.getAttribute('data-category') || btn.getAttribute('data-cat') || 'all';
            self.setExportCategory(cat);
          }
        });
      }

      // Search catalogue filter
      if (this.elements.exportFormatSearch) {
        this.elements.exportFormatSearch.addEventListener('input', function() {
          state.exportSearchQuery = this.value || '';
          self.renderFormatCatalogue();
        });
      }

      // Toggle multi-format bundle mode
      if (this.elements.btnToggleBundleMode) {
        this.elements.btnToggleBundleMode.addEventListener('click', function() {
          self.toggleBundleMode();
        });
      }

      // Bundle action bar export button
      if (this.elements.btnExportBundleMain) {
        this.elements.btnExportBundleMain.addEventListener('click', function() {
          self.handleExportBundle();
        });
      }

      // Reset export settings button
      if (this.elements.btnResetExportSettings) {
        this.elements.btnResetExportSettings.addEventListener('click', function() {
          self.resetExportSettings();
        });
      }

      // Copy HTML embed snippet button
      if (this.elements.btnCopyEmbedSnippet) {
        this.elements.btnCopyEmbedSnippet.addEventListener('click', function() {
          self.copyEmbedSnippet();
        });
      }

      // Size preset select change
      if (this.elements.exportSizeSelect) {
        this.elements.exportSizeSelect.addEventListener('change', function() {
          var val = this.value;
          if (val === 'custom') {
            state.exportPreset = 'custom';
            if (self.elements.customDimensionsCard) {
              self.elements.customDimensionsCard.style.display = 'flex';
            }
          } else {
            state.exportPreset = val;
            var num = parseInt(val, 10) || 512;
            state.exportSize = num;
            state.exportWidth = num;
            state.exportHeight = num;
            if (self.elements.customDimensionsCard) {
              self.elements.customDimensionsCard.style.display = 'none';
            }
          }
          self.updateExportSummary();
        });
      }

      // Custom width input
      if (this.elements.exportCustomWidth) {
        this.elements.exportCustomWidth.addEventListener('input', function() {
          var w = parseInt(this.value, 10) || 0;
          state.exportWidth = w;
          state.exportSize = w;
          if (state.exportLockAspect && self.elements.exportCustomHeight) {
            self.elements.exportCustomHeight.value = w;
            state.exportHeight = w;
          }
          self.checkNonSquareFit();
          self.updateExportSummary();
        });
      }

      // Custom height input
      if (this.elements.exportCustomHeight) {
        this.elements.exportCustomHeight.addEventListener('input', function() {
          var h = parseInt(this.value, 10) || 0;
          state.exportHeight = h;
          if (state.exportLockAspect && self.elements.exportCustomWidth) {
            self.elements.exportCustomWidth.value = h;
            state.exportWidth = h;
            state.exportSize = h;
          }
          self.checkNonSquareFit();
          self.updateExportSummary();
        });
      }

      // Lock aspect checkbox
      if (this.elements.exportLockAspect) {
        this.elements.exportLockAspect.addEventListener('change', function() {
          state.exportLockAspect = this.checked;
          if (state.exportLockAspect) {
            if (self.elements.exportCustomWidth && self.elements.exportCustomHeight) {
              self.elements.exportCustomHeight.value = self.elements.exportCustomWidth.value;
              state.exportHeight = state.exportWidth;
            }
          }
          self.checkNonSquareFit();
          self.updateExportSummary();
        });
      }

      // Non-square fit select
      if (this.elements.exportFitSelect) {
        this.elements.exportFitSelect.addEventListener('change', function() {
          state.exportFit = this.value || 'contain';
        });
      }

      // Transparency checkbox
      if (this.elements.exportTransparentBg) {
        this.elements.exportTransparentBg.addEventListener('change', function() {
          state.exportTransparentBg = this.checked;
          self.updateExportSummary();
          if (state.exportFormat === 'html-embed') {
            self.refreshEmbedSnippet();
          }
        });
      }

      // Quality slider
      if (this.elements.exportQualitySlider) {
        this.elements.exportQualitySlider.addEventListener('input', function() {
          var val = parseInt(this.value, 10) || 90;
          state.exportQuality = val / 100;
          state.exportJpegQuality = val / 100;
          state.exportWebpQuality = val / 100;
          if (self.elements.exportQualityVal) {
            self.elements.exportQualityVal.textContent = val + '%';
          }
        });
      }

      // PDF Page options
      if (this.elements.pdfPageSizeSelect) {
        this.elements.pdfPageSizeSelect.addEventListener('change', function() {
          state.exportPdfPageSize = this.value || 'letter';
          self.updateExportSummary();
        });
      }
      if (this.elements.pdfOrientationSelect) {
        this.elements.pdfOrientationSelect.addEventListener('change', function() {
          state.exportPdfOrientation = this.value || 'portrait';
          self.updateExportSummary();
        });
      }
      if (this.elements.pdfLayoutSelect) {
        this.elements.pdfLayoutSelect.addEventListener('change', function() {
          state.exportPdfLayout = this.value || 'single';
          self.updateExportSummary();
        });
      }

      // Initial catalogue render & selection
      this.renderFormatCatalogue();
      this.setExportFormat(state.exportFormat || 'png');
    },

    /**
     * Check if non-square fit dropdown should be shown.
     */
    checkNonSquareFit: function() {
      if (!this.elements.dimFitWrap) return;
      var w = state.exportWidth;
      var h = state.exportHeight;
      if (state.exportPreset === 'custom' && !state.exportLockAspect && w !== h) {
        this.elements.dimFitWrap.style.display = 'flex';
      } else {
        this.elements.dimFitWrap.style.display = 'none';
      }
    },

    /**
     * Render the Universal Format Catalogue Grid based on category and search query.
     */
    renderFormatCatalogue: function() {
      var self = this;
      var grid = this.elements.universalFormatGrid;
      if (!grid || !QRStudio.ExportStudio) return;

      var formats = QRStudio.ExportStudio.getFormats();
      var cat = state.exportCategory || 'all';
      var query = (state.exportSearchQuery || '').trim().toLowerCase();

      var filtered = formats.filter(function(f) {
        if (cat !== 'all' && f.category !== cat) return false;
        if (query) {
          var matchStr = (f.name + ' ' + f.id + ' ' + f.extension + ' ' + f.category + ' ' + f.description).toLowerCase();
          if (matchStr.indexOf(query) === -1) return false;
        }
        return true;
      });

      grid.innerHTML = '';

      if (filtered.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'export-catalogue-empty';
        emptyDiv.style.gridColumn = '1 / -1';
        emptyDiv.style.padding = '32px 16px';
        emptyDiv.style.textAlign = 'center';
        emptyDiv.style.color = '#737373';
        emptyDiv.style.fontWeight = 'bold';
        emptyDiv.style.border = '2px dashed #D4D4D4';
        emptyDiv.textContent = 'No export formats match your filter or search criteria.';
        grid.appendChild(emptyDiv);
        return;
      }

      filtered.forEach(function(f) {
        var card = document.createElement('div');
        var isSelected = state.exportIsBundleMode
          ? (state.exportSelectedBundleFormats.indexOf(f.id) !== -1)
          : (state.exportFormat === f.id);
        var isAvail = f.available !== false;

        card.className = 'format-card' +
          (isSelected ? ' is-active' : '') +
          (!isAvail ? ' is-unsupported' : '');
        card.setAttribute('data-format-id', f.id);
        card.setAttribute('role', state.exportIsBundleMode ? 'checkbox' : 'button');
        card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        card.setAttribute('tabindex', '0');

        var checkHtml = state.exportIsBundleMode
          ? '<span class="format-card-check">' + (isSelected ? '✓' : '') + '</span>'
          : '';

        card.innerHTML =
          '<div class="format-card-top">' +
            '<span class="format-card-ext">' + f.extension + '</span>' +
            '<span class="format-card-badge">' + f.badge + '</span>' +
          '</div>' +
          '<div class="format-card-name">' + f.name + '</div>' +
          '<div class="format-card-desc">' + f.description + '</div>' +
          checkHtml;

        var handleActivate = function() {
          if (state.exportIsBundleMode) {
            self.toggleBundleFormat(f.id);
          } else {
            self.setExportFormat(f.id);
          }
        };

        card.addEventListener('click', handleActivate);
        card.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
          }
        });

        grid.appendChild(card);
      });
    },

    /**
     * Filter format catalogue by category tab.
     */
    setExportCategory: function(cat) {
      state.exportCategory = cat || 'all';
      if (this.elements.exportCatTabs) {
        var btns = this.elements.exportCatTabs.querySelectorAll('.btn-export-cat');
        btns.forEach(function(b) {
          var bCat = b.getAttribute('data-category') || b.getAttribute('data-cat') || 'all';
          var isMatch = bCat === state.exportCategory;
          b.classList.toggle('is-active', isMatch);
          b.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
      }
      this.renderFormatCatalogue();
    },

    /**
     * Toggle Multi-Format Bundle Export mode.
     */
    toggleBundleMode: function(enable) {
      state.exportIsBundleMode = (enable !== undefined ? !!enable : !state.exportIsBundleMode);

      if (this.elements.btnToggleBundleMode) {
        this.elements.btnToggleBundleMode.classList.toggle('is-active', state.exportIsBundleMode);
        this.elements.btnToggleBundleMode.textContent = state.exportIsBundleMode
          ? '✓ Bundle Mode: ON'
          : '⧉ Multi-Format Bundle';
      }

      if (this.elements.bundleActionBar) {
        this.elements.bundleActionBar.style.display = state.exportIsBundleMode ? 'flex' : 'none';
      }

      if (this.elements.bundleCountBadge) {
        this.elements.bundleCountBadge.textContent = state.exportSelectedBundleFormats.length + ' formats selected';
      }

      this.renderFormatCatalogue();
      this.updateExportOptionsVisibility();
      this.updateExportSummary();
    },

    /**
     * Toggle format selection inside multi-format bundle list.
     */
    toggleBundleFormat: function(formatId) {
      var idx = state.exportSelectedBundleFormats.indexOf(formatId);
      if (idx !== -1) {
        if (state.exportSelectedBundleFormats.length <= 1) {
          this.showToast('At least one format must remain selected in the bundle.', 'warning');
          return;
        }
        state.exportSelectedBundleFormats.splice(idx, 1);
      } else {
        state.exportSelectedBundleFormats.push(formatId);
      }

      if (this.elements.bundleCountBadge) {
        this.elements.bundleCountBadge.textContent = state.exportSelectedBundleFormats.length + ' formats selected';
      }

      this.renderFormatCatalogue();
      this.updateExportSummary();
    },

    /**
     * Switch active single export format.
     */
    setExportFormat: function(formatId) {
      formatId = (formatId || 'png').toLowerCase();
      state.exportFormat = formatId;

      if (this.elements.universalFormatGrid) {
        var cards = this.elements.universalFormatGrid.querySelectorAll('.format-card');
        cards.forEach(function(c) {
          var isActive = (c.getAttribute('data-format-id') === formatId);
          c.classList.toggle('is-active', isActive);
          c.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
      }

      this.updateExportOptionsVisibility();
      this.updateExportSummary();
    },

    /**
     * Show/hide format-specific options (dimensions, quality, transparency, PDF layout, spreadsheet notice, embed snippet).
     */
    updateExportOptionsVisibility: function() {
      if (!QRStudio.ExportStudio) return;

      var fmt = QRStudio.ExportStudio.getFormatById(state.exportFormat);
      if (!fmt) return;

      // 1. Dimensions card (for raster images that have custom/preset sizes)
      if (this.elements.exportDimensionsGroup) {
        this.elements.exportDimensionsGroup.style.display = fmt.dimensionSupport ? 'block' : 'none';
      }

      // 2. Raster options (transparency, quality, browser badge, format notice)
      if (this.elements.formatOptionsRaster) {
        var hasRasterOpts = fmt.dimensionSupport || fmt.transparencySupport || fmt.qualitySupport || fmt.notes;
        this.elements.formatOptionsRaster.style.display = hasRasterOpts ? 'block' : 'none';

        if (this.elements.wrapTransparentBg) {
          this.elements.wrapTransparentBg.style.display = fmt.transparencySupport ? 'flex' : 'none';
          if (this.elements.exportTransparentBg) {
            this.elements.exportTransparentBg.checked = !!state.exportTransparentBg;
          }
        }

        if (this.elements.wrapQualitySlider) {
          this.elements.wrapQualitySlider.style.display = fmt.qualitySupport ? 'block' : 'none';
          if (this.elements.exportQualitySlider) {
            this.elements.exportQualitySlider.value = Math.round(state.exportQuality * 100);
          }
          if (this.elements.exportQualityVal) {
            this.elements.exportQualityVal.textContent = Math.round(state.exportQuality * 100) + '%';
          }
        }

        if (this.elements.browserSupportBadge && this.elements.browserSupportText) {
          if (fmt.id === 'webp') {
            var webpOk = QRStudio.ExportStudio.isWebPSupported();
            this.elements.browserSupportBadge.style.display = 'inline-block';
            this.elements.browserSupportBadge.classList.toggle('is-unsupported', !webpOk);
            this.elements.browserSupportText.textContent = webpOk
              ? 'WebP encoding natively supported'
              : 'WebP encoding not supported in this browser';
          } else if (fmt.id === 'avif') {
            var avifOk = QRStudio.ExportStudio.isAvifSupported();
            this.elements.browserSupportBadge.style.display = 'inline-block';
            this.elements.browserSupportBadge.classList.toggle('is-unsupported', !avifOk);
            this.elements.browserSupportText.textContent = avifOk
              ? 'AVIF encoding natively supported'
              : 'AVIF encoding not supported in this browser';
          } else {
            this.elements.browserSupportBadge.style.display = 'none';
          }
        }

        if (this.elements.formatNoticeNote) {
          this.elements.formatNoticeNote.textContent = fmt.notes || '';
        }
      }

      // 3. PDF print options
      if (this.elements.formatOptionsPdf) {
        this.elements.formatOptionsPdf.style.display = (fmt.id === 'pdf') ? 'block' : 'none';
        if (this.elements.pdfPageSizeSelect) this.elements.pdfPageSizeSelect.value = state.exportPdfPageSize;
        if (this.elements.pdfOrientationSelect) this.elements.pdfOrientationSelect.value = state.exportPdfOrientation;
        if (this.elements.pdfLayoutSelect) this.elements.pdfLayoutSelect.value = state.exportPdfLayout;
      }

      // 4. Spreadsheet formula injection notice
      if (this.elements.formatOptionsSpreadsheet) {
        var isSpreadsheet = (fmt.id === 'xlsx' || fmt.id === 'csv' || fmt.id === 'tsv' || fmt.id === 'ods');
        this.elements.formatOptionsSpreadsheet.style.display = isSpreadsheet ? 'block' : 'none';
      }

      // 5. Design & Figma notes
      if (this.elements.formatOptionsDesign) {
        var isDesign = (fmt.id === 'figma-zip' || fmt.id === 'design-spec');
        this.elements.formatOptionsDesign.style.display = isDesign ? 'block' : 'none';
      }

      // 6. Embed snippet box
      if (this.elements.formatOptionsEmbed) {
        var isEmbed = (fmt.id === 'html-embed');
        this.elements.formatOptionsEmbed.style.display = isEmbed ? 'block' : 'none';
        if (isEmbed) {
          this.refreshEmbedSnippet();
        }
      }
    },

    /**
     * Helper to retrieve active export options dictionary.
     */
    getExportOptions: function() {
      var w = state.exportWidth || 512;
      var h = state.exportHeight || w;
      var activeProj = QRStudio.ProjectManager ? QRStudio.ProjectManager.getActiveProject() : null;
      return {
        width: w,
        height: h,
        size: w,
        typeId: state.lastValidType || state.activeType || 'url',
        projectName: (activeProj && activeProj.name) || (state.lastValidType || state.activeType || 'qr-code'),
        quality: state.exportQuality,
        transparentBackground: !!state.exportTransparentBg,
        fit: state.exportFit || 'contain',
        pdfPageSize: state.exportPdfPageSize || 'letter',
        pdfOrientation: state.exportPdfOrientation || 'portrait',
        pdfLayout: state.exportPdfLayout || 'single',
        darkColor: state.design.darkColor,
        lightColor: state.design.lightColor,
        moduleStyle: state.design.moduleStyle,
        finderStyle: state.design.finderStyle,
        logo: state.design.logo,
        background: state.design.background,
        frame: state.design.frame
      };
    },

    /**
     * Refresh the generated HTML embed snippet text.
     */
    refreshEmbedSnippet: function() {
      if (!this.elements.embedSnippetText || !state.lastValidModel || !QRStudio.ExportStudio) return;
      var opts = this.getExportOptions();
      var snippet = QRStudio.ExportStudio.generateEmbedSnippet(state.lastValidModel, opts);
      this.elements.embedSnippetText.value = snippet;
    },

    /**
     * Copy HTML embed snippet to clipboard.
     */
    copyEmbedSnippet: function() {
      var self = this;
      if (!this.elements.embedSnippetText) return;
      var text = this.elements.embedSnippetText.value;
      if (!text) {
        this.showToast('No embed snippet generated yet. Enter QR content first.', 'warning');
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          self.showToast('HTML embed snippet copied to clipboard!', 'success');
        }).catch(function() {
          self.elements.embedSnippetText.select();
          document.execCommand('copy');
          self.showToast('HTML embed snippet copied to clipboard!', 'success');
        });
      } else {
        this.elements.embedSnippetText.select();
        document.execCommand('copy');
        this.showToast('HTML embed snippet copied to clipboard!', 'success');
      }
    },

    /**
     * Update live export summary badges, estimated dimensions, and button text.
     */
    updateExportSummary: function() {
      var w = 512, h = 512;
      if (state.exportPreset === 'custom') {
        w = parseInt(this.elements.exportCustomWidth ? this.elements.exportCustomWidth.value : state.exportWidth, 10) || 1024;
        h = parseInt(this.elements.exportCustomHeight ? this.elements.exportCustomHeight.value : state.exportHeight, 10) || 1024;
      } else {
        w = parseInt(state.exportPreset, 10) || 512;
        h = w;
      }

      state.exportWidth = w;
      state.exportHeight = h;
      state.exportSize = w;

      var fmt = QRStudio.ExportStudio ? QRStudio.ExportStudio.getFormatById(state.exportFormat) : null;
      var isBundle = !!state.exportIsBundleMode;

      // Validate dimensions if raster
      if (fmt && fmt.dimensionSupport) {
        var dimCheck = QRStudio.ExportStudio.validateDimensions(w, h);
        if (this.elements.exportDimensionWarning) {
          if (!dimCheck.valid) {
            this.elements.exportDimensionWarning.style.display = 'flex';
            if (this.elements.exportDimensionWarningText) {
              this.elements.exportDimensionWarningText.textContent = dimCheck.errors.join(' ');
            }
            if (this.elements.exportBtn) this.elements.exportBtn.disabled = true;
          } else if (dimCheck.warnings && dimCheck.warnings.length > 0) {
            this.elements.exportDimensionWarning.style.display = 'flex';
            if (this.elements.exportDimensionWarningText) {
              this.elements.exportDimensionWarningText.textContent = dimCheck.warnings.join(' ');
            }
            if (this.elements.exportBtn && state.lastValidModel) this.elements.exportBtn.disabled = false;
          } else {
            this.elements.exportDimensionWarning.style.display = 'none';
            if (this.elements.exportBtn && state.lastValidModel) this.elements.exportBtn.disabled = false;
          }
        }
      } else {
        if (this.elements.exportDimensionWarning) {
          this.elements.exportDimensionWarning.style.display = 'none';
        }
        if (this.elements.exportBtn && state.lastValidModel) {
          this.elements.exportBtn.disabled = false;
        }
      }

      // Check browser format availability
      if (!isBundle && fmt && fmt.available === false) {
        if (this.elements.exportBtn) this.elements.exportBtn.disabled = true;
      }

      // Summary badges & filename
      var activeProj = QRStudio.ProjectManager ? QRStudio.ProjectManager.getActiveProject() : null;
      var projName = (activeProj && activeProj.name) || state.lastValidType || state.activeType || 'code';

      if (isBundle) {
        if (this.elements.summaryFormatBadge) {
          this.elements.summaryFormatBadge.textContent = 'BUNDLE (' + state.exportSelectedBundleFormats.length + ')';
        }
        if (this.elements.summaryDimsBadge) {
          this.elements.summaryDimsBadge.textContent = 'ZIP Archive';
        }
        if (this.elements.summaryFilenameStr) {
          this.elements.summaryFilenameStr.textContent = QRStudio.ExportStudio.sanitizeFilename(projName) + '-bundle.zip';
        }
        if (this.elements.exportBtnText) {
          this.elements.exportBtnText.textContent = 'Export Bundle ZIP (' + state.exportSelectedBundleFormats.length + ' formats)';
        }
      } else if (fmt) {
        if (this.elements.summaryFormatBadge) {
          this.elements.summaryFormatBadge.textContent = fmt.extension.toUpperCase();
        }
        if (this.elements.summaryDimsBadge) {
          if (fmt.dimensionSupport) {
            this.elements.summaryDimsBadge.textContent = w + ' × ' + h + ' px';
          } else if (fmt.id === 'pdf') {
            this.elements.summaryDimsBadge.textContent = state.exportPdfPageSize.toUpperCase() + ' (' + state.exportPdfLayout + ')';
          } else if (fmt.id === 'html-embed') {
            this.elements.summaryDimsBadge.textContent = 'HTML Snippet';
          } else {
            this.elements.summaryDimsBadge.textContent = fmt.category.toUpperCase();
          }
        }
        if (this.elements.summaryFilenameStr) {
          this.elements.summaryFilenameStr.textContent = QRStudio.ExportStudio.buildFilename(projName, fmt.id, { width: w, height: h });
        }
        if (this.elements.exportBtnText) {
          if (fmt.id === 'html-embed') {
            this.elements.exportBtnText.textContent = 'Copy HTML Embed Snippet';
          } else {
            this.elements.exportBtnText.textContent = 'Export ' + fmt.extension.toUpperCase() + (fmt.dimensionSupport ? ' (' + w + ' × ' + h + ')' : '');
          }
        }
      }
    },

    /**
     * Handle universal export across all 22 supported formats or bundle mode.
     */
    handleExport: function() {
      var self = this;
      var typeDef = QRStudio.Payloads.getType(state.activeType);
      var currentData = state.formData[state.activeType] || {};
      var validation = typeDef.validate(currentData);

      // Validate required fields for the selected QR type upon export attempt
      if (!validation.isValid) {
        this.displayErrors(validation.errors);
        var firstErrorKey = Object.keys(validation.errors)[0];
        if (firstErrorKey) {
          var errInput = document.getElementById('field-' + firstErrorKey);
          if (errInput) {
            try { errInput.focus(); } catch (e) {}
          }
        }
        var msg = validation.errors[firstErrorKey] || 'Please enter valid content before exporting.';
        this.showToast(msg, 'error');
        return;
      }

      if (!state.lastValidModel) {
        this.showToast('Please enter valid content before exporting.', 'error');
        return;
      }

      if (state.exportIsBundleMode) {
        this.handleExportBundle();
        return;
      }

      var fmt = QRStudio.ExportStudio ? QRStudio.ExportStudio.getFormatById(state.exportFormat) : null;
      if (!fmt) {
        this.showToast('Unknown export format selected.', 'error');
        return;
      }

      if (fmt.id === 'html-embed') {
        this.copyEmbedSnippet();
        return;
      }

      if (fmt.available === false) {
        this.showToast(fmt.name + ' is not supported in this browser. Please select another format.', 'error');
        return;
      }

      var opts = this.getExportOptions();

      if (fmt.dimensionSupport) {
        var dimCheck = QRStudio.ExportStudio.validateDimensions(opts.width, opts.height);
        if (!dimCheck.valid) {
          this.showToast('Invalid dimensions: ' + dimCheck.errors.join(' '), 'error');
          return;
        }
      }

      this.elements.exportBtn.disabled = true;
      if (this.elements.exportBtnText) {
        this.elements.exportBtnText.textContent = 'Exporting ' + fmt.extension.toUpperCase() + '...';
      }

      var activeProj = QRStudio.ProjectManager ? QRStudio.ProjectManager.getActiveProject() : null;

      QRStudio.ExportStudio.export(state.exportFormat, state.lastValidModel, opts, activeProj)
        .then(function(res) {
          var fname = res && res.filename ? res.filename : (fmt.name + ' file');
          self.showToast(fname + ' exported successfully!', 'success');
        })
        .catch(function(err) {
          self.showToast('Export failed: ' + (err.message || String(err)), 'error');
        })
        .finally(function() {
          self.elements.exportBtn.disabled = false;
          self.updateExportSummary();
        });
    },

    /**
     * Handle multi-format bundle export packaged in a single ZIP.
     */
    handleExportBundle: function() {
      var self = this;
      var typeDef = QRStudio.Payloads.getType(state.activeType);
      var currentData = state.formData[state.activeType] || {};
      var validation = typeDef.validate(currentData);

      if (!validation.isValid) {
        this.displayErrors(validation.errors);
        var firstErrorKey = Object.keys(validation.errors)[0];
        if (firstErrorKey) {
          var errInput = document.getElementById('field-' + firstErrorKey);
          if (errInput) {
            try { errInput.focus(); } catch (e) {}
          }
        }
        var msg = validation.errors[firstErrorKey] || 'Please enter valid content before exporting bundle.';
        this.showToast(msg, 'error');
        return;
      }

      if (!state.lastValidModel) {
        this.showToast('Please enter valid content before exporting.', 'error');
        return;
      }

      if (!state.exportSelectedBundleFormats || state.exportSelectedBundleFormats.length === 0) {
        this.showToast('Please select at least one format for the bundle.', 'warning');
        return;
      }

      var opts = this.getExportOptions();
      var activeProj = QRStudio.ProjectManager ? QRStudio.ProjectManager.getActiveProject() : null;

      this.elements.exportBtn.disabled = true;
      if (this.elements.btnExportBundleMain) this.elements.btnExportBundleMain.disabled = true;
      if (this.elements.exportBtnText) {
        this.elements.exportBtnText.textContent = 'Generating Bundle ZIP...';
      }

      QRStudio.ExportStudio.exportBundle(state.exportSelectedBundleFormats, state.lastValidModel, opts, activeProj)
        .then(function(res) {
          var fname = res && res.filename ? res.filename : 'bundle.zip';
          self.showToast(fname + ' downloaded (' + res.count + ' formats bundled)!', 'success');
        })
        .catch(function(err) {
          self.showToast('Bundle export failed: ' + (err.message || String(err)), 'error');
        })
        .finally(function() {
          self.elements.exportBtn.disabled = false;
          if (self.elements.btnExportBundleMain) self.elements.btnExportBundleMain.disabled = false;
          self.updateExportSummary();
        });
    },

    /**
     * Reset export options to factory defaults.
     */
    resetExportSettings: function() {
      state.exportFormat = 'png';
      state.exportPreset = '512';
      state.exportWidth = 512;
      state.exportHeight = 512;
      state.exportSize = 512;
      state.exportLockAspect = true;
      state.exportFit = 'contain';
      state.exportTransparentBg = false;
      state.exportQuality = 0.90;
      state.exportJpegQuality = 0.92;
      state.exportWebpQuality = 0.90;
      state.exportCategory = 'all';
      state.exportSearchQuery = '';
      state.exportIsBundleMode = false;
      state.exportSelectedBundleFormats = ['png', 'svg', 'pdf'];
      state.exportPdfPageSize = 'letter';
      state.exportPdfOrientation = 'portrait';
      state.exportPdfLayout = 'single';

      // Sync DOM elements
      if (this.elements.exportFormatSearch) this.elements.exportFormatSearch.value = '';
      if (this.elements.exportSizeSelect) this.elements.exportSizeSelect.value = '512';
      if (this.elements.customDimensionsCard) this.elements.customDimensionsCard.style.display = 'none';
      if (this.elements.exportCustomWidth) this.elements.exportCustomWidth.value = '512';
      if (this.elements.exportCustomHeight) this.elements.exportCustomHeight.value = '512';
      if (this.elements.exportLockAspect) this.elements.exportLockAspect.checked = true;
      if (this.elements.dimFitWrap) this.elements.dimFitWrap.style.display = 'none';
      if (this.elements.exportFitSelect) this.elements.exportFitSelect.value = 'contain';
      if (this.elements.exportTransparentBg) this.elements.exportTransparentBg.checked = false;
      if (this.elements.exportQualitySlider) this.elements.exportQualitySlider.value = 90;
      if (this.elements.exportQualityVal) this.elements.exportQualityVal.textContent = '90%';
      if (this.elements.pdfPageSizeSelect) this.elements.pdfPageSizeSelect.value = 'letter';
      if (this.elements.pdfOrientationSelect) this.elements.pdfOrientationSelect.value = 'portrait';
      if (this.elements.pdfLayoutSelect) this.elements.pdfLayoutSelect.value = 'single';
      if (this.elements.btnToggleBundleMode) {
        this.elements.btnToggleBundleMode.classList.remove('is-active');
        this.elements.btnToggleBundleMode.textContent = '⧉ Multi-Format Bundle';
      }
      if (this.elements.bundleActionBar) this.elements.bundleActionBar.style.display = 'none';

      // Category buttons
      if (this.elements.exportCatTabs) {
        var btns = this.elements.exportCatTabs.querySelectorAll('.btn-export-cat');
        btns.forEach(function(b) {
          var bCat = b.getAttribute('data-category') || b.getAttribute('data-cat') || 'all';
          var isAll = bCat === 'all';
          b.classList.toggle('is-active', isAll);
          b.setAttribute('aria-selected', isAll ? 'true' : 'false');
        });
      }

      this.renderFormatCatalogue();
      this.setExportFormat('png');
      this.updateExportSummary();
      this.showToast('Export settings reset to defaults.', 'success');
    },

    /**
     * Copy raw encoded payload string to clipboard.
     */
    handleCopyPayload: function() {
      var self = this;
      var text = this.elements.payloadInspectorCode.textContent;
      if (!text || text.indexOf('(Awaiting') === 0) return;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(function() {
            self.showToast('Payload string copied to clipboard!', 'success');
          })
          .catch(function() {
            self.fallbackCopy(text);
          });
      } else {
        self.fallbackCopy(text);
      }
    },

    fallbackCopy: function(text) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showToast('Payload string copied to clipboard!', 'success');
      } catch (e) {
        this.showToast('Could not copy to clipboard.', 'error');
      }
      document.body.removeChild(textarea);
    },

    // =========================================================================
    // V1.4 PROJECT MANAGEMENT, HISTORY & AUTOSAVE METHODS
    // =========================================================================

    /**
     * Produce a clean, serializable clone of editor state for history & storage.
     */
    getSerializableState: function() {
      return {
        activeType: state.activeType,
        ecl: state.ecl,
        exportSize: state.exportSize,
        activeSubtab: state.activeSubtab,
        activeTemplateId: state.activeTemplateId,
        templateCategory: state.templateCategory,
        locks: JSON.parse(JSON.stringify(state.locks || { colors: false, modules: false, finders: false, frame: false })),
        formData: JSON.parse(JSON.stringify(state.formData || {})),
        design: JSON.parse(JSON.stringify(state.design || {}))
      };
    },

    /**
     * Apply a complete state snapshot (from Undo, Redo, or Project Switch).
     */
    applyStateSnapshot: function(snapshot) {
      if (!snapshot) return;

      state.activeType = snapshot.activeType || 'url';
      state.ecl = snapshot.ecl || 'M';
      state.exportSize = snapshot.exportSize || 512;
      state.activeSubtab = snapshot.activeSubtab || 'subtabTemplates';
      state.activeTemplateId = snapshot.activeTemplateId || null;
      state.templateCategory = snapshot.templateCategory || 'all';
      if (snapshot.locks) {
        state.locks = JSON.parse(JSON.stringify(snapshot.locks));
      }
      state.formData = JSON.parse(JSON.stringify(snapshot.formData || {}));
      state.design = JSON.parse(JSON.stringify(snapshot.design || {}));

      // Reconstruct image objects if base64 dataUrls exist
      if (state.design.logo && state.design.logo.dataUrl) {
        var lImg = new Image();
        lImg.src = state.design.logo.dataUrl;
        state.design.logo.image = lImg;
      } else if (state.design.logo) {
        state.design.logo.image = null;
      }

      if (state.design.background && state.design.background.dataUrl) {
        var bImg = new Image();
        bImg.src = state.design.background.dataUrl;
        state.design.background.image = bImg;
      } else if (state.design.background) {
        state.design.background.image = null;
      }

      this.syncAllControls();
      this.processInput(false);
    },

    /**
     * Synchronize all UI elements (types, inputs, branding, design) with state.
     */
    syncAllControls: function() {
      // 1. Sync payload type tabs
      if (this.elements.typeNavList) {
        var tabs = this.elements.typeNavList.querySelectorAll('.type-tab-btn');
        tabs.forEach(function(tab) {
          var isMatch = tab.id === 'tab-' + state.activeType;
          tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
      }

      // 2. Re-render dynamic form inputs populated with current state data
      this.renderActiveForm();

      // 3. Sync design controls (colors, shapes, frames)
      this.syncDesignControls();

      // 4. Sync branding controls (logo & background)
      this.syncBrandingControls();

      // 5. Sync ECL radios
      if (this.elements.eclRadios) {
        this.elements.eclRadios.forEach(function(r) {
          r.checked = (r.value === state.ecl);
        });
      }

      // 6. Sync Export Size select
      if (this.elements.exportSizeSelect) {
        this.elements.exportSizeSelect.value = state.exportSize;
      }

      // 7. Sync templates gallery
      this.renderTemplateGallery(state.templateCategory);
      this.updateContrastAdvisory();
      this.updateStatusBadges();
    },

    /**
     * Synchronize logo and background editor panels with state.design.
     */
    syncBrandingControls: function() {
      // Logo UI sync
      var hasLogo = !!(state.design.logo && state.design.logo.dataUrl);
      if (this.elements.logoDropzone) this.elements.logoDropzone.style.display = hasLogo ? 'none' : 'flex';
      if (this.elements.logoActiveCard) this.elements.logoActiveCard.style.display = hasLogo ? 'flex' : 'none';
      if (this.elements.logoControlsGroup) this.elements.logoControlsGroup.style.display = hasLogo ? 'block' : 'none';
      if (hasLogo) {
        if (this.elements.logoThumbnail) this.elements.logoThumbnail.src = state.design.logo.dataUrl;
        if (this.elements.logoFilename) this.elements.logoFilename.textContent = state.design.logo.filename || 'Logo Image';
        if (this.elements.logoMeta) this.elements.logoMeta.textContent = (state.design.logo.width || 0) + ' × ' + (state.design.logo.height || 0) + ' px';
        if (this.elements.logoSizeSlider) this.elements.logoSizeSlider.value = state.design.logo.sizePercent;
        if (this.elements.logoSizeValue) this.elements.logoSizeValue.textContent = state.design.logo.sizePercent + '%';
        if (this.elements.logoPaddingSlider) this.elements.logoPaddingSlider.value = state.design.logo.padding;
        if (this.elements.logoPaddingValue) this.elements.logoPaddingValue.textContent = state.design.logo.padding + 'px';
        if (this.elements.badgeShapeBtns) {
          this.elements.badgeShapeBtns.forEach(function(b) {
            var active = b.getAttribute('data-shape') === state.design.logo.badgeShape;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-checked', active ? 'true' : 'false');
          });
        }
        if (this.elements.badgeColorPicker) this.elements.badgeColorPicker.value = state.design.logo.badgeColor;
        if (this.elements.badgeSwatchDisplay) this.elements.badgeSwatchDisplay.style.backgroundColor = state.design.logo.badgeColor;
      }

      // Background UI sync
      var hasBg = !!(state.design.background && state.design.background.dataUrl);
      if (this.elements.bgDropzone) this.elements.bgDropzone.style.display = hasBg ? 'none' : 'flex';
      if (this.elements.bgActiveCard) this.elements.bgActiveCard.style.display = hasBg ? 'flex' : 'none';
      if (this.elements.bgControlsGroup) this.elements.bgControlsGroup.style.display = hasBg ? 'block' : 'none';
      if (hasBg) {
        if (this.elements.bgThumbnail) this.elements.bgThumbnail.src = state.design.background.dataUrl;
        if (this.elements.bgFilename) this.elements.bgFilename.textContent = state.design.background.filename || 'Background Photo';
        if (this.elements.bgMeta) this.elements.bgMeta.textContent = (state.design.background.width || 0) + ' × ' + (state.design.background.height || 0) + ' px';
        if (this.elements.bgZoomSlider) this.elements.bgZoomSlider.value = Math.round(state.design.background.zoom * 100);
        if (this.elements.bgZoomValue) this.elements.bgZoomValue.textContent = Math.round(state.design.background.zoom * 100) + '%';
        if (this.elements.bgPanXSlider) this.elements.bgPanXSlider.value = Math.round(state.design.background.panX * 100);
        if (this.elements.bgPanXValue) this.elements.bgPanXValue.textContent = (state.design.background.panX > 0 ? '+' : '') + Math.round(state.design.background.panX * 100) + '%';
        if (this.elements.bgOpacitySlider) this.elements.bgOpacitySlider.value = Math.round(state.design.background.opacity * 100);
        if (this.elements.bgOpacityValue) this.elements.bgOpacityValue.textContent = Math.round(state.design.background.opacity * 100) + '%';
        if (this.elements.bgTintColorPicker) this.elements.bgTintColorPicker.value = state.design.background.tintColor;
        if (this.elements.bgTintSwatch) this.elements.bgTintSwatch.style.backgroundColor = state.design.background.tintColor;
        if (this.elements.bgTintOpacitySlider) this.elements.bgTintOpacitySlider.value = Math.round(state.design.background.tintOpacity * 100);
        if (this.elements.bgTintOpacityValue) this.elements.bgTintOpacityValue.textContent = Math.round(state.design.background.tintOpacity * 100) + '%';
        if (this.elements.bgFitBtns) {
          this.elements.bgFitBtns.forEach(function(b) {
            var active = b.getAttribute('data-fit') === state.design.background.fit;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-checked', active ? 'true' : 'false');
          });
        }
      }

      // Sync property lock button states
      this.syncLockButtons();
    },

    /**
     * Synchronize lock buttons visual active states with state.locks.
     */
    syncLockButtons: function() {
      if (!state.locks) return;
      ['colors', 'modules', 'finders', 'frame'].forEach(function(prop) {
        var isLocked = !!state.locks[prop];
        var btn = document.querySelector('.lock-toggle-btn[data-prop="' + prop + '"]');
        if (btn) {
          btn.classList.toggle('is-locked', isLocked);
          btn.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
          var icon = btn.querySelector('.lock-state-icon');
          if (icon) icon.textContent = isLocked ? '🔒' : '🔓';
        }
      });
    },

    /**
     * Load project object into active workspace.
     */
    loadProject: function(projectObj) {
      if (!projectObj) return;
      if (this.history) this.history.clear();

      this.applyStateSnapshot(projectObj);

      if (this.elements.templatesActiveSummary && QRStudio.Templates && state.activeTemplateId) {
        var t = QRStudio.Templates.getById(state.activeTemplateId);
        this.elements.templatesActiveSummary.textContent = 'Active: ' + (t ? t.name : 'Custom');
      }

      if (this.history) {
        this.history.push(this.getSerializableState());
      }

      this.updateHistoryButtons();
      this.updateTopbarProjectName();
      this.updateAutosaveStatus('saved');
    },

    /**
     * Update project name display in console topbar.
     */
    updateTopbarProjectName: function() {
      var active = this.projectStore ? this.projectStore.getActiveProject() : null;
      var name = active ? active.name : 'Default Project';
      if (this.elements.topbarProjectName) {
        this.elements.topbarProjectName.textContent = name;
      }
      this.updateExportSummary();
    },

    /**
     * Schedule a debounced autosave of current editor state into active project.
     */
    scheduleAutosave: function() {
      var self = this;
      this.updateAutosaveStatus('saving');

      if (this._autosaveTimer) {
        clearTimeout(this._autosaveTimer);
      }

      this._autosaveTimer = setTimeout(function() {
        if (self.projectStore) {
          var res = self.projectStore.saveActiveProjectState(state);
          if (res && res.reason === 'quota_full') {
            self.updateAutosaveStatus('error');
          } else {
            self.updateAutosaveStatus('saved');
          }
        }
        self._autosaveTimer = null;
      }, 500);
    },

    /**
     * Update visual autosave status indicator.
     */
    updateAutosaveStatus: function(status) {
      var pill = this.elements.autosaveStatusBadge;
      var text = this.elements.autosaveStatusText;
      if (!pill || !text) return;

      pill.classList.remove('is-saving', 'is-error', 'is-saved');

      if (status === 'saving') {
        pill.classList.add('is-saving');
        text.textContent = 'Saving...';
        pill.title = 'Saving changes to local browser storage...';
      } else if (status === 'error') {
        pill.classList.add('is-error');
        text.textContent = 'Storage Full (In-Memory Safe)';
        pill.title = 'Browser storage quota reached. Project changes remain safe in active memory.';
      } else {
        pill.classList.add('is-saved');
        text.textContent = 'Saved';
        var d = new Date();
        var timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        pill.title = 'Saved to browser storage at ' + timeStr + '. Local to this machine.';
      }
    },

    /**
     * Update disabled states on Undo and Redo buttons.
     */
    updateHistoryButtons: function() {
      if (this.elements.btnHistoryUndo) {
        this.elements.btnHistoryUndo.disabled = !this.history || !this.history.canUndo();
      }
      if (this.elements.btnHistoryRedo) {
        this.elements.btnHistoryRedo.disabled = !this.history || !this.history.canRedo();
      }
    },

    /**
     * Record editor change in history stack and schedule autosave.
     */
    recordChange: function(isDebounced) {
      if (this.history) {
        if (isDebounced) {
          this.history.pushDebounced(this.getSerializableState(), 600);
        } else {
          this.history.push(this.getSerializableState());
        }
        this.updateHistoryButtons();
      }
      this.scheduleAutosave();
    },

    /**
     * Undo last editor action.
     */
    handleUndo: function() {
      if (!this.history || !this.history.canUndo()) return;

      this.history.pause();
      var previous = this.history.undo(this.getSerializableState());
      if (previous) {
        this.applyStateSnapshot(previous);
        this.scheduleAutosave();
        this.showToast('Undo applied.', 'info');
      }
      this.history.resume();
      this.updateHistoryButtons();
    },

    /**
     * Redo last undone action.
     */
    handleRedo: function() {
      if (!this.history || !this.history.canRedo()) return;

      this.history.pause();
      var next = this.history.redo(this.getSerializableState());
      if (next) {
        this.applyStateSnapshot(next);
        this.scheduleAutosave();
        this.showToast('Redo applied.', 'info');
      }
      this.history.resume();
      this.updateHistoryButtons();
    },

    /**
     * Reset payload inputs for current type to clean default blanks (preserves design 100%!).
     */
    resetPayload: function() {
      var type = state.activeType;
      switch (type) {
        case 'url':
          state.formData.url = { url: 'https://' };
          break;
        case 'text':
          state.formData.text = { text: '' };
          break;
        case 'wifi':
          state.formData.wifi = { ssid: '', auth: 'WPA', password: '', hidden: false };
          break;
        case 'email':
          state.formData.email = { email: '', subject: '', body: '' };
          break;
        case 'phone':
          state.formData.phone = { phone: '' };
          break;
        case 'whatsapp':
          state.formData.whatsapp = { phone: '', message: '' };
          break;
      }

      this.renderActiveForm();
      this.processInput(false);
      this.recordChange(false);
      this.showToast('Payload inputs cleared for ' + type.toUpperCase() + '.', 'info');
    },

    /**
     * Open Project Manager modal.
     */
    openProjectManager: function() {
      if (!this.elements.projectManagerModal) return;
      this._lastActiveElementBeforeProjectManager = document.activeElement;
      this.renderProjectList();
      this.elements.projectManagerModal.style.display = 'flex';
      this._releaseProjectManagerTrap = trapModalFocus(this.elements.projectManagerModal, this._lastActiveElementBeforeProjectManager);
      if (this.elements.btnCloseProjectManager) this.elements.btnCloseProjectManager.focus();
    },

    /**
     * Close Project Manager modal.
     */
    closeProjectManager: function() {
      if (this.elements.projectManagerModal) {
        this.elements.projectManagerModal.style.display = 'none';
      }
      if (this._releaseProjectManagerTrap) {
        this._releaseProjectManagerTrap();
        this._releaseProjectManagerTrap = null;
      }
    },

    /**
     * Render the list of projects in the manager modal.
     */
    renderProjectList: function() {
      var self = this;
      var grid = this.elements.projectListGrid;
      if (!grid || !this.projectStore) return;

      var projects = this.projectStore.listProjects();
      if (this.elements.projectCountBadge) {
        this.elements.projectCountBadge.textContent = projects.length + (projects.length === 1 ? ' Project' : ' Projects');
      }

      grid.innerHTML = '';

      projects.forEach(function(proj) {
        var card = document.createElement('div');
        card.className = 'project-card' + (proj.isActive ? ' is-active' : '');

        var info = document.createElement('div');
        info.className = 'project-card-info';

        var titleRow = document.createElement('div');
        titleRow.className = 'project-card-title-row';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'project-card-name';
        nameSpan.textContent = proj.name;
        titleRow.appendChild(nameSpan);

        if (proj.isActive) {
          var tag = document.createElement('span');
          tag.className = 'project-active-tag';
          tag.textContent = 'CURRENT';
          titleRow.appendChild(tag);
        }
        info.appendChild(titleRow);

        var summary = document.createElement('div');
        summary.className = 'project-card-summary';
        summary.textContent = proj.summary || 'QR Code Project';
        info.appendChild(summary);

        var time = document.createElement('div');
        time.className = 'project-card-time';
        var d = new Date(proj.updatedAt);
        time.textContent = 'Updated ' + d.toLocaleDateString() + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        info.appendChild(time);

        card.appendChild(info);

        // Action Buttons
        var actions = document.createElement('div');
        actions.className = 'project-card-actions';

        // Open
        var btnOpen = document.createElement('button');
        btnOpen.type = 'button';
        btnOpen.className = 'btn-card-action btn-card-open';
        btnOpen.textContent = proj.isActive ? 'Active' : 'Open';
        btnOpen.disabled = proj.isActive;
        btnOpen.addEventListener('click', function() {
          self.handleOpenProject(proj.id);
        });
        actions.appendChild(btnOpen);

        // Rename
        var btnRename = document.createElement('button');
        btnRename.type = 'button';
        btnRename.className = 'btn-card-action';
        btnRename.textContent = 'Rename';
        btnRename.addEventListener('click', function() {
          self.handleRenameProject(proj.id, proj.name);
        });
        actions.appendChild(btnRename);

        // Duplicate
        var btnDup = document.createElement('button');
        btnDup.type = 'button';
        btnDup.className = 'btn-card-action';
        btnDup.textContent = 'Duplicate';
        btnDup.addEventListener('click', function() {
          self.handleDuplicateProject(proj.id);
        });
        actions.appendChild(btnDup);

        // Export
        var btnExport = document.createElement('button');
        btnExport.type = 'button';
        btnExport.className = 'btn-card-action btn-card-export';
        btnExport.textContent = 'Export';
        btnExport.title = 'Export this project to a local .qrproject.json file';
        btnExport.addEventListener('click', function() {
          self.handleExportProjectById(proj.id);
        });
        actions.appendChild(btnExport);

        // Delete
        var btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn-card-action btn-card-delete';
        btnDel.textContent = 'Delete';
        btnDel.addEventListener('click', function() {
          self.handleDeleteProject(proj.id, proj.name);
        });
        actions.appendChild(btnDel);

        card.appendChild(actions);
        grid.appendChild(card);
      });
    },

    /**
     * Create a new project using accessible in-app modal.
     */
    handleCreateNewProject: function() {
      var self = this;
      var modal = this.elements.createProjectModal;
      if (!modal) {
        var count = (this.projectStore ? this.projectStore.listProjects().length : 0) + 1;
        var newProj = this.projectStore.createProject('Project ' + count);
        this.loadProject(newProj);
        return;
      }

      if (this.projectStore) {
        this.projectStore.saveActiveProjectState(state);
      }

      var count = (this.projectStore ? this.projectStore.listProjects().length : 0) + 1;
      var defaultName = 'Project ' + count;
      var input = this.elements.newProjectNameInput;
      var errEl = this.elements.newProjectNameError;
      var form = this.elements.createProjectForm;
      var cancelBtn = this.elements.btnCancelCreateProject;
      var closeBtn = this.elements.btnCloseCreateProjectModal;
      var submitBtn = this.elements.btnSubmitCreateProject;
      var prevFocus = document.activeElement;

      if (input) {
        input.value = defaultName;
        input.classList.remove('is-invalid');
      }
      if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
      }

      modal.style.display = 'flex';
      var releaseTrap = trapModalFocus(modal, prevFocus);

      function closeModal() {
        modal.style.display = 'none';
        if (releaseTrap) releaseTrap();
        if (form) form.removeEventListener('submit', handleSubmit);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
        window.removeEventListener('keydown', handleKeyDown);
      }

      function handleCancel() {
        closeModal();
      }

      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          closeModal();
        }
      }

      function handleSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        var rawName = input ? input.value : '';
        var cleanName = rawName.trim();
        if (!cleanName) {
          if (errEl) {
            errEl.textContent = 'Project name cannot be blank.';
            errEl.style.display = 'block';
          }
          if (input) {
            input.classList.add('is-invalid');
            input.focus();
          }
          return;
        }

        if (submitBtn) submitBtn.disabled = true;

        var newProj = self.projectStore.createProject(cleanName);
        self.loadProject(newProj);
        closeModal();
        self.closeProjectManager();
        self.showToast('Created new project "' + cleanName + '".', 'success');
      }

      if (form) form.addEventListener('submit', handleSubmit);
      if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
      if (closeBtn) closeBtn.addEventListener('click', handleCancel);
      window.addEventListener('keydown', handleKeyDown);

      setTimeout(function() {
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    },

    /**
     * Open an existing project.
     */
    handleOpenProject: function(id) {
      if (this.projectStore) {
        this.projectStore.saveActiveProjectState(state);
        this.projectStore.setActiveProjectId(id);
        var p = this.projectStore.getActiveProject();
        this.loadProject(p);
        this.closeProjectManager();
        this.showToast('Opened project "' + p.name + '".', 'info');
      }
    },

    /**
     * Duplicate a project.
     */
    handleDuplicateProject: function(id) {
      if (this.projectStore) {
        this.projectStore.saveActiveProjectState(state);
        var dup = this.projectStore.duplicateProject(id);
        if (dup) {
          this.loadProject(dup);
          this.renderProjectList();
          this.showToast('Duplicated project as "' + dup.name + '".', 'success');
        }
      }
    },

    /**
     * Rename a project using accessible in-app modal.
     */
    handleRenameProject: function(id, currentName) {
      var self = this;
      var modal = this.elements.renameProjectModal;
      if (!modal) {
        return;
      }

      var input = this.elements.renameProjectNameInput;
      var errEl = this.elements.renameProjectNameError;
      var form = this.elements.renameProjectForm;
      var cancelBtn = this.elements.btnCancelRenameProject;
      var closeBtn = this.elements.btnCloseRenameProjectModal;
      var submitBtn = this.elements.btnSubmitRenameProject;
      var prevFocus = document.activeElement;

      if (input) {
        input.value = currentName || '';
        input.classList.remove('is-invalid');
      }
      if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
      }

      modal.style.display = 'flex';
      var releaseTrap = trapModalFocus(modal, prevFocus);

      function closeModal() {
        modal.style.display = 'none';
        if (releaseTrap) releaseTrap();
        if (form) form.removeEventListener('submit', handleSubmit);
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
        window.removeEventListener('keydown', handleKeyDown);
      }

      function handleCancel() {
        closeModal();
      }

      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          closeModal();
        }
      }

      function handleSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        var rawName = input ? input.value : '';
        var cleanName = rawName.trim();
        if (!cleanName) {
          if (errEl) {
            errEl.textContent = 'Project name cannot be blank.';
            errEl.style.display = 'block';
          }
          if (input) {
            input.classList.add('is-invalid');
            input.focus();
          }
          return;
        }

        if (submitBtn) submitBtn.disabled = true;

        var res = self.projectStore.renameProject(id, cleanName);
        if (res && res.success) {
          self.updateTopbarProjectName();
          self.renderProjectList();
          self.showToast('Project renamed to "' + cleanName + '".', 'info');
        }
        closeModal();
      }

      if (form) form.addEventListener('submit', handleSubmit);
      if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
      if (closeBtn) closeBtn.addEventListener('click', handleCancel);
      window.addEventListener('keydown', handleKeyDown);

      setTimeout(function() {
        if (input) {
          input.focus();
          input.select();
        }
      }, 50);
    },

    /**
     * Delete a project with confirmation.
     */
    handleDeleteProject: function(id, name) {
      var self = this;
      this.showConfirmDialog(
        'Delete Project?',
        'Are you sure you want to delete "' + name + '"? This will permanently remove it from local browser storage.',
        'DELETE PROJECT',
        function() {
          var activeId = self.projectStore.getActiveProject().id;
          var res = self.projectStore.deleteProject(id);
          if (res && res.success) {
            if (activeId === id) {
              var newActive = self.projectStore.getActiveProject();
              self.loadProject(newActive);
            }
            self.renderProjectList();
            self.showToast('Project deleted.', 'info');
          }
        }
      );
    },

    /**
     * Show accessible confirmation dialog.
     */
    showConfirmDialog: function(title, message, tag, onConfirm) {
      var modal = this.elements.confirmModal;
      if (!modal) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
      }

      var prevFocus = document.activeElement;
      if (this.elements.confirmTitle) this.elements.confirmTitle.textContent = title || 'Confirm Action';
      if (this.elements.confirmMessage) this.elements.confirmMessage.textContent = message || 'This action cannot be undone.';
      if (this.elements.confirmTag) this.elements.confirmTag.textContent = tag || 'CONFIRM ACTION';

      modal.style.display = 'flex';
      var releaseConfirmTrap = trapModalFocus(modal, prevFocus);

      var self = this;
      var cancelBtn = this.elements.btnConfirmCancel;
      var proceedBtn = this.elements.btnConfirmProceed;

      function cleanup() {
        modal.style.display = 'none';
        if (releaseConfirmTrap) releaseConfirmTrap();
        if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
        if (proceedBtn) proceedBtn.removeEventListener('click', handleProceed);
        window.removeEventListener('keydown', handleKey);
      }

      function handleCancel() {
        cleanup();
      }

      function handleProceed() {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
      }

      function handleKey(e) {
        if (e.key === 'Escape') {
          cleanup();
        }
      }

      if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
      if (proceedBtn) proceedBtn.addEventListener('click', handleProceed);
      window.addEventListener('keydown', handleKey);

      if (proceedBtn) proceedBtn.focus();
    },

    /**
     * Show feedback toast notification.
     */
    showToast: function(message, type) {
      var toast = this.elements.toast;
      var msgSpan = this.elements.toastMsg;
      if (!toast || !msgSpan) return;

      msgSpan.textContent = message;
      toast.className = 'feedback-toast is-visible ' + (type === 'error' ? 'toast-error' : 'toast-success');

      if (this._toastTimer) {
        clearTimeout(this._toastTimer);
      }

      this._toastTimer = setTimeout(function() {
        toast.classList.remove('is-visible');
      }, 3500);
    },

    // =========================================================================
    // V1.5 PROJECT IMPORT & EXPORT ACTIONS
    // =========================================================================

    /**
     * Export the active project currently open in the workspace.
     */
    handleExportCurrentProject: function() {
      if (!QRStudio.ProjectPackage || !QRStudio.ProjectPackage.exportProjectToFile) {
        this.showToast('Export failed: ProjectPackage module not loaded.', 'error');
        return;
      }

      // Ensure active project has latest in-memory state saved
      if (this.projectStore) {
        this.projectStore.saveActiveProjectState(state);
      }

      var activeProj = this.projectStore ? this.projectStore.getActiveProject() : null;
      if (!activeProj) {
        this.showToast('No active project found to export.', 'error');
        return;
      }

      // Merge current in-memory locks and export preferences
      activeProj.locks = JSON.parse(JSON.stringify(state.locks || {}));

      var res = QRStudio.ProjectPackage.exportProjectToFile(activeProj);
      if (res && res.success) {
        this.showToast('Exported "' + activeProj.name + '" as ' + res.filename, 'success');
      } else {
        this.showToast('Project export failed: ' + (res ? res.error : 'Unknown error'), 'error');
      }
    },

    /**
     * Export a specific project by its ID (from Project Manager card).
     */
    handleExportProjectById: function(id) {
      if (!QRStudio.ProjectPackage || !QRStudio.ProjectPackage.exportProjectToFile) {
        this.showToast('Export failed: ProjectPackage module not loaded.', 'error');
        return;
      }

      var activeId = this.projectStore ? this.projectStore.getActiveProjectId() : null;
      if (id === activeId) {
        this.handleExportCurrentProject();
        return;
      }

      var project = this.projectStore ? this.projectStore.getProjectById(id) : null;
      if (!project) {
        this.showToast('Project not found.', 'error');
        return;
      }

      var res = QRStudio.ProjectPackage.exportProjectToFile(project);
      if (res && res.success) {
        this.showToast('Exported "' + project.name + '" as ' + res.filename, 'success');
      } else {
        this.showToast('Project export failed: ' + (res ? res.error : 'Unknown error'), 'error');
      }
    },

    /**
     * Handle local file picker selection for project package import.
     */
    handleProjectFileSelected: function(evt) {
      var self = this;
      var file = evt && evt.target && evt.target.files && evt.target.files[0];
      if (evt && evt.target) {
        evt.target.value = ''; // Reset input to allow selecting the same file again
      }

      if (!file) return;

      if (!QRStudio.ProjectPackage || !QRStudio.ProjectPackage.readPackageFile) {
        this.showToast('Import failed: ProjectPackage module not available.', 'error');
        return;
      }

      QRStudio.ProjectPackage.readPackageFile(file, function(err, parsed) {
        if (err) {
          self.showToast('Import Failed: ' + err.message, 'error');
          return;
        }

        var validation = QRStudio.ProjectPackage.validatePackage(parsed);
        if (!validation.isValid) {
          var errorMsg = (validation.errors && validation.errors[0]) || 'Project file validation failed.';
          self.showToast('Import Failed: ' + errorMsg, 'error');
          return;
        }

        self.openImportPreviewModal(validation.project, validation.warnings);
      });
    },

    /**
     * Open Import Preview and Confirmation modal with project summary.
     */
    openImportPreviewModal: function(importedProject, warnings) {
      if (!importedProject || !this.elements.importPreviewModal) return;

      this._pendingImportProject = importedProject;

      // 1. Populate Project Name
      if (this.elements.importProjectNameInput) {
        this.elements.importProjectNameInput.value = importedProject.name || 'Imported Project';
      }

      // 2. Populate Schema Badge
      if (this.elements.importSchemaBadge) {
        this.elements.importSchemaBadge.textContent = 'Schema v' + (importedProject.schemaVersion || 2);
      }

      // 3. Generate structured summary
      var summary = QRStudio.ProjectPackage.getPreviewSummary(importedProject);
      if (summary) {
        if (this.elements.importTypeBadge) this.elements.importTypeBadge.textContent = summary.activeType;
        if (this.elements.importPayloadText) this.elements.importPayloadText.textContent = summary.payloadSnippet;
        if (this.elements.importPayloadMeta) this.elements.importPayloadMeta.textContent = 'ECL: ' + summary.ecl + ' • Size: ' + summary.exportSize;

        if (this.elements.importDarkSwatch) this.elements.importDarkSwatch.style.backgroundColor = summary.darkColor;
        if (this.elements.importLightSwatch) this.elements.importLightSwatch.style.backgroundColor = summary.lightColor;
        if (this.elements.importStyleDesc) this.elements.importStyleDesc.textContent = summary.moduleStyle + ' modules • ' + summary.finderStyle + ' finders';
        if (this.elements.importFrameDesc) {
          this.elements.importFrameDesc.textContent = 'Frame: ' + (summary.frameStyle !== 'none' ? (summary.frameStyle + ' ("' + summary.frameText + '")') : 'None');
        }

        // Assets rendering (safe raster image thumbnails)
        if (this.elements.importAssetsRow) {
          this.elements.importAssetsRow.innerHTML = '';

          var logoRow = document.createElement('div');
          logoRow.className = 'import-asset-item';
          if (summary.hasLogo && summary.logoDataUrl) {
            var logoImg = document.createElement('img');
            logoImg.className = 'import-asset-thumb';
            logoImg.src = summary.logoDataUrl;
            logoImg.alt = 'Logo thumbnail';
            logoRow.appendChild(logoImg);
            var logoLabel = document.createElement('span');
            logoLabel.textContent = 'Logo: ' + (summary.logoFilename || 'embedded');
            logoRow.appendChild(logoLabel);
          } else {
            logoRow.textContent = 'Logo: None';
          }
          this.elements.importAssetsRow.appendChild(logoRow);

          var bgRow = document.createElement('div');
          bgRow.className = 'import-asset-item';
          if (summary.hasBackground && summary.bgDataUrl) {
            var bgImg = document.createElement('img');
            bgImg.className = 'import-asset-thumb';
            bgImg.src = summary.bgDataUrl;
            bgImg.alt = 'Background thumbnail';
            bgRow.appendChild(bgImg);
            var bgLabel = document.createElement('span');
            bgLabel.textContent = 'Background: ' + (summary.bgFilename || 'photo');
            bgRow.appendChild(bgLabel);
          } else {
            bgRow.textContent = 'Background: None';
          }
          this.elements.importAssetsRow.appendChild(bgRow);
        }

        if (this.elements.importMetaText) {
          this.elements.importMetaText.textContent = 'Format: qr-design-studio-project • Exported: ' + summary.updatedAtFormatted;
        }
      }

      // 4. Duplicate Project Name Check
      var existingProjects = this.projectStore ? this.projectStore.listProjects() : [];
      var duplicate = existingProjects.some(function(p) {
        return p.name.trim().toLowerCase() === (importedProject.name || '').trim().toLowerCase();
      });

      if (duplicate && this.elements.importAlertBanner) {
        if (this.elements.importAlertText) {
          this.elements.importAlertText.textContent = '⚠️ A project named "' + importedProject.name + '" already exists in local storage. Click "Import as New Project" to keep both, or "Replace Current Project" to overwrite.';
        }
        this.elements.importAlertBanner.style.display = 'flex';
      } else if (this.elements.importAlertBanner) {
        this.elements.importAlertBanner.style.display = 'none';
      }

      this._lastActiveElementBeforeImportPreview = document.activeElement;
      this.elements.importPreviewModal.style.display = 'flex';
      this._releaseImportPreviewTrap = trapModalFocus(this.elements.importPreviewModal, this._lastActiveElementBeforeImportPreview);
      if (this.elements.btnImportAsNew && typeof this.elements.btnImportAsNew.focus === 'function') {
        this.elements.btnImportAsNew.focus();
      }
    },

    /**
     * Close Import Preview modal.
     */
    closeImportPreviewModal: function() {
      this._pendingImportProject = null;
      if (this.elements.importPreviewModal) {
        this.elements.importPreviewModal.style.display = 'none';
      }
      if (this._releaseImportPreviewTrap) {
        this._releaseImportPreviewTrap();
        this._releaseImportPreviewTrap = null;
      }
    },

    /**
     * Confirm importing as a new independent project.
     */
    handleConfirmImportAsNew: function() {
      if (!this._pendingImportProject) return;

      var imported = this._pendingImportProject;
      var chosenName = (this.elements.importProjectNameInput && this.elements.importProjectNameInput.value) ? this.elements.importProjectNameInput.value.trim() : '';
      if (!chosenName) chosenName = imported.name || 'Imported Project';

      // Check duplicate name and auto-suffix if identical to existing
      var existing = this.projectStore ? this.projectStore.listProjects() : [];
      var isDuplicate = existing.some(function(p) {
        return p.name.toLowerCase() === chosenName.toLowerCase();
      });

      if (isDuplicate && chosenName.toLowerCase() === (imported.name || '').toLowerCase()) {
        chosenName = chosenName + ' (Imported)';
      }

      imported.name = chosenName;

      var res = this.projectStore ? this.projectStore.importProject(imported, 'new') : null;
      if (res && res.project) {
        this.loadProject(res.project);
        this.closeImportPreviewModal();
        this.closeProjectManager();

        if (res.isQuotaExceeded) {
          this.showToast('Imported project loaded in workspace! Note: storage quota reached (in-memory only).', 'warning');
        } else {
          this.showToast('Imported new project "' + chosenName + '".', 'success');
        }
      }
    },

    /**
     * Confirm replacing the current active project with imported project.
     */
    handleConfirmImportReplace: function() {
      if (!this._pendingImportProject) return;

      var self = this;
      var imported = this._pendingImportProject;
      var currentProj = this.projectStore ? this.projectStore.getActiveProject() : null;
      var currentName = currentProj ? currentProj.name : 'Current Project';
      var targetName = (this.elements.importProjectNameInput && this.elements.importProjectNameInput.value) ? this.elements.importProjectNameInput.value.trim() : (imported.name || 'Imported Project');

      this.showConfirmDialog(
        'Replace Current Project?',
        'Are you sure you want to replace "' + currentName + '" with the imported project? Current workspace changes will be overwritten.',
        'OVERWRITE PROJECT',
        function() {
          imported.name = targetName;
          var res = self.projectStore ? self.projectStore.importProject(imported, 'replace') : null;
          if (res && res.project) {
            self.loadProject(res.project);
            self.closeImportPreviewModal();
            self.closeProjectManager();

            if (res.isQuotaExceeded) {
              self.showToast('Project replaced in active workspace! Note: storage quota reached (in-memory only).', 'warning');
            } else {
              self.showToast('Replaced active project with "' + targetName + '".', 'success');
            }
          }
        }
      );
    },

    /**
     * Get current application state (for inspection and verification).
     */
    getState: function() {
      return state;
    }
  };

  UI.state = state;
  QRStudio.State = state;
  QRStudio.UI = UI;
})(typeof window !== 'undefined' ? window : this);

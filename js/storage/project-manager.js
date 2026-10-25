/**
 * QR Design Studio — Project Store & Autosave Manager
 * Manages local browser project storage, active project tracking,
 * project CRUD operations, quota guards, and schema migrations.
 * 100% client-side, zero cloud dependencies.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  var STORAGE_KEY = 'qr_design_studio_projects_v1';
  var ACTIVE_PROJECT_KEY = 'qr_design_studio_active_id_v1';
  var CURRENT_SCHEMA_VERSION = 2;

  // In-memory fallback if localStorage is disabled or throws SecurityError
  var inMemoryStore = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    activeProjectId: null,
    projects: []
  };

  var storageAvailable = null;
  var isQuotaExceeded = false;
  var lastSavedTimestamp = 0;

  /**
   * Helper to check if localStorage is functional.
   */
  function checkStorageAvailability() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      var testKey = '__qr_storage_test__';
      window.localStorage.getItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Produce a clean, serializable clone of editor state for storage.
   * Excludes runtime DOM objects (Image, File, lastValidModel) and keeps base64 data URLs.
   */
  function sanitizeStateForStorage(state) {
    if (!state) return null;

    var sanitized = {
      activeType: state.activeType || 'url',
      ecl: state.ecl || 'M',
      exportSize: state.exportSize || 512,
      activeSubtab: state.activeSubtab || 'subtabTemplates',
      activeTemplateId: state.activeTemplateId || 'classic-minimal',
      templateCategory: state.templateCategory || 'all',
      locks: {
        colors: (state.locks && !!state.locks.colors) || false,
        modules: (state.locks && !!state.locks.modules) || false,
        finders: (state.locks && !!state.locks.finders) || false,
        frame: (state.locks && !!state.locks.frame) || false
      },
      formData: JSON.parse(JSON.stringify(state.formData || {})),
      design: {
        darkColor: state.design ? state.design.darkColor : '#171717',
        lightColor: state.design ? state.design.lightColor : '#FFFFFF',
        moduleStyle: state.design ? state.design.moduleStyle : 'square',
        finderStyle: state.design ? state.design.finderStyle : 'square',
        activePalette: state.design ? state.design.activePalette : 'classic',
        logo: {
          dataUrl: (state.design && state.design.logo) ? (state.design.logo.dataUrl || null) : null,
          filename: (state.design && state.design.logo) ? (state.design.logo.filename || '') : '',
          width: (state.design && state.design.logo) ? (state.design.logo.width || 0) : 0,
          height: (state.design && state.design.logo) ? (state.design.logo.height || 0) : 0,
          sizePercent: (state.design && state.design.logo) ? (state.design.logo.sizePercent || 22) : 22,
          padding: (state.design && state.design.logo) ? (state.design.logo.padding || 6) : 6,
          badgeShape: (state.design && state.design.logo) ? (state.design.logo.badgeShape || 'rounded') : 'rounded',
          badgeColor: (state.design && state.design.logo) ? (state.design.logo.badgeColor || '#FFFFFF') : '#FFFFFF'
        },
        frame: {
          style: (state.design && state.design.frame) ? (state.design.frame.style || 'none') : 'none',
          text: (state.design && state.design.frame) ? (state.design.frame.text || 'SCAN ME') : 'SCAN ME',
          bannerColor: (state.design && state.design.frame) ? (state.design.frame.bannerColor || '#FFE600') : '#FFE600',
          textColor: (state.design && state.design.frame) ? (state.design.frame.textColor || '#171717') : '#171717'
        },
        background: {
          dataUrl: (state.design && state.design.background) ? (state.design.background.dataUrl || null) : null,
          filename: (state.design && state.design.background) ? (state.design.background.filename || '') : '',
          width: (state.design && state.design.background) ? (state.design.background.width || 0) : 0,
          height: (state.design && state.design.background) ? (state.design.background.height || 0) : 0,
          fit: (state.design && state.design.background) ? (state.design.background.fit || 'cover') : 'cover',
          zoom: (state.design && state.design.background) ? (state.design.background.zoom || 1.0) : 1.0,
          panX: (state.design && state.design.background) ? (state.design.background.panX || 0) : 0,
          panY: (state.design && state.design.background) ? (state.design.background.panY || 0) : 0,
          opacity: (state.design && state.design.background) ? (state.design.background.opacity || 1.0) : 1.0,
          tintColor: (state.design && state.design.background) ? (state.design.background.tintColor || '#000000') : '#000000',
          tintOpacity: (state.design && state.design.background) ? (state.design.background.tintOpacity || 0.0) : 0.0
        }
      }
    };

    return sanitized;
  }

  /**
   * Create fresh default project structure.
   */
  function createDefaultProject(name) {
    var now = Date.now();
    var id = 'proj_' + now + '_' + Math.random().toString(36).substring(2, 7);

    return {
      id: id,
      name: name || 'Default Project',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      activeType: 'url',
      ecl: 'M',
      exportSize: 512,
      activeSubtab: 'subtabTemplates',
      activeTemplateId: 'classic-minimal',
      templateCategory: 'all',
      locks: {
        colors: false,
        modules: false,
        finders: false,
        frame: false
      },
      formData: {
        url: { url: 'https://' },
        text: { text: '' },
        wifi: { ssid: '', auth: 'WPA', password: '', hidden: false },
        email: { email: '', subject: '', body: '' },
        phone: { phone: '' },
        whatsapp: { phone: '', message: '' }
      },
      design: {
        darkColor: '#171717',
        lightColor: '#FFFFFF',
        moduleStyle: 'square',
        finderStyle: 'square',
        activePalette: 'classic',
        logo: {
          dataUrl: null,
          filename: '',
          width: 0,
          height: 0,
          sizePercent: 22,
          padding: 6,
          badgeShape: 'rounded',
          badgeColor: '#FFFFFF'
        },
        frame: {
          style: 'none',
          text: 'SCAN ME',
          bannerColor: '#FFE600',
          textColor: '#171717'
        },
        background: {
          dataUrl: null,
          filename: '',
          width: 0,
          height: 0,
          fit: 'cover',
          zoom: 1.0,
          panX: 0,
          panY: 0,
          opacity: 1.0,
          tintColor: '#000000',
          tintOpacity: 0.0
        }
      }
    };
  }

  var ProjectManager = {
    /**
     * Initialize storage and load projects.
     * Guaranteed to return a valid active project.
     */
    init: function() {
      var store = this._readRawStore();

      if (!store || !Array.isArray(store.projects) || store.projects.length === 0) {
        var defaultProj = createDefaultProject('Default Project');
        store = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          activeProjectId: defaultProj.id,
          projects: [defaultProj]
        };
        this._writeRawStore(store);
      } else {
        // Validate activeProjectId
        var found = store.projects.some(function(p) { return p.id === store.activeProjectId; });
        if (!found) {
          store.activeProjectId = store.projects[0].id;
          this._writeRawStore(store);
        }
      }

      return this.getActiveProject();
    },

    /**
     * List all projects sorted by updatedAt descending.
     */
    listProjects: function() {
      var store = this._readRawStore();
      if (!store || !Array.isArray(store.projects)) return [];

      var list = store.projects.map(function(p) {
        var d = new Date(p.updatedAt || Date.now());
        var formatted = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          id: p.id,
          name: p.name || 'Untitled Project',
          createdAt: p.createdAt || Date.now(),
          updatedAt: p.updatedAt || Date.now(),
          updatedAtFormatted: formatted,
          activeType: p.activeType || 'url',
          isActive: p.id === store.activeProjectId,
          summary: ProjectManager._getProjectSummary(p)
        };
      });

      list.sort(function(a, b) { return b.updatedAt - a.updatedAt; });
      return list;
    },

    /**
     * Get the currently active project object.
     */
    getActiveProject: function() {
      var store = this._readRawStore();
      if (!store || !Array.isArray(store.projects) || store.projects.length === 0) {
        var def = createDefaultProject('Default Project');
        return def;
      }

      var active = store.projects.find(function(p) { return p.id === store.activeProjectId; }) || store.projects[0];
      var clone = JSON.parse(JSON.stringify(active));
      return clone;
    },

    /**
     * Set active project ID.
     */
    setActiveProjectId: function(id) {
      var store = this._readRawStore();
      if (!store || !Array.isArray(store.projects)) return false;

      var exists = store.projects.some(function(p) { return p.id === id; });
      if (!exists) return false;

      store.activeProjectId = id;
      return this._writeRawStore(store);
    },

    /**
     * Autosave current editor state into the active project.
     */
    saveActiveProjectState: function(editorState) {
      if (!editorState) return { success: false, reason: 'no_state' };

      var store = this._readRawStore();
      if (!store || !Array.isArray(store.projects)) return { success: false, reason: 'no_store' };

      var activeId = store.activeProjectId;
      var idx = store.projects.findIndex(function(p) { return p.id === activeId; });
      if (idx === -1) idx = 0;

      var existing = store.projects[idx];
      var sanitized = sanitizeStateForStorage(editorState);

      store.projects[idx] = {
        id: existing.id,
        name: existing.name || 'Untitled Project',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: existing.createdAt || Date.now(),
        updatedAt: Date.now(),
        activeType: sanitized.activeType,
        ecl: sanitized.ecl,
        exportSize: sanitized.exportSize,
        activeSubtab: sanitized.activeSubtab,
        activeTemplateId: sanitized.activeTemplateId,
        templateCategory: sanitized.templateCategory,
        locks: sanitized.locks,
        formData: sanitized.formData,
        design: sanitized.design
      };

      var writeResult = this._writeRawStore(store);
      lastSavedTimestamp = Date.now();

      return writeResult;
    },

    /**
     * Create a new project, setting it as active.
     */
    createProject: function(name, optionalSeedState) {
      var store = this._readRawStore();
      var cleanName = (name || '').trim();
      if (!cleanName) {
        var count = (store.projects ? store.projects.length : 0) + 1;
        cleanName = 'Project ' + count;
      }

      var newProject;
      if (optionalSeedState) {
        var sanitized = sanitizeStateForStorage(optionalSeedState);
        var now = Date.now();
        newProject = {
          id: 'proj_' + now + '_' + Math.random().toString(36).substring(2, 7),
          name: cleanName,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: now,
          updatedAt: now,
          activeType: sanitized.activeType,
          ecl: sanitized.ecl,
          exportSize: sanitized.exportSize,
          activeSubtab: sanitized.activeSubtab,
          activeTemplateId: sanitized.activeTemplateId,
          templateCategory: sanitized.templateCategory,
          locks: sanitized.locks,
          formData: sanitized.formData,
          design: sanitized.design
        };
      } else {
        newProject = createDefaultProject(cleanName);
      }

      store.projects.push(newProject);
      store.activeProjectId = newProject.id;
      this._writeRawStore(store);

      return JSON.parse(JSON.stringify(newProject));
    },

    /**
     * Rename an existing project.
     */
    renameProject: function(id, newName) {
      var cleanName = (newName || '').trim();
      if (!cleanName) return { success: false, error: 'Project name cannot be empty.' };

      var store = this._readRawStore();
      var project = store.projects.find(function(p) { return p.id === id; });
      if (!project) return { success: false, error: 'Project not found.' };

      project.name = cleanName;
      project.updatedAt = Date.now();
      var res = this._writeRawStore(store);

      return { success: res.success, name: cleanName };
    },

    /**
     * Duplicate an existing project.
     */
    duplicateProject: function(id) {
      var store = this._readRawStore();
      var source = store.projects.find(function(p) { return p.id === id; });
      if (!source) return null;

      var now = Date.now();
      var clone = JSON.parse(JSON.stringify(source));
      clone.id = 'proj_' + now + '_' + Math.random().toString(36).substring(2, 7);
      clone.name = (source.name || 'Untitled') + ' (Copy)';
      clone.createdAt = now;
      clone.updatedAt = now;

      store.projects.push(clone);
      store.activeProjectId = clone.id;
      this._writeRawStore(store);

      return JSON.parse(JSON.stringify(clone));
    },

    /**
     * Delete a project.
     * Guaranteed never to leave the project list empty (creates fresh default if deleting last project).
     */
    deleteProject: function(id) {
      var store = this._readRawStore();
      var initialCount = store.projects.length;
      store.projects = store.projects.filter(function(p) { return p.id !== id; });

      if (store.projects.length === 0) {
        var fresh = createDefaultProject('Default Project');
        store.projects = [fresh];
        store.activeProjectId = fresh.id;
      } else if (store.activeProjectId === id) {
        // Set most recently updated project as active
        store.projects.sort(function(a, b) { return b.updatedAt - a.updatedAt; });
        store.activeProjectId = store.projects[0].id;
      }

      this._writeRawStore(store);
      return {
        success: true,
        deletedId: id,
        newActiveProjectId: store.activeProjectId
      };
    },

    /**
     * Import a validated project into local storage.
     * Mode: 'new' (appends as new project, generates new ID)
     * Mode: 'replace' (updates existing active/target project in place)
     */
    importProject: function(projectData, mode, targetId) {
      if (!projectData) return { success: false, reason: 'no_data' };

      var store = this._readRawStore();
      if (!store || !Array.isArray(store.projects)) {
        store = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          activeProjectId: null,
          projects: []
        };
      }

      var sanitized = sanitizeStateForStorage(projectData);
      var now = Date.now();
      var cleanName = (projectData.name || 'Imported Project').trim() || 'Imported Project';
      var savedProject;

      if (mode === 'replace') {
        var replaceId = targetId || store.activeProjectId;
        var idx = store.projects.findIndex(function(p) { return p.id === replaceId; });
        if (idx === -1) idx = 0;

        var existing = store.projects[idx] || {};
        savedProject = {
          id: existing.id || ('proj_' + now + '_' + Math.random().toString(36).substring(2, 7)),
          name: cleanName,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: existing.createdAt || now,
          updatedAt: now,
          activeType: sanitized.activeType,
          ecl: sanitized.ecl,
          exportSize: sanitized.exportSize,
          activeSubtab: sanitized.activeSubtab,
          activeTemplateId: sanitized.activeTemplateId,
          templateCategory: sanitized.templateCategory,
          locks: sanitized.locks,
          formData: sanitized.formData,
          design: sanitized.design
        };

        if (store.projects.length === 0) {
          store.projects.push(savedProject);
        } else {
          store.projects[idx] = savedProject;
        }
        store.activeProjectId = savedProject.id;
      } else {
        // mode === 'new'
        var newId = 'proj_' + now + '_' + Math.random().toString(36).substring(2, 7);
        savedProject = {
          id: newId,
          name: cleanName,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          createdAt: now,
          updatedAt: now,
          activeType: sanitized.activeType,
          ecl: sanitized.ecl,
          exportSize: sanitized.exportSize,
          activeSubtab: sanitized.activeSubtab,
          activeTemplateId: sanitized.activeTemplateId,
          templateCategory: sanitized.templateCategory,
          locks: sanitized.locks,
          formData: sanitized.formData,
          design: sanitized.design
        };
        store.projects.push(savedProject);
        store.activeProjectId = newId;
      }

      var writeResult = this._writeRawStore(store);
      lastSavedTimestamp = Date.now();

      return {
        success: true,
        project: JSON.parse(JSON.stringify(savedProject)),
        storageResult: writeResult,
        isQuotaExceeded: isQuotaExceeded
      };
    },

    /**
     * Export a project by ID to a local JSON file package.
     */
    exportProject: function(id, optionalFilename) {
      var project = this.getProjectById(id);
      if (!project) return { success: false, error: 'Project not found.' };

      if (QRStudio.ProjectPackage && QRStudio.ProjectPackage.exportProjectToFile) {
        return QRStudio.ProjectPackage.exportProjectToFile(project, optionalFilename);
      }
      return { success: false, error: 'ProjectPackage module not loaded.' };
    },

    /**
     * Get storage health and status indicator.
     */
    getStorageStatus: function() {
      return {
        isAvailable: checkStorageAvailability(),
        isQuotaExceeded: isQuotaExceeded,
        lastSavedTimestamp: lastSavedTimestamp
      };
    },

    /**
     * Get active project ID directly.
     */
    getActiveProjectId: function() {
      var store = this._readRawStore();
      return store ? store.activeProjectId : null;
    },

    /**
     * Switch active project and return project object.
     */
    switchProject: function(id) {
      this.setActiveProjectId(id);
      return this.getActiveProject();
    },

    /**
     * Get project by ID.
     */
    getProjectById: function(id) {
      var store = this._readRawStore();
      if (!store || !Array.isArray(store.projects)) return null;
      var found = store.projects.find(function(p) { return p.id === id; });
      return found ? JSON.parse(JSON.stringify(found)) : null;
    },

    /**
     * Get clone of all project objects.
     */
    getAllProjects: function() {
      var store = this._readRawStore();
      return store && store.projects ? JSON.parse(JSON.stringify(store.projects)) : [];
    },

    /**
     * Get list of project summaries.
     */
    getProjectSummaries: function() {
      return this.listProjects();
    },

    /**
     * Check storage availability.
     */
    isStorageAvailable: function() {
      return checkStorageAvailability();
    },

    /**
     * Check if storage quota was exceeded.
     */
    isStorageQuotaExceeded: function() {
      return isQuotaExceeded;
    },

    /**
     * Private: Read raw store with fallback.
     */
    _readRawStore: function() {
      if (!checkStorageAvailability()) {
        return inMemoryStore;
      }

      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return inMemoryStore;
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (QRStudio.ProjectPackage && QRStudio.ProjectPackage.sanitizeObjectProperties) {
            parsed = QRStudio.ProjectPackage.sanitizeObjectProperties(parsed);
          }
          if (Array.isArray(parsed.projects)) {
            // Schema migration check for stored projects
            parsed.projects = parsed.projects.map(function(p) {
              if (p.schemaVersion !== CURRENT_SCHEMA_VERSION && QRStudio.ProjectPackage && QRStudio.ProjectPackage.migrateProject) {
                return QRStudio.ProjectPackage.migrateProject(p);
              }
              return p;
            });
            inMemoryStore = parsed;
            return parsed;
          }
        }
        return inMemoryStore;
      } catch (e) {
        console.warn('[QRStudio Storage] Read failure, falling back to in-memory store:', e);
        return inMemoryStore;
      }
    },

    /**
     * Private: Write raw store with quota error handling.
     */
    _writeRawStore: function(store) {
      inMemoryStore = store;
      lastSavedTimestamp = Date.now();

      if (!checkStorageAvailability()) {
        return { success: true, isInMemory: true };
      }

      try {
        var serialized = JSON.stringify(store);
        window.localStorage.setItem(STORAGE_KEY, serialized);
        isQuotaExceeded = false;
        return { success: true };
      } catch (err) {
        // QuotaExceededError or security failure
        console.warn('[QRStudio Storage] Storage write failed (likely quota limit). Falling back safely:', err);
        isQuotaExceeded = true;

        // Attempt recovery: strip large background/logo base64 payloads from storage copy to save project metadata
        try {
          var lightStore = JSON.parse(JSON.stringify(store));
          lightStore.projects.forEach(function(p) {
            if (p.design && p.design.background) p.design.background.dataUrl = null;
            if (p.design && p.design.logo) p.design.logo.dataUrl = null;
          });
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lightStore));
          return { success: true, warning: 'quota_stripped_images', isInMemorySafe: true };
        } catch (recoveryErr) {
          return { success: false, reason: 'quota_full', isInMemorySafe: true };
        }
      }
    },

    /**
     * Private: Format a concise summary of the project's payload.
     */
    _getProjectSummary: function(project) {
      if (!project || !project.formData) return 'Empty payload';
      var type = project.activeType || 'url';
      var f = project.formData[type] || {};

      switch (type) {
        case 'url':
          return f.url ? ('URL • ' + f.url) : 'URL • (empty)';
        case 'text':
          return f.text ? ('Text • ' + f.text.substring(0, 30)) : 'Text • (empty)';
        case 'wifi':
          return f.ssid ? ('Wi-Fi • ' + f.ssid) : 'Wi-Fi • (empty)';
        case 'email':
          return f.email ? ('Email • ' + f.email) : 'Email • (empty)';
        case 'phone':
          return f.phone ? ('Phone • ' + f.phone) : 'Phone • (empty)';
        case 'whatsapp':
          return f.phone ? ('WhatsApp • +' + f.phone) : 'WhatsApp • (empty)';
        default:
          return type.toUpperCase();
      }
    }
  };

  QRStudio.ProjectManager = ProjectManager;

})(typeof window !== 'undefined' ? window : this);

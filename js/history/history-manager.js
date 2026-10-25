/**
 * QR DESIGN STUDIO — Undo & Redo History Manager
 * Tracks meaningful editor states (payloads and designs) with bounded depth,
 * change deduplication, debounced input grouping, and safe restore replay.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  var MAX_HISTORY_DEPTH = 35;

  function cloneSnapshot(snapshot) {
    if (!snapshot) return null;
    return JSON.parse(JSON.stringify(snapshot));
  }

  function areSnapshotsEqual(a, b) {
    if (!a || !b) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  }

  function HistoryManager(maxDepth) {
    this.maxDepth = maxDepth || MAX_HISTORY_DEPTH;
    this.undoStack = [];
    this.redoStack = [];
    this.isPaused = false;
    this._debounceTimer = null;
    this._pendingSnapshot = null;
  }

  HistoryManager.prototype = {
    /**
     * Push a new state snapshot to the undo stack.
     * Clears redo stack and enforces max history depth.
     */
    push: function(snapshot) {
      if (this.isPaused || !snapshot) return;

      // Cancel any pending debounced push
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
        this._pendingSnapshot = null;
      }

      var clone = cloneSnapshot(snapshot);

      // Avoid duplicate consecutive entries
      if (this.undoStack.length > 0) {
        var top = this.undoStack[this.undoStack.length - 1];
        if (areSnapshotsEqual(top, clone)) {
          return;
        }
      }

      this.undoStack.push(clone);

      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }

      // Any new modification invalidates redo branch
      this.redoStack = [];
    },

    /**
     * Debounced push for rapid keystrokes in form text inputs.
     * Groups keystrokes that happen within delayMs (default 600ms).
     */
    pushDebounced: function(snapshot, delayMs) {
      if (this.isPaused || !snapshot) return;

      var self = this;
      var delay = delayMs || 600;
      this._pendingSnapshot = cloneSnapshot(snapshot);

      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
      }

      this._debounceTimer = setTimeout(function() {
        if (self._pendingSnapshot) {
          self.push(self._pendingSnapshot);
          self._pendingSnapshot = null;
        }
        self._debounceTimer = null;
      }, delay);
    },

    /**
     * Flush any pending debounced state immediately.
     */
    flushDebounce: function() {
      if (this._debounceTimer && this._pendingSnapshot) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
        this.push(this._pendingSnapshot);
        this._pendingSnapshot = null;
      }
    },

    /**
     * Perform Undo:
     * Pops active state from undoStack, pushes to redoStack, and returns previous state.
     */
    undo: function(currentState) {
      this.flushDebounce();

      if (this.undoStack.length <= 1) {
        return null;
      }

      var activeState = this.undoStack.pop();
      this.redoStack.push(activeState);

      var previousState = this.undoStack[this.undoStack.length - 1];
      return cloneSnapshot(previousState);
    },

    /**
     * Perform Redo:
     * Pops next state from redoStack, pushes back to undoStack, and returns next state.
     */
    redo: function(currentState) {
      this.flushDebounce();

      if (this.redoStack.length === 0) {
        return null;
      }

      var nextState = this.redoStack.pop();
      this.undoStack.push(nextState);

      return cloneSnapshot(nextState);
    },

    /**
     * Check if undo is available. Need at least 2 states (baseline + 1 change) or pending debounce.
     */
    canUndo: function() {
      return this.undoStack.length > 1 || !!this._pendingSnapshot;
    },

    /**
     * Check if redo is available.
     */
    canRedo: function() {
      return this.redoStack.length > 0;
    },

    /**
     * Return current undo stack depth.
     */
    getStackDepth: function() {
      return this.undoStack.length;
    },

    /**
     * Clear all history stacks (e.g., when switching active project).
     */
    clear: function() {
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      this._pendingSnapshot = null;
      this.undoStack = [];
      this.redoStack = [];
    },

    /**
     * Pause recording (useful during undo/redo replay or project load).
     */
    pause: function() {
      this.isPaused = true;
    },

    /**
     * Resume recording.
     */
    resume: function() {
      this.isPaused = false;
    }
  };

  QRStudio.HistoryManager = HistoryManager;

})(typeof window !== 'undefined' ? window : this);

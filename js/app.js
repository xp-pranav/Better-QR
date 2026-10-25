/**
 * QR Design Studio — Application Bootstrapper
 * Initializes the studio interface upon DOMContentLoaded.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  function initApp() {
    try {
      if (QRStudio.UI && typeof QRStudio.UI.init === 'function') {
        QRStudio.UI.init();
      }
      if (QRStudio.PrintUI && typeof QRStudio.PrintUI.init === 'function') {
        QRStudio.PrintUI.init();
      }
      if (QRStudio.BulkUI && typeof QRStudio.BulkUI.init === 'function') {
        QRStudio.BulkUI.init();
      }
    } catch (err) {
      console.error('Fatal initialization error in Better QR:', err);
      var banner = document.getElementById('warningBanner');
      var bannerText = document.getElementById('warningText');
      if (banner && bannerText) {
        bannerText.textContent = 'Application initialization error: ' + (err.message || String(err));
        banner.classList.add('is-visible');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})(typeof window !== 'undefined' ? window : this);

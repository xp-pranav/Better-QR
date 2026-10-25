/**
 * QR Design Studio — PNG Exporter
 * Generates high-resolution PNG exports from QR matrix with full quiet zone
 * and sanitized filenames.
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Helper to format a safe, readable filename.
   */
  function buildFilename(typeId) {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var dateStr = year + month + day;
    var sanitizedType = (typeId || 'code').toLowerCase().replace(/[^a-z0-9]/g, '-');
    return 'qr-' + sanitizedType + '-' + dateStr + '.png';
  }

  var Exporter = {
    /**
     * Export a QR model as a PNG image download.
     * @param {Object} qrModel - Generated QR model from QRStudio.Engine.
     * @param {Object} [options] - Export options.
     * @param {number} [options.size=512] - Target pixel size (width and height).
     * @param {string} [options.typeId='code'] - Payload type for filename generation.
     * @param {string} [options.customFilename] - Optional override filename.
     * @returns {Promise<void>} Resolves when download is triggered.
     */
    exportPNG: function(qrModel, options) {
      if (QRStudio.ExportStudio && QRStudio.ExportStudio !== Exporter) {
        return QRStudio.ExportStudio.exportPNG(qrModel, options);
      }
      return new Promise(function(resolve, reject) {
        if (!qrModel) {
          return reject(new Error('No valid QR code available to export.'));
        }

        options = options || {};
        var targetSize = parseInt(options.size, 10) || 512;
        var filename = options.customFilename || buildFilename(options.typeId);

        try {
          // Create offscreen canvas for rendering at export resolution
          var offscreen = document.createElement('canvas');
          QRStudio.Engine.renderComposition(qrModel, offscreen, {
            size: targetSize,
            margin: 4, // Strict 4-module quiet zone
            darkColor: options.darkColor || '#000000',
            lightColor: options.lightColor || '#FFFFFF',
            moduleStyle: options.moduleStyle || 'square',
            finderStyle: options.finderStyle || 'square',
            logo: options.logo,
            background: options.background,
            frame: options.frame
          });

          // Check if toBlob is available
          if (offscreen.toBlob) {
            offscreen.toBlob(function(blob) {
              if (!blob) {
                // Fallback to toDataURL if blob creation returned null
                try {
                  var dataUrl = offscreen.toDataURL('image/png');
                  Exporter._triggerDownload(dataUrl, filename);
                  resolve();
                } catch (dataUrlErr) {
                  reject(new Error('Could not generate PNG data: ' + (dataUrlErr.message || dataUrlErr)));
                }
                return;
              }

              var blobUrl = URL.createObjectURL(blob);
              Exporter._triggerDownload(blobUrl, filename);
              // Revoke URL after download initiates
              setTimeout(function() {
                URL.revokeObjectURL(blobUrl);
              }, 2000);
              resolve();
            }, 'image/png');
          } else {
            // Fallback for older environments
            var dataUrl = offscreen.toDataURL('image/png');
            Exporter._triggerDownload(dataUrl, filename);
            resolve();
          }
        } catch (err) {
          reject(new Error('Export failed: ' + (err.message || String(err))));
        }
      });
    },

    /**
     * Trigger browser file download via temporary anchor element.
     */
    _triggerDownload: function(url, filename) {
      var a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  QRStudio.Exporter = Exporter;
})(typeof window !== 'undefined' ? window : this);

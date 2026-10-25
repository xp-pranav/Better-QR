/**
 * QR Design Studio — Payload Validators & Formatters
 * Implements validation, escaping, and standard QR payload generation for:
 * 1. URL
 * 2. Plain Text
 * 3. Wi-Fi (ZXing / MeCard standard)
 * 4. Email (mailto URI standard)
 * 5. Phone (tel URI standard)
 * 6. WhatsApp (wa.me click-to-chat standard)
 */

(function(window) {
  'use strict';

  var QRStudio = window.QRStudio = window.QRStudio || {};

  /**
   * Helper to escape special characters for Wi-Fi payloads per MeCard/ZXing format.
   * Special characters: \, ;, ,, :, " must be preceded by \
   */
  function escapeWifiString(str) {
    if (!str) return '';
    return str.replace(/([\\;,:"])/g, '\\$1');
  }

  var Payloads = {
    types: {
      url: {
        id: 'url',
        label: 'Website URL',
        shortLabel: 'URL',
        description: 'Link to any website, landing page, or web resource.',
        icon: '<svg viewBox="0 0 24 24" class="tab-icon"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        fields: [
          {
            name: 'url',
            label: 'Website Address (URL)',
            type: 'url',
            placeholder: 'https://example.com',
            required: true,
            hint: 'Include protocol (https:// or http://). Example: https://mybusiness.com'
          }
        ],
        validate: function(data) {
          var errors = {};
          var raw = (data.url || '').trim();

          if (!raw) {
            errors.url = 'URL is required.';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Check for missing protocol
          var hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(raw);
          if (!hasProtocol) {
            errors.url = 'Missing URL protocol. Please prepend https:// or http://';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Explain unsupported schemes per QR specifications
          if (!/^https?:\/\//i.test(raw)) {
            errors.url = 'Unsupported URL scheme. Please use https:// or http://';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Check for empty protocol prefix
          if (raw === 'https://' || raw === 'http://') {
            errors.url = 'Please enter a valid, well-formed URL.';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Check for valid URL structure
          try {
            var URLConstructor = typeof URL !== 'undefined' ? URL : (typeof window !== 'undefined' ? window.URL : null);
            if (URLConstructor) {
              var parsed = new URLConstructor(raw);
              if (!parsed.hostname || (parsed.hostname.indexOf('.') === -1 && parsed.hostname !== 'localhost')) {
                errors.url = 'Please enter a valid domain name (e.g. example.com).';
                return { isValid: false, errors: errors, payload: '' };
              }
            } else {
              if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(raw)) {
                errors.url = 'Please enter a valid, well-formed URL.';
                return { isValid: false, errors: errors, payload: '' };
              }
            }
          } catch (e) {
            errors.url = 'Please enter a valid, well-formed URL.';
            return { isValid: false, errors: errors, payload: '' };
          }

          return {
            isValid: true,
            errors: {},
            payload: raw,
            summary: raw
          };
        }
      },

      text: {
        id: 'text',
        label: 'Plain Text',
        shortLabel: 'Text',
        description: 'Display plain text, notes, or Unicode characters when scanned.',
        icon: '<svg viewBox="0 0 24 24" class="tab-icon"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>',
        fields: [
          {
            name: 'text',
            label: 'Message / Content',
            type: 'textarea',
            placeholder: 'Type or paste any text or Unicode content here...',
            required: true,
            hint: 'Preserves exact lines, accents, and symbols.'
          }
        ],
        validate: function(data) {
          var errors = {};
          var raw = data.text;

          if (raw === undefined || raw === null || raw.trim().length === 0) {
            errors.text = 'Text content cannot be empty.';
            return { isValid: false, errors: errors, payload: '' };
          }

          return {
            isValid: true,
            errors: {},
            payload: raw,
            summary: raw.length > 50 ? raw.substring(0, 50) + '...' : raw
          };
        }
      },

      wifi: {
        id: 'wifi',
        label: 'Wi-Fi Network',
        shortLabel: 'Wi-Fi',
        description: 'Allow devices to connect directly to a Wi-Fi network upon scanning.',
        icon: '<svg viewBox="0 0 24 24" class="tab-icon"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
        fields: [
          {
            name: 'ssid',
            label: 'Network Name (SSID)',
            type: 'text',
            placeholder: 'e.g. Studio_Guest_5G',
            required: true,
            hint: 'The exact name of your Wi-Fi network (case-sensitive).'
          },
          {
            name: 'auth',
            label: 'Security Encryption',
            type: 'select',
            required: true,
            options: [
              { value: 'WPA', label: 'WPA / WPA2 / WPA3 (Standard)' },
              { value: 'WEP', label: 'WEP (Legacy)' },
              { value: 'nopass', label: 'None / Open Network' }
            ],
            defaultValue: 'WPA'
          },
          {
            name: 'password',
            label: 'Network Password',
            type: 'password',
            placeholder: 'Enter Wi-Fi password',
            required: true,
            hint: 'Minimum 8 characters for WPA/WPA2/WPA3 networks.'
          },
          {
            name: 'hidden',
            label: 'Hidden network (SSID is not broadcast)',
            type: 'checkbox',
            required: false,
            defaultValue: false
          }
        ],
        validate: function(data) {
          var errors = {};
          var ssid = (data.ssid || '').trim();
          var auth = data.auth || 'WPA';
          var password = data.password || '';
          var hidden = !!data.hidden;

          if (!ssid) {
            errors.ssid = 'Network name (SSID) is required.';
          } else if (ssid.length > 32) {
            errors.ssid = 'SSID must not exceed 32 characters.';
          }

          if (auth !== 'nopass') {
            if (!password) {
              errors.password = 'Password is required for encrypted networks.';
            } else if (auth === 'WPA') {
              var isHex64 = (password.length === 64 && /^[0-9a-fA-F]{64}$/.test(password));
              var isAsciiPass = (password.length >= 8 && password.length <= 63);
              if (!isAsciiPass && !isHex64) {
                errors.password = 'WPA/WPA2/WPA3 passwords must be 8–63 characters, or 64 hex digits.';
              }
            } else if (auth === 'WEP') {
              var isHex = /^[0-9a-fA-F]+$/.test(password);
              var validAscii = (password.length === 5 || password.length === 13);
              var validHex = isHex && (password.length === 10 || password.length === 26);
              if (!validAscii && !validHex) {
                errors.password = 'WEP key must be 5 or 13 ASCII characters, or 10 or 26 hex digits.';
              }
            }
          }

          if (Object.keys(errors).length > 0) {
            return { isValid: false, errors: errors, payload: '' };
          }

          // Construct standard ZXing Wi-Fi payload
          // Format: WIFI:T:<auth>;S:<escaped_ssid>;P:<escaped_pass>;H:<hidden>;;
          var escSsid = escapeWifiString(ssid);
          var payload;
          if (auth === 'nopass') {
            payload = 'WIFI:T:nopass;S:' + escSsid + ';H:' + (hidden ? 'true' : 'false') + ';;';
          } else {
            var escPass = escapeWifiString(password);
            payload = 'WIFI:T:' + auth + ';S:' + escSsid + ';P:' + escPass + ';H:' + (hidden ? 'true' : 'false') + ';;';
          }

          return {
            isValid: true,
            errors: {},
            payload: payload,
            summary: 'Wi-Fi: ' + ssid + ' (' + auth + (hidden ? ', Hidden' : '') + ')'
          };
        }
      },

      email: {
        id: 'email',
        label: 'Email Message',
        shortLabel: 'Email',
        description: 'Open a pre-addressed email draft with subject and body.',
        icon: '<svg viewBox="0 0 24 24" class="tab-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
        fields: [
          {
            name: 'email',
            label: 'Recipient Email Address',
            type: 'email',
            placeholder: 'contact@example.com',
            required: true,
            hint: 'Example: hello@company.com'
          },
          {
            name: 'subject',
            label: 'Subject Line (Optional)',
            type: 'text',
            placeholder: 'Inquiry regarding...',
            required: false
          },
          {
            name: 'body',
            label: 'Message Body (Optional)',
            type: 'textarea',
            placeholder: 'Write your message here...',
            required: false
          }
        ],
        validate: function(data) {
          var errors = {};
          var email = (data.email || '').replace(/^mailto:/i, '').trim();
          var subject = (data.subject || '').trim();
          var body = (data.body || '').trim();

          // Standard RFC 5322 compatible email regex
          var emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

          if (!email) {
            errors.email = 'Recipient email address is required.';
          } else if (!emailRegex.test(email)) {
            errors.email = 'Please enter a valid email address (e.g. name@domain.com).';
          }

          if (Object.keys(errors).length > 0) {
            return { isValid: false, errors: errors, payload: '' };
          }

          var params = [];
          if (subject) params.push('subject=' + encodeURIComponent(subject));
          if (body) params.push('body=' + encodeURIComponent(body));

          var payload = 'mailto:' + email + (params.length > 0 ? '?' + params.join('&') : '');

          return {
            isValid: true,
            errors: {},
            payload: payload,
            summary: 'Mail to: ' + email + (subject ? ' — ' + subject : '')
          };
        }
      },

      phone: {
        id: 'phone',
        label: 'Phone Call',
        shortLabel: 'Phone',
        description: 'Dial a phone number directly when scanned on mobile devices.',
        icon: '<svg viewBox="0 0 24 24" class="tab-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
        fields: [
          {
            name: 'phone',
            label: 'Phone Number',
            type: 'tel',
            placeholder: '+1 (555) 234-5678',
            required: true,
            hint: 'Include country code if calling internationally. Example: +1-555-0199'
          }
        ],
        validate: function(data) {
          var errors = {};
          var raw = (data.phone || '').replace(/^tel:/i, '').trim();

          if (!raw) {
            errors.phone = 'Phone number is required.';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Verify it contains reasonable phone characters: digits, +, -, (, ), space, dots
          var validChars = /^[+]?[\d\s\-().]{3,25}$/.test(raw);
          var digitCount = (raw.match(/\d/g) || []).length;

          if (!validChars || digitCount < 3) {
            errors.phone = 'Please enter a valid telephone number containing at least 3 digits.';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Build standard tel URI
          var payload = 'tel:' + raw;

          return {
            isValid: true,
            errors: {},
            payload: payload,
            summary: 'Call: ' + raw
          };
        }
      },

      whatsapp: {
        id: 'whatsapp',
        label: 'WhatsApp Chat',
        shortLabel: 'WhatsApp',
        description: 'Initiate a direct WhatsApp conversation with an optional pre-filled message.',
        icon: '<svg viewBox="0 0 24 24" class="tab-icon"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
        fields: [
          {
            name: 'phone',
            label: 'WhatsApp Phone Number',
            type: 'tel',
            placeholder: '15551234567',
            required: true,
            hint: 'Country code + number (digits only, no + or 00). E.g., 15551234567 for US, 447123456789 for UK.'
          },
          {
            name: 'message',
            label: 'Pre-filled Message (Optional)',
            type: 'textarea',
            placeholder: 'Hi! I scanned your QR code and would like more details...',
            required: false,
            hint: 'This text will be inserted into the chat when the user scans.'
          }
        ],
        validate: function(data) {
          var errors = {};
          var phoneRaw = (data.phone || '').trim();
          var message = (data.message || '').trim();

          if (!phoneRaw) {
            errors.phone = 'WhatsApp phone number is required.';
            return { isValid: false, errors: errors, payload: '' };
          }

          // Strip non-digits
          var digits = phoneRaw.replace(/\D/g, '');

          // Check for leading '+' or '00' stripped
          if (phoneRaw.startsWith('+')) {
            digits = phoneRaw.substring(1).replace(/\D/g, '');
          } else if (digits.startsWith('00')) {
            digits = digits.substring(2);
          }

          if (!digits) {
            errors.phone = 'WhatsApp phone number is required.';
            return { isValid: false, errors: errors, payload: '' };
          }

          if (digits.startsWith('0')) {
            errors.phone = 'Please include country code without leading zero (e.g. 1 for US, 44 for UK, 91 for India).';
            return { isValid: false, errors: errors, payload: '' };
          }

          if (digits.length < 7 || digits.length > 15) {
            errors.phone = 'Enter a valid international phone number with country code (7–15 digits).';
            return { isValid: false, errors: errors, payload: '' };
          }

          var payload = 'https://wa.me/' + digits;
          if (message) {
            payload += '?text=' + encodeURIComponent(message);
          }

          return {
            isValid: true,
            errors: {},
            payload: payload,
            summary: 'WhatsApp: +' + digits + (message ? ' ("' + (message.length > 30 ? message.substring(0, 30) + '...' : message) + '")' : '')
          };
        }
      }
    },

    /**
     * Get a registered payload type by ID.
     */
    getType: function(typeId) {
      return this.types[typeId] || null;
    },

    /**
     * List all 6 payload type descriptors.
     */
    listTypes: function() {
      var self = this;
      return Object.keys(this.types).map(function(key) {
        return self.types[key];
      });
    }
  };

  QRStudio.Payloads = Payloads;
})(typeof window !== 'undefined' ? window : this);

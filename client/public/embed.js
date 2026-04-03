/**
 * ClientFlow Booking Widget — embed.js
 *
 * Usage (inline):
 *   <div id="cf-booking"></div>
 *   <script src="https://yourapp.com/embed.js"
 *     data-slug="my-schedule"
 *     data-container="#cf-booking">
 *   </script>
 *
 * Usage (modal button):
 *   <script src="https://yourapp.com/embed.js"
 *     data-slug="my-schedule"
 *     data-trigger="#book-now"
 *     data-button-text="Book a Call">
 *   </script>
 *
 * Optional attributes:
 *   data-slug           — required: the schedule public link
 *   data-container      — CSS selector for inline embed target (default: auto-creates one)
 *   data-trigger        — CSS selector for an existing button to open modal
 *   data-button-text    — text for auto-created button (default: "Book Now")
 *   data-button-color   — hex colour for auto-created button (default: #2563eb)
 *   data-height         — fixed pixel height for inline iframe (default: auto-resize)
 */
(function () {
  'use strict';

  var script = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var slug = script.getAttribute('data-slug');
  if (!slug) { console.error('[ClientFlow] data-slug is required'); return; }

  var origin = script.src.replace(/\/embed\.js.*$/, '');
  var bookingUrl = origin + '/book/' + slug + '?embed=1';
  var containerSelector = script.getAttribute('data-container');
  var triggerSelector = script.getAttribute('data-trigger');
  var buttonText = script.getAttribute('data-button-text') || 'Book Now';
  var buttonColor = script.getAttribute('data-button-color') || '#2563eb';
  var fixedHeight = script.getAttribute('data-height');

  /* ─── Styles ──────────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '.cf-widget-iframe { border: none; width: 100%; display: block; }',
    '.cf-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5);',
    '  z-index: 99998; align-items: center; justify-content: center; }',
    '.cf-modal-overlay.cf-open { display: flex; }',
    '.cf-modal-box { background: #fff; border-radius: 12px; width: min(640px, 95vw);',
    '  max-height: 92vh; overflow: hidden; display: flex; flex-direction: column;',
    '  box-shadow: 0 20px 60px rgba(0,0,0,.25); }',
    '.cf-modal-header { display: flex; align-items: center; justify-content: flex-end;',
    '  padding: 10px 14px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }',
    '.cf-modal-close { background: none; border: none; cursor: pointer; font-size: 22px;',
    '  color: #6b7280; line-height: 1; padding: 2px 6px; }',
    '.cf-modal-close:hover { color: #111; }',
    '.cf-modal-iframe-wrap { overflow-y: auto; flex: 1; }',
  ].join('\n');
  document.head.appendChild(style);

  /* ─── Create iframe ───────────────────────────────────────────────────── */
  function createIframe() {
    var iframe = document.createElement('iframe');
    iframe.src = bookingUrl;
    iframe.className = 'cf-widget-iframe';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'Book an appointment');
    if (fixedHeight) {
      iframe.style.height = fixedHeight + 'px';
    } else {
      iframe.style.height = '600px'; // sensible initial height
    }
    return iframe;
  }

  /* ─── Auto-resize from postMessage ───────────────────────────────────── */
  var managedIframes = [];
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'clientflow:resize') return;
    managedIframes.forEach(function (iframe) {
      try {
        if (iframe.contentWindow === e.source && !fixedHeight) {
          var h = Math.max(400, e.data.height || 0);
          iframe.style.height = h + 'px';
        }
      } catch (_) {}
    });
  });

  /* ─── Modal mode ──────────────────────────────────────────────────────── */
  function buildModal() {
    var overlay = document.createElement('div');
    overlay.className = 'cf-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var box = document.createElement('div');
    box.className = 'cf-modal-box';

    var header = document.createElement('div');
    header.className = 'cf-modal-header';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'cf-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close booking widget');

    var wrap = document.createElement('div');
    wrap.className = 'cf-modal-iframe-wrap';

    var iframe = createIframe();
    managedIframes.push(iframe);

    // On booking completion, close modal after a short delay
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'clientflow:booked' && iframe.contentWindow === e.source) {
        setTimeout(function () { closeModal(); }, 2500);
      }
    });

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    function closeModal() {
      overlay.classList.remove('cf-open');
      document.body.style.overflow = '';
    }

    header.appendChild(closeBtn);
    wrap.appendChild(iframe);
    box.appendChild(header);
    box.appendChild(wrap);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    return function openModal() {
      overlay.classList.add('cf-open');
      document.body.style.overflow = 'hidden';
    };
  }

  /* ─── Inline mode ─────────────────────────────────────────────────────── */
  function buildInline(container) {
    var iframe = createIframe();
    managedIframes.push(iframe);
    container.appendChild(iframe);
  }

  /* ─── Init ────────────────────────────────────────────────────────────── */
  function init() {
    if (triggerSelector) {
      // Modal mode
      var openModal = buildModal();
      var triggers = document.querySelectorAll(triggerSelector);
      triggers.forEach(function (el) {
        el.addEventListener('click', openModal);
      });
      if (triggers.length === 0) {
        // Auto-create a button if selector matched nothing
        var btn = document.createElement('button');
        btn.textContent = buttonText;
        btn.style.cssText = [
          'background:' + buttonColor,
          'color:#fff',
          'border:none',
          'border-radius:8px',
          'padding:12px 24px',
          'font-size:16px',
          'font-weight:600',
          'cursor:pointer',
          'font-family:inherit',
        ].join(';');
        btn.addEventListener('click', openModal);
        script.parentNode.insertBefore(btn, script.nextSibling);
      }
    } else if (containerSelector) {
      var container = document.querySelector(containerSelector);
      if (container) buildInline(container);
    } else {
      // Default: inject inline right after the script tag
      var wrapper = document.createElement('div');
      script.parentNode.insertBefore(wrapper, script.nextSibling);
      buildInline(wrapper);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

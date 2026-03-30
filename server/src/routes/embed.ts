import { Router } from 'express';

const router = Router();

/**
 * GET /embed.js
 *
 * Self-contained embeddable widget script for external websites.
 * Works via a single <script> tag — designed for Squarespace, Wix, WordPress, Showit etc.
 *
 * Usage on external site:
 *   <div data-crm-form="my-form-slug"></div>
 *   <script src="https://app.clientflow.com/embed.js" data-slug="my-form-slug" async></script>
 */
router.get('/embed.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.set('Access-Control-Allow-Origin', '*'); // Allow embedding from any domain

  // The base URL is derived from the request
  const protocol = _req.protocol;
  const host = _req.get('host');
  const baseUrl = `${protocol}://${host}`;

  res.send(getEmbedScript(baseUrl));
});

function getEmbedScript(baseUrl: string): string {
  return `
(function() {
  'use strict';

  // Prevent double-loading
  if (window.__clientflow_embed_loaded) return;
  window.__clientflow_embed_loaded = true;

  var BASE_URL = '${baseUrl}';

  // Find the script tag to get the slug
  var scripts = document.querySelectorAll('script[data-slug]');
  var containers = document.querySelectorAll('[data-crm-form]');

  // Get slug from either the script tag or a container element
  function getSlug() {
    for (var i = 0; i < scripts.length; i++) {
      var slug = scripts[i].getAttribute('data-slug');
      if (slug) return slug;
    }
    for (var i = 0; i < containers.length; i++) {
      var slug = containers[i].getAttribute('data-crm-form');
      if (slug) return slug;
    }
    return null;
  }

  var slug = getSlug();
  if (!slug) {
    console.error('[ClientFlow] No form slug found. Add data-slug to your script tag or data-crm-form to a container element.');
    return;
  }

  // Find or create the container
  function getContainer() {
    var existing = document.querySelector('[data-crm-form="' + slug + '"]');
    if (existing) return existing;

    // If no container exists, create one before the script tag
    var scriptTag = document.querySelector('script[data-slug="' + slug + '"]');
    if (scriptTag && scriptTag.parentNode) {
      var div = document.createElement('div');
      div.setAttribute('data-crm-form', slug);
      scriptTag.parentNode.insertBefore(div, scriptTag);
      return div;
    }
    return null;
  }

  var container = getContainer();
  if (!container) {
    console.error('[ClientFlow] Could not find or create form container.');
    return;
  }

  // Inject minimal reset styles
  var style = document.createElement('style');
  style.textContent = [
    '.cf-embed-form { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 560px; margin: 0 auto; }',
    '.cf-embed-form * { box-sizing: border-box; }',
    '.cf-embed-form .cf-field { margin-bottom: 16px; }',
    '.cf-embed-form label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #374151; }',
    '.cf-embed-form input, .cf-embed-form select, .cf-embed-form textarea { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; line-height: 1.5; color: #111827; background: #fff; transition: border-color 0.15s; }',
    '.cf-embed-form input:focus, .cf-embed-form select:focus, .cf-embed-form textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }',
    '.cf-embed-form textarea { resize: vertical; min-height: 80px; }',
    '.cf-embed-form .cf-required { color: #ef4444; }',
    '.cf-embed-form .cf-consent { display: flex; align-items: flex-start; gap: 8px; margin: 16px 0; font-size: 13px; color: #6b7280; }',
    '.cf-embed-form .cf-consent input[type="checkbox"] { width: auto; margin-top: 2px; }',
    '.cf-embed-form .cf-submit { width: 100%; padding: 12px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.15s; }',
    '.cf-embed-form .cf-submit:hover { background: #4338ca; }',
    '.cf-embed-form .cf-submit:disabled { background: #9ca3af; cursor: not-allowed; }',
    '.cf-embed-form .cf-error { color: #ef4444; font-size: 12px; margin-top: 4px; }',
    '.cf-embed-form .cf-success { text-align: center; padding: 32px 16px; }',
    '.cf-embed-form .cf-success h3 { font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px; }',
    '.cf-embed-form .cf-success p { color: #6b7280; margin: 0; }',
    '.cf-embed-form .cf-loading { text-align: center; padding: 32px; color: #9ca3af; }',
    '.cf-embed-form .cf-privacy { font-size: 12px; color: #9ca3af; margin-top: 12px; text-align: center; }',
    '.cf-embed-form .cf-privacy a { color: #6366f1; text-decoration: none; }',
    '.cf-embed-form .cf-honeypot { position: absolute; left: -9999px; opacity: 0; height: 0; width: 0; overflow: hidden; }'
  ].join('\\n');
  document.head.appendChild(style);

  // Fetch form config and render
  container.innerHTML = '<div class="cf-embed-form"><div class="cf-loading">Loading form...</div></div>';

  fetch(BASE_URL + '/api/leads/public/' + slug)
    .then(function(r) { return r.json(); })
    .then(function(data) { renderForm(container, data, slug); })
    .catch(function(err) {
      console.error('[ClientFlow] Failed to load form:', err);
      container.innerHTML = '<div class="cf-embed-form"><div class="cf-error">Unable to load enquiry form. Please try again later.</div></div>';
    });

  function renderForm(container, data, slug) {
    var form = data.form;
    var questions = data.questions || [];
    var wrapper = document.createElement('div');
    wrapper.className = 'cf-embed-form';

    var formEl = document.createElement('form');
    formEl.setAttribute('novalidate', '');

    // Honeypot field (spam protection)
    var honeypot = document.createElement('div');
    honeypot.className = 'cf-honeypot';
    honeypot.innerHTML = '<input type="text" name="website_url" tabindex="-1" autocomplete="off" />';
    formEl.appendChild(honeypot);

    // Render each question
    questions.forEach(function(q) {
      var field = document.createElement('div');
      field.className = 'cf-field';

      var label = document.createElement('label');
      label.textContent = q.label;
      if (q.required) {
        var req = document.createElement('span');
        req.className = 'cf-required';
        req.textContent = ' *';
        label.appendChild(req);
      }
      field.appendChild(label);

      var input;
      if (q.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else if (q.type === 'select') {
        input = document.createElement('select');
        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Select...';
        input.appendChild(defaultOpt);
        if (q.options) {
          var opts = typeof q.options === 'string' ? q.options.split(',') : q.options;
          opts.forEach(function(opt) {
            var o = document.createElement('option');
            o.value = opt.trim();
            o.textContent = opt.trim();
            input.appendChild(o);
          });
        }
      } else if (q.type === 'date') {
        input = document.createElement('input');
        input.type = 'date';
      } else if (q.type === 'tel') {
        input = document.createElement('input');
        input.type = 'tel';
      } else if (q.type === 'email') {
        input = document.createElement('input');
        input.type = 'email';
      } else if (q.type === 'venue') {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = q.placeholder || 'Venue name or address';
      } else {
        input = document.createElement('input');
        input.type = 'text';
      }

      input.name = q.mapTo || q.id;
      if (q.required) input.required = true;
      if (q.placeholder) input.placeholder = q.placeholder;

      field.appendChild(input);
      formEl.appendChild(field);
    });

    // GDPR consent checkbox
    if (form.consentRequired) {
      var consent = document.createElement('div');
      consent.className = 'cf-consent';
      consent.innerHTML = '<input type="checkbox" name="cf_consent" required /><span>' +
        (form.consentText || 'I consent to processing my personal data for contact purposes.') + '</span>';
      formEl.appendChild(consent);
    }

    // Submit button
    var submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'cf-submit';
    submit.textContent = 'Send Enquiry';
    formEl.appendChild(submit);

    // Privacy policy link
    if (form.privacyPolicyUrl) {
      var privacy = document.createElement('div');
      privacy.className = 'cf-privacy';
      privacy.innerHTML = '<a href="' + form.privacyPolicyUrl + '" target="_blank" rel="noopener">Privacy Policy</a>';
      formEl.appendChild(privacy);
    }

    // Handle submission
    formEl.addEventListener('submit', function(e) {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Sending...';

      var payload = {};
      var inputs = formEl.querySelectorAll('input, select, textarea');
      inputs.forEach(function(el) {
        if (el.name && el.name !== 'cf_consent' && el.name !== 'website_url') {
          payload[el.name] = el.value;
        }
      });

      // Add consent if present
      var consentCheck = formEl.querySelector('[name="cf_consent"]');
      if (consentCheck) {
        payload.consentGiven = consentCheck.checked;
      }

      fetch(BASE_URL + '/api/leads/public/' + slug + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r) {
        if (!r.ok) throw new Error('Submission failed');
        return r.json();
      })
      .then(function() {
        // Success — redirect or show thank you message
        if (form.redirectUrl) {
          window.location.href = form.redirectUrl;
        } else {
          wrapper.innerHTML = '<div class="cf-success"><h3>Thank you!</h3><p>' +
            (form.thankYouMessage || 'Thank you for your enquiry! We will be in touch shortly.') +
            '</p></div>';
        }
      })
      .catch(function(err) {
        console.error('[ClientFlow] Submission error:', err);
        submit.disabled = false;
        submit.textContent = 'Send Enquiry';
        var errorDiv = formEl.querySelector('.cf-submit-error');
        if (!errorDiv) {
          errorDiv = document.createElement('div');
          errorDiv.className = 'cf-error cf-submit-error';
          formEl.insertBefore(errorDiv, submit);
        }
        errorDiv.textContent = 'Something went wrong. Please try again.';
      });
    });

    wrapper.appendChild(formEl);
    container.innerHTML = '';
    container.appendChild(wrapper);
  }
})();
`.trim();
}

export default router;

/**
 * Zero-dependency client-side HTML sanitizer for incoming email bodies.
 * Parses HTML via native DOMParser, strips all malicious tags, scripts,
 * iframes, event handlers (on*), and dangerous pseudo-protocols.
 */
export function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // Forbidden executable tags
    const forbiddenTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'link', 'meta', 'applet'];
    forbiddenTags.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    });

    // Clean all remaining elements
    const allElements = doc.body.querySelectorAll('*');
    allElements.forEach((el) => {
      // Remove all event handlers like onload, onerror, onclick, etc.
      for (let i = el.attributes.length - 1; i >= 0; i--) {
        const attrName = el.attributes[i].name.toLowerCase();
        if (attrName.startsWith('on')) {
          el.removeAttribute(attrName);
        }
      }

      // Check href and src attributes
      ['href', 'src', 'action', 'xlink:href'].forEach((attr) => {
        if (el.hasAttribute(attr)) {
          const val = el.getAttribute(attr).trim().toLowerCase();
          if (
            val.startsWith('javascript:') ||
            val.startsWith('vbscript:') ||
            (val.startsWith('data:') && !val.startsWith('data:image/'))
          ) {
            el.removeAttribute(attr);
          }
        }
      });

      // Secure external anchor links
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return doc.body.innerHTML;
  } catch (err) {
    console.error('HTML sanitize failed, falling back to escaped text:', err);
    return rawHtml.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

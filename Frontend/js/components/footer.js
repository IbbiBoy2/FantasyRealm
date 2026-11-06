
/*
 * FANTASYREALM - SHARED FOOTER CONTROLLER
 *
 * Loads a trusted, same-origin HTML template and inserts
 * its DOM nodes into the shared footer container.
 *
 * The footer has no authentication dependencies and
 * does not process user-provided HTML.
 */

(() => {
  'use strict';

  /*
   * Resolve the template from the current HTML document.
   * All existing pages currently live in Frontend/Html/.
   */
  const FOOTER_TEMPLATE_URL = new URL(
    '../components/footer.html',
    document.baseURI
  );

  async function loadFooter() {
    const container = document.getElementById('site-footer');

    if (!container) {
      return;
    }

    try {
      const response = await fetch(FOOTER_TEMPLATE_URL, {
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(
          `Footer template request failed: ${response.status}`
        );
      }

      const markup = await response.text();

      /*
       * Parse only this trusted application template.
       * DOMParser is not an HTML sanitizer and must
       * never receive untrusted user content here.
       */
      const parsedDocument = new DOMParser().parseFromString(
        markup,
        'text/html'
      );

      const template = parsedDocument.getElementById(
        'fantasyrealm-footer-template'
      );

      if (!(template instanceof HTMLTemplateElement)) {
        throw new Error('Shared footer template is missing.');
      }

      container.replaceChildren(
        template.content.cloneNode(true)
      );

      /*
       * Keep the copyright year current without
       * requiring annual changes to the template.
       */
      const yearElement = container.querySelector('#footer-year');

      if (yearElement) {
        yearElement.textContent = String(
          new Date().getFullYear()
        );
      }

      /*
      * Highlight the current page in the footer navigation.
      * aria-current also identifies the active page
      * for assistive technologies.
      */
      const currentPage =
        window.location.pathname.split('/').pop() || 'index.html';

      const footerLinks = container.querySelectorAll(
        '.footer-links a[href]'
      );

      footerLinks.forEach((link) => {
        const targetPage = new URL(
          link.getAttribute('href'),
          document.baseURI
        ).pathname.split('/').pop();

        if (targetPage === currentPage) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      });

    } catch (error) {
      console.error(
        'Unable to initialize shared footer:',
        error
      );
    }
  }

  loadFooter();
})();
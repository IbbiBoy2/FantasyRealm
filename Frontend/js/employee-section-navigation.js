
/**
 * FANTASYREALM - EMPLOYEE SECTION NAVIGATION
 *
 * Keep section navigation inside the scrollable dashboard area.
 * Prevent native anchor scrolling from moving the application
 * shell and creating an empty area below the footer.
 */
(() => {
  'use strict';

  const main = document.querySelector(
    'body[data-page="employee"] > .app-main'
  );

  const navigation = document.querySelector(
    '.employee-jump-links'
  );

  if (!main || !navigation) return;

  navigation.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');

    if (!link || !navigation.contains(link)) return;

    const hash = link.getAttribute('href');

    if (!hash || hash.length < 2) return;

    const target = document.getElementById(hash.slice(1));

    if (!target || !main.contains(target)) return;

    // Prevent the browser from scrolling the entire page.
    event.preventDefault();

    const mainTop = main.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;

    const targetOffset =
      main.scrollTop + targetTop - mainTop - 28;

    main.scrollTo({
      top: Math.max(0, targetOffset),
      behavior: window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches ? 'instant' : 'smooth'
    });

    // Update the URL without triggering native scrolling.
    window.history.replaceState(null, '', hash);
  });
})();

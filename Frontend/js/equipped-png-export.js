/**
 * FANTASYREALM - EQUIPPED PNG EXPORT
 *
 * The character creator already exports the original appearance canvas.
 * In approved-character edit mode a second canvas contains the full outfit,
 * body, nose, eyes, hair and topmost accessories. Export that canvas instead.
 * This enhancement has no effect on new-character creation.
 */
(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('export-preview');
    if (!button) return;

    button.addEventListener('click', event => {
      const parameters = new URLSearchParams(window.location.search);
      if (!parameters.has('edit')) return;

      const canvas = document.getElementById('edit-equipment-preview');
      if (!(canvas instanceof HTMLCanvasElement) || canvas.hidden) {
        // The equipped preview has not finished loading. Do not export
        // the unequipped original canvas by mistake.
        event.preventDefault();
        event.stopImmediatePropagation();
        const status = document.getElementById('form-feedback');
        if (status) {
          status.hidden = false;
          status.textContent = 'The equipped character preview is not ready yet.';
          status.classList.add('is-error');
        }
        return;
      }

      // Capture-phase handler blocks the legacy export click handler.
      event.preventDefault();
      event.stopImmediatePropagation();
      const link = document.createElement('a');
      link.download = 'fantasyrealm-equipped-character.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }, true);
  });
})();

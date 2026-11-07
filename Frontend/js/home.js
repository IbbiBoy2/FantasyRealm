
/*
 * FANTASYREALM - HOME PAGE CONTROLLER
 *
 * Adjusts the main character creation link according
 * to the authenticated session.
 *
 * The backend remains responsible for enforcing
 * access permissions on protected features.
 */

(() => {
  'use strict';

  const SESSION_URL = '/FantasyRealm/Backend/api/session.php';

  const createLink = document.getElementById('home-create-link');

  if (!createLink) {
    return;
  }

  /*
   * Guests keep the login destination.
   * An authenticated user can open the creator directly.
   */
  async function updateCreateLink() {
    createLink.href = 'login.html';

    try {
      const response = await fetch(SESSION_URL, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return;
      }

      const session = await response.json();

      if (session.authenticated && session.user) {
        createLink.href = 'create-character.html';
      }

    } catch (error) {
      console.error(
        'Unable to determine homepage creation access:',
        error
      );
    }
  }

  updateCreateLink();
})();

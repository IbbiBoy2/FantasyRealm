
/*
 * FANTASYREALM - SHARED HEADER CONTROLLER
 *
 * Loads a trusted, same-origin HTML template and manages
 * navigation, authentication state and responsive menus.
 *
 * User-controlled values must never be parsed as HTML.
 * The username is inserted safely through textContent.
 */

(() => {
  'use strict';

  const SESSION_URL = '/FantasyRealm/Backend/api/session.php';
  const LOGOUT_URL = '/FantasyRealm/Backend/api/logout.php';

  const HEADER_TEMPLATE_URL = new URL(
    '../components/header.html',
    document.baseURI
  );

  async function fetchSession() {
    const response = await fetch(SESSION_URL, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Unable to retrieve session.');
    }

    return response.json();
  }

  /*
   * Load only our own static HTML template.
   *
   * DOMParser converts the trusted template file into
   * DOM nodes without injecting dynamic HTML strings.
   */
  async function loadHeaderTemplate(container) {
    const response = await fetch(HEADER_TEMPLATE_URL, {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Unable to load header template.');
    }

    const markup = await response.text();

    const documentFragment = new DOMParser().parseFromString(
      markup,
      'text/html'
    );

    const template = documentFragment.getElementById(
      'fantasyrealm-header-template'
    );

    if (!(template instanceof HTMLTemplateElement)) {
      throw new Error('Header template is missing.');
    }

    container.replaceChildren(
      template.content.cloneNode(true)
    );
  }

  function initializeHeader(container) {
    const getElement = (id) => {
      const element = container.querySelector(`#${id}`);

      if (!element) {
        throw new Error(`Missing header element: ${id}`);
      }

      return element;
    };

    const loginLink = getElement('login-link');
    const registerLink = getElement('register-link');
    const createLink = getElement('header-create-link');
    const characterSettingsLink = getElement('character-settings-link');
    const usernameDisplay = getElement('nav-username');

    const settingsMenu = getElement('settings-menu');
    const settingsButton = getElement('settings-button');
    const settingsDropdown = getElement('settings-dropdown');

    const employeeLink = getElement('employee-dashboard-link');
    const adminLink = getElement('admin-dashboard-link');
    const logoutButton = getElement('logout-link');

    const mobileMenuButton = getElement('mobile-menu-button');
    const mainNavigation = getElement('main-navigation');

    /*
     * Keep the account menu and ARIA state synchronized.
     */
    function setSettingsOpen(isOpen) {
      settingsDropdown.hidden = !isOpen;

      settingsButton.setAttribute(
        'aria-expanded',
        String(isOpen)
      );
    }

    /*
     * The mobile menu is an overlay, not an additional
     * scrolling region.
     */
    function setMobileMenuOpen(isOpen) {
      mainNavigation.dataset.mobileOpen = String(isOpen);

      mobileMenuButton.setAttribute(
        'aria-expanded',
        String(isOpen)
      );

      mobileMenuButton.setAttribute(
        'aria-label',
        isOpen
          ? 'Close navigation menu'
          : 'Open navigation menu'
      );

      mobileMenuButton.querySelector('span').textContent =
        isOpen ? '✕' : '☰';

      if (!isOpen) {
        setSettingsOpen(false);
      }
    }

    settingsButton.addEventListener('click', () => {
      setSettingsOpen(settingsDropdown.hidden);
    });

    mobileMenuButton.addEventListener('click', () => {
      setMobileMenuOpen(
        mainNavigation.dataset.mobileOpen !== 'true'
      );
    });

    /*
     * Close menus when users click outside the relevant area.
     */
    document.addEventListener('click', (event) => {
      if (!settingsMenu.contains(event.target)) {
        setSettingsOpen(false);
      }

      if (!container.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (!settingsDropdown.hidden) {
        setSettingsOpen(false);
        settingsButton.focus();
        return;
      }

      if (mainNavigation.dataset.mobileOpen === 'true') {
        setMobileMenuOpen(false);
        mobileMenuButton.focus();
      }
    });

    mainNavigation.addEventListener('click', (event) => {
      const link = event.target.closest('a');

      if (link) {
        setMobileMenuOpen(false);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    });

    /*
     * Highlight the current page using native ARIA metadata.
     */
    function updateActiveNavigation() {
      const currentPage =
        window.location.pathname.split('/').pop() ||
        'index.html';

      container
        .querySelectorAll('.nav-links > a[href]')
        .forEach((link) => {
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
    }

    /*
     * Display only guest links until authentication is confirmed.
     * The server remains responsible for enforcing permissions.
     */
    function showGuestNavigation() {
      loginLink.hidden = false;
      registerLink.hidden = false;

      createLink.hidden = true;
      characterSettingsLink.hidden = true;

      usernameDisplay.textContent = '';

      employeeLink.hidden = true;
      adminLink.hidden = true;

      settingsMenu.hidden = true;
      setSettingsOpen(false);
    }

    function showAuthenticatedNavigation(user) {
      loginLink.hidden = true;
      registerLink.hidden = true;

      /*
 * Player-specific navigation is reserved for USER accounts.
 * Staff access remains available through role-specific dashboards.
 */
      const isPlayer = user.role === 'USER';

      createLink.hidden = !isPlayer;
      characterSettingsLink.hidden = !isPlayer;

      usernameDisplay.textContent = user.username;

      employeeLink.hidden = ![
        'EMPLOYEE',
        'ADMIN'
      ].includes(user.role);

      adminLink.hidden = user.role !== 'ADMIN';

      settingsMenu.hidden = false;
    }

    async function refreshSession() {
      showGuestNavigation();

      try {
        const session = await fetchSession();

        if (session.authenticated && session.user) {
          showAuthenticatedNavigation(session.user);
        }
      } catch (error) {
        console.error(
          'Unable to refresh header session:',
          error
        );
      }
    }

    /*
     * Require the current CSRF token before logging out.
     * Never treat a failed request as a successful logout.
     */
    async function logout() {
      logoutButton.disabled = true;

      try {
        const session = await fetchSession();

        if (
          !session.authenticated ||
          typeof session.csrf_token !== 'string'
        ) {
          throw new Error('Invalid session security token.');
        }

        const response = await fetch(LOGOUT_URL, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'X-CSRF-Token': session.csrf_token
          }
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error('Logout failed.');
        }

        window.location.assign('index.html');
      } catch (error) {
        console.error('Logout failed:', error);

        window.alert(
          'Unable to log out. Please try again.'
        );

        logoutButton.disabled = false;
      }
    }

    logoutButton.addEventListener('click', logout);

    updateActiveNavigation();
    refreshSession();

    // Expose the refresh action for future page controllers.
    window.FantasyRealmHeader = {
      refreshSession
    };
  }

  /*
   * Initialize the component only after its HTML is available.
   * This avoids querying elements before they are created.
   */
  async function startHeader() {
    const container = document.getElementById('site-header');

    if (!container) {
      return;
    }

    try {
      await loadHeaderTemplate(container);
      initializeHeader(container);
    } catch (error) {
      console.error(
        'Unable to initialize shared header:',
        error
      );
    }
  }

  startHeader();
})();

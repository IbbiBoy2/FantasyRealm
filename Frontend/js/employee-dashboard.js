// =========================
// DOM REFERENCES
// =========================

const employeeMessage = document.getElementById('employee-message');
const employeeContent = document.getElementById('employee-content');

const usernameDisplay = document.getElementById('nav-username');
const employeeUsername = document.getElementById('employee-username');
const employeeRole = document.getElementById('employee-role');

const pendingCharactersCount =
    document.getElementById('pending-characters-count');

const pendingReviewsCount =
    document.getElementById('pending-reviews-count');

const activeAccessoriesCount =
    document.getElementById('active-accessories-count');

const playerAccountsCount =
    document.getElementById('player-accounts-count');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');
const logoutButton = document.getElementById('logout-link');

// =========================
// SETTINGS MENU
// =========================

// Keeps dropdown visibility and its accessibility state synchronized.

function setSettingsOpen(isOpen) {
    settingsDropdown.hidden = !isOpen;

    settingsButton.setAttribute(
        'aria-expanded',
        String(isOpen)
    );
}

settingsButton.addEventListener('click', () => {
    setSettingsOpen(settingsDropdown.hidden);
});

document.addEventListener('click', (event) => {
    if (!settingsMenu.contains(event.target)) {
        setSettingsOpen(false);
    }
});

document.addEventListener('keydown', (event) => {
    if (
        event.key === 'Escape' &&
        !settingsDropdown.hidden
    ) {
        setSettingsOpen(false);
        settingsButton.focus();
    }
});

// =========================
// LOAD EMPLOYEE DASHBOARD
// =========================

// The PHP API checks the current database role before returning staff data.

async function loadEmployeeDashboard() {
    employeeContent.hidden = true;
    settingsMenu.hidden = true;

    setSettingsOpen(false);

    employeeMessage.textContent = 'Checking employee access...';
    employeeMessage.hidden = false;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/employee-dashboard.php',
            {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (response.status === 403) {
            employeeMessage.textContent =
                'Access denied. An active employee or administrator account is required.';
            return;
        }

        if (!response.ok || !data.success) {
            employeeMessage.textContent =
                data.message || 'Unable to load employee dashboard.';
            return;
        }

        usernameDisplay.textContent = data.user.username;
        employeeUsername.textContent = data.user.username;
        employeeRole.textContent = `Role: ${data.user.role}`;

        pendingCharactersCount.textContent =
            data.statistics.pending_characters;

        pendingReviewsCount.textContent =
            data.statistics.pending_reviews;

        activeAccessoriesCount.textContent =
            data.statistics.active_accessories;

        playerAccountsCount.textContent =
            data.statistics.player_accounts;

        employeeMessage.hidden = true;
        employeeContent.hidden = false;
        settingsMenu.hidden = false;

    } catch (error) {
        console.error('Unable to load employee dashboard:', error);

        employeeMessage.textContent =
            'Unable to load employee dashboard. Please refresh to try again.';
    }
}

// =========================
// LOGOUT
// =========================

// Redirects only after the API confirms the PHP session has ended.

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/logout.php',
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            employeeMessage.textContent =
                data.message || 'Unable to log out. Please try again.';

            employeeMessage.hidden = false;
            return;
        }

        window.location.href = 'index.html';

    } catch (error) {
        console.error('Unable to logout:', error);

        employeeMessage.textContent =
            'Unable to log out. Please try again.';

        employeeMessage.hidden = false;

    } finally {
        logoutButton.disabled = false;
    }
});

// =========================
// INITIALIZATION
// =========================

loadEmployeeDashboard();
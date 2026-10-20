// =========================
// DOM REFERENCES
// =========================

const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutButton = document.getElementById('logout-link');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');

const employeeDashboardLink =
    document.getElementById('employee-dashboard-link');

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

// Closes the dropdown when clicking outside the settings container.

document.addEventListener('click', (event) => {
    if (!settingsMenu.contains(event.target)) {
        setSettingsOpen(false);
    }
});

// Returns keyboard focus to the gear when Escape closes the dropdown.

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
// SESSION / NAVBAR
// =========================

// Uses the PHP session to display the appropriate account controls.

async function loadSession() {

    employeeDashboardLink.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();
        // Shows staff navigation only after a successful authenticated role check.

employeeDashboardLink.hidden = !(
    response.ok &&
    data.authenticated &&
    ['EMPLOYEE', 'ADMIN'].includes(data.user?.role)
);

        if (!response.ok) {
            throw new Error('Unable to verify session.');
        }

        if (data.authenticated) {
            loginLink.hidden = true;
            registerLink.hidden = true;

            usernameDisplay.textContent = data.user.username;
            usernameDisplay.hidden = false;

            settingsMenu.hidden = false;
        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.textContent = '';
            usernameDisplay.hidden = true;

            settingsMenu.hidden = true;
            setSettingsOpen(false);
        }

    } catch (error) {
        console.error('Unable to load session:', error);
    }
}

// =========================
// LOGOUT
// =========================

// Ends the PHP session through the REST API before reloading the homepage.

logoutButton.addEventListener('click', async () => {
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
            console.error('Logout failed:', data.message);
            return;
        }

        window.location.href = 'index.html';

    } catch (error) {
        console.error('Unable to logout:', error);
    }
});

// =========================
// INITIALIZATION
// =========================

loadSession();
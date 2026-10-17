const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutButton =
    document.getElementById('logout-link');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');

// =========================
// LOGOUT
// =========================

logoutButton.addEventListener(
    'click',
    async () => {
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
                console.error(
                    'Logout failed:',
                    data.message
                );

                return;
            }

            window.location.href =
                'index.html';

        } catch (error) {
            console.error(
                'Unable to logout:',
                error
            );
        }
    }
);

// =========================
// SESSION
// =========================

async function loadSession() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();

        if (data.authenticated) {
            loginLink.hidden = true;
            registerLink.hidden = true;

            usernameDisplay.textContent =
                data.user.username;

            usernameDisplay.hidden = false;

            settingsMenu.hidden = false;

        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.hidden = true;

            settingsMenu.hidden = true;
        }

    } catch (error) {
        console.error(
            'Unable to load session:',
            error
        );
    }
}


// =========================
// SETTINGS MENU
// =========================

settingsButton.addEventListener(
    'click',
    () => {
        const isOpen =
            !settingsDropdown.hidden;

        settingsDropdown.hidden =
            isOpen;

        settingsButton.setAttribute(
            'aria-expanded',
            String(!isOpen)
        );
    }
);


// Close the dropdown when clicking outside it.

document.addEventListener(
    'click',
    (event) => {
        if (
            !settingsMenu.contains(event.target)
        ) {
            settingsDropdown.hidden = true;

            settingsButton.setAttribute(
                'aria-expanded',
                'false'
            );
        }
    }
);


// =========================
// INITIALIZATION
// =========================

loadSession();
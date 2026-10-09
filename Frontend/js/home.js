const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutLink = document.getElementById('logout-link');

async function loadSession() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();

        if (data.authenticated) {
            loginLink.hidden = true;
            registerLink.hidden = true;

            usernameDisplay.textContent = data.user.username;
            usernameDisplay.hidden = false;

            logoutLink.hidden = false;
        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.hidden = true;
            logoutLink.hidden = true;
        }
    } catch (error) {
        console.error('Unable to load session:', error);
    }
}

logoutLink.addEventListener('click', async (event) => {
    event.preventDefault();

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

        await loadSession();

    } catch (error) {
        console.error('Unable to logout:', error);
    }
});

loadSession();
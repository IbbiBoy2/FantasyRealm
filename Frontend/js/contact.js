
// =========================
// DOM REFERENCES
// =========================

const contactForm = document.getElementById('contact-form');

const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const messageInput = document.getElementById('message');

const formMessage = document.getElementById('form-message');
const sendButton = document.getElementById('send-button');

const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutLink = document.getElementById('logout-link');

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

// Logged-in users get their username and email prefilled automatically.

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

            usernameInput.value = data.user.username;
            emailInput.value = data.user.email;
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
// CONTACT FORM SUBMISSION
// =========================

// Sends the contact form data as JSON to the REST API.

contactForm.addEventListener(
    'submit',
    async (event) => {
        event.preventDefault();

        const contactData = {
            username: usernameInput.value.trim(),
            email: emailInput.value.trim(),
            message: messageInput.value.trim()
        };

// Basic client-side validation before sending the request.

        if (
            contactData.username === '' ||
            contactData.email === '' ||
            contactData.message === ''
        ) {
            showMessage(
                'Please fill in all fields.'
            );

            return;
        }


        sendButton.disabled = true;
        sendButton.textContent = 'Sending...';

        hideMessage();

// The backend performs the final validation and stores the message with PDO.

        try {
            const response = await fetch(
                '/FantasyRealm/Backend/api/contact.php',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },

                    body: JSON.stringify(
                        contactData
                    )
                }
            );


            const data = await response.json();


            if (!response.ok || !data.success) {
                showMessage(
                    data.message ||
                    'Unable to send your message.'
                );

                return;
            }


            showMessage(
                'Your message has been sent successfully.'
            );

            messageInput.value = '';


        } catch (error) {
            console.error(
                'Unable to send contact message:',
                error
            );

            showMessage(
                'Unable to send your message.'
            );

        } finally {
            sendButton.disabled = false;
            sendButton.textContent = 'Send Message';
        }
    }
);

// =========================
// LOGOUT
// =========================

// Redirects only after the REST API confirms the PHP session has ended.

logoutLink.addEventListener('click', async () => {
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
            showMessage(
                data.message || 'Unable to log out. Please try again.'
            );
            return;
        }

        window.location.href = 'index.html';

    } catch (error) {
        console.error('Unable to logout:', error);

        showMessage(
            'Unable to log out. Please try again.'
        );
    }
});

// =========================
// FORM FEEDBACK
// =========================

function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
}


function hideMessage() {
    formMessage.textContent = '';
    formMessage.hidden = true;
}

// =========================
// INITIALIZATION
// =========================

loadSession();
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

            usernameInput.value = data.user.username;
            emailInput.value = data.user.email;

        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.hidden = true;
            logoutLink.hidden = true;
        }

    } catch (error) {
        console.error(
            'Unable to load session:',
            error
        );
    }
}


contactForm.addEventListener(
    'submit',
    async (event) => {
        event.preventDefault();

        const contactData = {
            username: usernameInput.value.trim(),
            email: emailInput.value.trim(),
            message: messageInput.value.trim()
        };


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


logoutLink.addEventListener(
    'click',
    async (event) => {
        event.preventDefault();

        try {
            await fetch(
                '/FantasyRealm/Backend/api/logout.php',
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            window.location.href = 'index.html';

        } catch (error) {
            console.error(
                'Unable to logout:',
                error
            );
        }
    }
);


function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
}


function hideMessage() {
    formMessage.textContent = '';
    formMessage.hidden = true;
}


loadSession();
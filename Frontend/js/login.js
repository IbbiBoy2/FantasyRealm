const loginForm = document.getElementById('login-form');
const formMessage = document.getElementById('form-message');
const loginButton = document.getElementById('login-button');

loginForm.addEventListener('submit', async (event) => {

    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    formMessage.hidden = true;
    formMessage.textContent = '';

    if (email === '' || password === '') {
        showMessage('Please fill in all fields.');
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {

        const response = await fetch(
            '/FantasyRealm/Backend/api/login.php',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showMessage(
                data.message || 'Unable to log in.'
            );
            return;
        }

        if (data.success) {

            window.location.href = 'index.html';

        } else {

            showMessage(
                data.message || 'Unable to log in.'
            );

        }

    } catch (error) {

        console.error('Login request failed:', error);

        showMessage(
            'Unable to connect to the server.'
        );

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = 'Login';

    }

});


function showMessage(message) {

    formMessage.textContent = message;
    formMessage.hidden = false;

}
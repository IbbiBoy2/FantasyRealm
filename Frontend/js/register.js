const registerForm = document.getElementById('register-form');
const formMessage = document.getElementById('form-message');
const registerButton = document.getElementById('register-button');


registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    formMessage.hidden = true;
    formMessage.textContent = '';

    if (
        username === '' ||
        email === '' ||
        password === '' ||
        passwordConfirm === ''
    ) {
        showMessage('Please fill in all fields.');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('Passwords do not match.');
        return;
    }

    registerButton.disabled = true;
    registerButton.textContent = 'Creating account...';

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/register.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    password_confirm: passwordConfirm
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showMessage(
                data.message || 'Registration failed.'
            );
            return;
        }

        showMessage('Account created successfully.');

        registerForm.reset();

    } catch (error) {
        console.error('Registration request failed:', error);

        showMessage('Unable to connect to the server.');
    } finally {
        registerButton.disabled = false;
        registerButton.textContent = 'Create Account';
    }
});


function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
}
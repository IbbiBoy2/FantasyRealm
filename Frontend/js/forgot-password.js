const forgotForm = document.getElementById('forgot-form');
const emailInput = document.getElementById('email');
const formMessage = document.getElementById('form-message');
const forgotButton = document.getElementById('forgot-button');

const devResetLink = document.getElementById('dev-reset-link');
const resetLink = document.getElementById('reset-link');

devResetLink.hidden = true;

forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();

    formMessage.hidden = true;
    formMessage.textContent = '';

    devResetLink.hidden = true;
    resetLink.removeAttribute('href');

    if (email === '') {
        showMessage('Please enter your email address.');
        return;
    }

    forgotButton.disabled = true;
    forgotButton.textContent = 'Creating reset link...';

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/forgot-password.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email: email
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showMessage(
                data.message || 'Unable to process the password reset request.'
            );
            return;
        }

        showMessage(data.message);

        if (data.reset_url) {
            resetLink.href = data.reset_url;
            devResetLink.hidden = false;
        }

    } catch (error) {
        console.error('Forgot password request failed:', error);

        showMessage('Unable to connect to the server.');
    } finally {
        forgotButton.disabled = false;
        forgotButton.textContent = 'Send Reset Link';
    }
});


function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
}
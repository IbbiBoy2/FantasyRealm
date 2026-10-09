const resetForm = document.getElementById('reset-form');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('password-confirm');
const formMessage = document.getElementById('form-message');
const resetButton = document.getElementById('reset-button');


const params = new URLSearchParams(window.location.search);
const token = params.get('token');

if (!token) {
    showMessage('Invalid password reset link.');
    resetForm.hidden = true;
}

resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    formMessage.hidden = true;
    formMessage.textContent = '';

    if (password === '' || passwordConfirm === '') {
        showMessage('Please fill in all fields.');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('Passwords do not match.');
        return;
    }

    resetButton.disabled = true;
    resetButton.textContent = 'Resetting password...';

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/reset-password.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    password: password,
                    password_confirm: passwordConfirm
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showMessage(
                data.message || 'Unable to reset password.'
            );
            return;
        }

        showMessage('Password reset successfully.');

        resetForm.reset();

    } catch (error) {
        console.error('Password reset request failed:', error);

        showMessage('Unable to connect to the server.');
    } finally {
        resetButton.disabled = false;
        resetButton.textContent = 'Reset Password';
    }
});


function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
}
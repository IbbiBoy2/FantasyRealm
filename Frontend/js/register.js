/*
 * FANTASYREALM - REGISTRATION CONTROLLER
 *
 * Validates registration input, submits it to
 * the PHP API, and displays accessible feedback.
 *
 * The server remains the source of truth for
 * password rules and account uniqueness.
 */

(() => {
	'use strict';

	const REGISTER_URL = '/FantasyRealm/Backend/api/register.php';

	const form = document.getElementById('register-form');

	if (!form) {
		return;
	}

	const usernameInput = document.getElementById('username');
	const emailInput = document.getElementById('email');
	const passwordInput = document.getElementById('password');
	const confirmInput = document.getElementById('password-confirm');

	const messageElement = document.getElementById('form-message');
	const registerButton = document.getElementById('register-button');

	/*
	 * Display server messages as text, never as HTML.
	 */
	function showMessage(message, type = 'error') {
		messageElement.textContent = message;
		messageElement.dataset.type = type;
		messageElement.hidden = false;

		messageElement.setAttribute(
			'role',
			type === 'error' ? 'alert' : 'status'
		);
	}

	function clearMessage() {
		messageElement.textContent = '';
		messageElement.hidden = true;
		delete messageElement.dataset.type;
	}

	/*
	 * Configure both password visibility buttons.
	 */
	function setupPasswordToggle(inputId, buttonId) {
		const input = document.getElementById(inputId);
		const button = document.getElementById(buttonId);

		if (!input || !button) {
			return;
		}

		button.addEventListener('click', () => {
			const visible = input.type === 'password';

			input.type = visible ? 'text' : 'password';
			button.textContent = visible ? 'Hide' : 'Show';

			button.setAttribute(
				'aria-pressed',
				String(visible)
			);

			const fieldName = inputId === 'password'
				? 'password'
				: 'confirmation password';

			button.setAttribute(
				'aria-label',
				`${visible ? 'Hide' : 'Show'} ${fieldName}`
			);
		});
	}

	setupPasswordToggle('password', 'toggle-password');

	setupPasswordToggle(
		'password-confirm',
		'toggle-password-confirm'
	);

	/*
	 * Mirror server password requirements to
	 * improve feedback before submission.
	 */
	function validatePassword(password) {
		const byteLength = new TextEncoder().encode(password).length;

		if (
			Array.from(password).length < 12 ||
			byteLength > 72
		) {
			return 'Password must contain at least 12 characters and no more than 72 bytes.';
		}

		if (
			!/[A-Z]/.test(password) ||
			!/[a-z]/.test(password) ||
			!/[0-9]/.test(password) ||
			!/[^\p{L}\p{N}\s]/u.test(password)
		) {
			return 'Password must include an uppercase letter, a lowercase letter, a number and a special character.';
		}

		return null;
	}

	/*
	 * Submit the registration form.
	 */
	async function handleRegister(event) {
		event.preventDefault();

		if (registerButton.disabled) {
			return;
		}

		clearMessage();

		const username = usernameInput.value.trim();
		const email = emailInput.value.trim();
		const password = passwordInput.value;
		const passwordConfirm = confirmInput.value;

		if (!username || !email || !password || !passwordConfirm) {
			showMessage('Please fill in all fields.');
			return;
		}

		if (!emailInput.checkValidity()) {
			showMessage('Please enter a valid email address.');
			emailInput.focus();
			return;
		}

		const passwordError = validatePassword(password);

		if (passwordError !== null) {
			showMessage(passwordError);
			passwordInput.focus();
			return;
		}

		if (password !== passwordConfirm) {
			showMessage('Passwords do not match.');
			confirmInput.focus();
			return;
		}

		registerButton.disabled = true;
		registerButton.textContent = 'Creating account...';

		try {
			const response = await fetch(REGISTER_URL, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					username,
					email,
					password,
					password_confirm: passwordConfirm
				})
			});

			const result = await response.json();

			if (!response.ok || result.success !== true) {
				showMessage(
					result.message ||
					'Unable to create your account. Please try again.'
				);
				return;
			}

			/*
			 * Clear sensitive values and hide the form.
			 * The user can then follow the existing Login link.
			 */
			form.reset();
			form.hidden = true;

			showMessage(
				'Account created successfully! You can now log in.',
				'success'
			);

			messageElement.focus();

		} catch (error) {
			console.error('Registration request failed:', error);

			showMessage(
				'Unable to connect to the server. Please try again.'
			);

		} finally {
			registerButton.disabled = false;
			registerButton.textContent = 'Create Account';
		}
	}

	/*
	 * Make the confirmation message focusable
	 * after a successful registration.
	 */
	messageElement.setAttribute('tabindex', '-1');

	form.addEventListener('submit', handleRegister);
})();

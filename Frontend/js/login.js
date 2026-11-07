
/*
 * FANTASYREALM - LOGIN CONTROLLER
 *
 * Authenticates users and redirects them to the
 * dashboard corresponding to their current role.
 *
 * The shared header manages navigation and logout.
 */

(() => {
	'use strict';

	const LOGIN_URL = '/FantasyRealm/Backend/api/login.php';
	const SESSION_URL = '/FantasyRealm/Backend/api/session.php';

	const ROLE_DESTINATIONS = {
		USER: 'dashboard.html',
		EMPLOYEE: 'employee-dashboard.html',
		ADMIN: 'admin-dashboard.html'
	};

	const form = document.getElementById('login-form');

	if (!form) {
		return;
	}

	const emailInput = document.getElementById('email');
	const passwordInput = document.getElementById('password');
	const passwordToggle = document.getElementById('toggle-password');
	const formMessage = document.getElementById('form-message');
	const loginButton = document.getElementById('login-button');

	function showError(message) {
		formMessage.textContent = message;
		formMessage.hidden = false;
	}

	function clearError() {
		formMessage.textContent = '';
		formMessage.hidden = true;
	}

	/*
	 * Allow users to show or hide their password.
	 */
	passwordToggle.addEventListener('click', () => {
		const visible = passwordInput.type === 'password';

		passwordInput.type = visible ? 'text' : 'password';

		passwordToggle.textContent = visible ? 'Hide' : 'Show';

		passwordToggle.setAttribute(
			'aria-label',
			visible ? 'Hide password' : 'Show password'
		);

		passwordToggle.setAttribute(
			'aria-pressed',
			String(visible)
		);
	});

	/*
	 * Retrieve the current role from the database-backed
	 * session endpoint, rather than assuming role IDs.
	 */
	async function getAuthenticatedRole() {
		const response = await fetch(SESSION_URL, {
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: {
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error('Unable to verify the current session.');
		}

		const session = await response.json();

		if (
			session.authenticated !== true ||
			!session.user ||
			typeof session.user.role !== 'string'
		) {
			throw new Error('Unable to determine the account role.');
		}

		return session.user.role;
	}

	/*
	 * Submit login credentials and redirect according
	 * to the authenticated user's current role.
	 */
	async function handleLogin(event) {
		event.preventDefault();

		if (loginButton.disabled) {
			return;
		}

		clearError();

		const email = emailInput.value.trim();
		const password = passwordInput.value;

		if (!email || !password) {
			showError('Please fill in all fields.');
			return;
		}

		if (!emailInput.checkValidity()) {
			showError('Please enter a valid email address.');
			emailInput.focus();
			return;
		}

		loginButton.disabled = true;
		loginButton.textContent = 'Logging in...';

		try {
			const response = await fetch(LOGIN_URL, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({
					email,
					password
				})
			});

			const result = await response.json();

			if (!response.ok || result.success !== true) {
				showError(
					result.message ||
					'Unable to log in. Please try again.'
				);
				return;
			}

			/*
			 * The session endpoint resolves the role by name,
			 * including accounts promoted after registration.
			 */
			const role = await getAuthenticatedRole();

			const destination = ROLE_DESTINATIONS[role];

			if (!destination) {
				throw new Error('Unsupported account role.');
			}

			window.location.replace(destination);

		} catch (error) {
			console.error('Login failed:', error);

			showError(
				error.message ||
				'Unable to connect to the server. Please try again.'
			);

		} finally {
			loginButton.disabled = false;
			loginButton.textContent = 'Login';
		}
	}

	form.addEventListener('submit', handleLogin);
})();


/*
 * FANTASYREALM - PASSWORD RECOVERY CONTROLLER
 *
 * Submits an email address and username to the recovery API.
 * Reset tokens must never be returned to the browser by
 * this endpoint or exposed in developer-only links.
 */

(() => {
	'use strict';

	const RECOVERY_URL =
		'/FantasyRealm/Backend/api/forgot-password.php';

	const form = document.getElementById('forgot-form');

	if (!form) {
		return;
	}

	const emailInput = document.getElementById('email');
	const usernameInput = document.getElementById('username');

	const formMessage = document.getElementById('form-message');
	const submitButton = document.getElementById('forgot-button');

	function showMessage(message, type) {
		formMessage.textContent = message;
		formMessage.dataset.type = type;
		formMessage.hidden = false;
	}

	function clearMessage() {
		formMessage.textContent = '';
		formMessage.hidden = true;
		delete formMessage.dataset.type;
	}

	async function requestPasswordRecovery(event) {
		event.preventDefault();

		if (submitButton.disabled) {
			return;
		}

		clearMessage();

		const email = emailInput.value.trim();
		const username = usernameInput.value.trim();

		if (!email || !username) {
			showMessage(
				'Please enter your email address and username.',
				'error'
			);
			return;
		}

		if (!emailInput.checkValidity()) {
			showMessage(
				'Please enter a valid email address.',
				'error'
			);
			emailInput.focus();
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Submitting request...';

		try {
			const response = await fetch(RECOVERY_URL, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify({
					email,
					username
				})
			});

			const result = await response.json();

			if (!response.ok || result.success !== true) {
				showMessage(
					result.message ||
					'Unable to process your request.',
					'error'
				);
				return;
			}

			showMessage(
				'If the details match an account, ' +
				'recovery instructions will be sent by email.',
				'success'
			);

			form.reset();

		} catch (error) {
			console.error(
				'Password recovery request failed:',
				error
			);

			showMessage(
				'Unable to connect to the server. ' +
				'Please try again later.',
				'error'
			);

		} finally {
			submitButton.disabled = false;
			submitButton.textContent =
				'Send Recovery Instructions';
		}
	}

	form.addEventListener('submit', requestPasswordRecovery);
})();

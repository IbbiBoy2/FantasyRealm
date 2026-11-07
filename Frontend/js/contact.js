/*
 * FANTASYREALM - CONTACT PAGE
 *
 * Handles contact form validation, authenticated user
 * prefill, submission feedback and the message counter.
 *
 * Shared navigation and logout are managed by header.js.
 * All submitted values are validated again by the API.
 */

(() => {
	'use strict';

	const CONTACT_URL = '/FantasyRealm/Backend/api/contact.php';
	const SESSION_URL = '/FantasyRealm/Backend/api/session.php';

	const form = document.getElementById('contact-form');

	if (!form) {
		return;
	}

	const usernameInput = document.getElementById('username');
	const emailInput = document.getElementById('email');
	const messageInput = document.getElementById('message');

	const messageCounter = document.getElementById('message-counter');
	const formMessage = document.getElementById('form-message');
	const sendButton = document.getElementById('send-button');

	const MAX_MESSAGE_LENGTH = 2000;

	/*
	 * Display user-facing feedback using textContent.
	 * No server response is ever interpreted as HTML.
	 */
	function showFeedback(message, type) {
		formMessage.textContent = message;
		formMessage.dataset.type = type;
		formMessage.hidden = false;
	}

	function clearFeedback() {
		formMessage.textContent = '';
		formMessage.hidden = true;
		delete formMessage.dataset.type;
	}

	/*
	 * Keep the visible character counter synchronized
	 * with the message entered by the visitor.
	 */
	function updateMessageCounter() {
		const length = Array.from(messageInput.value).length;

		messageCounter.textContent =
			`${length} / ${MAX_MESSAGE_LENGTH} characters`;
	}

	messageInput.addEventListener('input', updateMessageCounter);

	/*
	 * Prefill account information for authenticated users.
	 * Visitors can enter their contact details manually.
	 */
	async function prefillAuthenticatedUser() {
		try {
			const response = await fetch(SESSION_URL, {
				credentials: 'same-origin',
				cache: 'no-store',
				headers: {
					'Accept': 'application/json'
				}
			});

			if (!response.ok) {
				return;
			}

			const session = await response.json();

			if (!session.authenticated || !session.user) {
				return;
			}

			// Do not overwrite values already entered by the user.
			if (!usernameInput.value) {
				usernameInput.value = session.user.username || '';
			}

			if (!emailInput.value) {
				emailInput.value = session.user.email || '';
			}

		} catch (error) {
			console.error(
				'Unable to prefill contact details:',
				error
			);
		}
	}

	/*
	 * Submit the message as JSON.
	 * The button stays disabled until the request completes.
	 */
	async function submitContactForm(event) {
		event.preventDefault();

		if (sendButton.disabled) {
			return;
		}

		clearFeedback();

		const username = usernameInput.value.trim();
		const email = emailInput.value.trim();
		const message = messageInput.value.trim();

		if (!email || !message) {
			showFeedback(
				'Please provide your email address and a message.',
				'error'
			);
			return;
		}

		if (!emailInput.checkValidity()) {
			showFeedback(
				'Please enter a valid email address.',
				'error'
			);
			emailInput.focus();
			return;
		}

		if (Array.from(message).length > MAX_MESSAGE_LENGTH) {
			showFeedback(
				'Your message must contain no more than 2000 characters.',
				'error'
			);
			messageInput.focus();
			return;
		}

		const payload = {
			username,
			email,
			message
		};

		sendButton.disabled = true;
		sendButton.textContent = 'Sending...';

		try {
			const response = await fetch(CONTACT_URL, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				showFeedback(
					result.message ||
					'Unable to submit your message. Please try again.',
					'error'
				);
				return;
			}

			showFeedback(
				'Your message has been received successfully.',
				'success'
			);

			// Preserve contact details for a subsequent enquiry.
			messageInput.value = '';
			updateMessageCounter();

		} catch (error) {
			console.error(
				'Contact form submission failed:',
				error
			);

			showFeedback(
				'A connection error occurred. Please try again.',
				'error'
			);

		} finally {
			sendButton.disabled = false;
			sendButton.textContent = 'Send Message';
		}
	}

	form.addEventListener('submit', submitContactForm);

	updateMessageCounter();
	prefillAuthenticatedUser();
})();

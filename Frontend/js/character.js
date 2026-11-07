
// =========================
// DOM REFERENCES
// =========================

const characterMessage = document.getElementById('character-message');
const characterContent = document.getElementById('character-content');

const characterImage = document.getElementById('character-image');
const characterName = document.getElementById('character-name');
const characterCreator = document.getElementById('character-creator');
const characterCreatedDate = document.getElementById('character-created-date');

const characterGender = document.getElementById('character-gender');
const characterSkin = document.getElementById('character-skin');
const characterHairStyle = document.getElementById('character-hair-style');
const characterHairColor = document.getElementById('character-hair-color');
const characterEyeColor = document.getElementById('character-eye-color');

const characterEquipment = document.getElementById('character-equipment');

const reviewForm = document.getElementById('review-form');
const reviewLoginNotice = document.getElementById('review-login-notice');
const reviewRating = document.getElementById('review-rating');
const reviewComment = document.getElementById('review-comment');
const reviewSubmit = document.getElementById('review-submit');
const reviewFeedback = document.getElementById('review-feedback');

const reviewsMessage = document.getElementById('reviews-message');
const reviewsList = document.getElementById('reviews-list');

const characterReviewsContent = document.getElementById(
	'character-reviews-content'
);

// =========================
// CHARACTER ID FROM URL
// =========================

const params = new URLSearchParams(window.location.search);
const characterId = params.get('id');

// =========================
// SESSION / NAVBAR
// =========================

/*
 * Check whether the current visitor may
 * submit a review.
 *
 * The shared header manages navigation.
 * Unauthenticated visitors can still read
 * approved reviews and character details.
 */
async function loadSession() {
	reviewForm.hidden = true;
	reviewLoginNotice.hidden = false;

	try {
		const response = await fetch(
			'/FantasyRealm/Backend/api/session.php',
			{
				credentials: 'same-origin',
				cache: 'no-store',
				headers: {
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			throw new Error('Unable to verify session.');
		}

		const data = await response.json();

		if (data.authenticated === true && data.user) {
			reviewForm.hidden = false;
			reviewLoginNotice.hidden = true;
		} else {
			reviewForm.reset();
			reviewFeedback.textContent = '';
			reviewFeedback.hidden = true;
		}

	} catch (error) {
		console.error('Unable to verify review permissions:', error);

		// When session verification fails, keep
		// the review form inaccessible.
		reviewForm.hidden = true;
		reviewLoginNotice.hidden = false;
	}
}

// =========================
// LOAD CHARACTER FROM API
// =========================

async function loadCharacter() {
	if (!characterId) {
		showMessage('No character was selected.');
		return;
	}

	try {
		const response = await fetch(
			`/FantasyRealm/Backend/api/character.php?id=${encodeURIComponent(characterId)}`
		);

		const data = await response.json();

		if (!response.ok || !data.success) {
			showMessage(
				data.message || 'Unable to load character.'
			);
			return;
		}

		renderCharacter(data.character);

		await loadReviews();

	} catch (error) {
		console.error('Unable to load character:', error);
		showMessage('Unable to load character.');
	}
}

// =========================
// DISPLAY CHARACTER DATA
// =========================

function renderCharacter(character) {
	characterName.textContent = character.name;
	characterCreator.textContent = character.creator_username;
	characterCreatedDate.textContent = character.created_at;

	characterGender.textContent =
		character.gender || '—';

	characterSkin.textContent =
		character.skin_color || '—';

	characterHairStyle.textContent =
		character.hair_style || '—';

	characterHairColor.textContent =
		character.hair_color || '—';

	characterEyeColor.textContent =
		character.eye_color || '—';

	if (character.image_path) {
		characterImage.src = `../${character.image_path}`;
		characterImage.alt = character.name;
		characterImage.hidden = false;
	}

	/**
	 * Display the complete character using its saved appearance.
	 *
	 * The shared renderer places a canvas inside the existing
	 * character stage, preserving the page's layout and effects.
	 *
	 * The legacy image is hidden only after a successful render.
	 */
	window.FantasyRealmCharacterRenderer
		.render(characterImage.parentElement, character)
		.then((rendered) => {
			if (rendered) {
				characterImage.hidden = true;
			}
		});

	// Remove old equipment safely.

	characterEquipment.replaceChildren();

	if (
		Array.isArray(character.equipment) &&
		character.equipment.length > 0
	) {
		character.equipment.forEach((item) => {
			const equipmentItem =
				document.createElement('p');

			equipmentItem.textContent = item.name;

			characterEquipment.appendChild(
				equipmentItem
			);
		});
	} else {
		const emptyEquipment =
			document.createElement('p');

		emptyEquipment.textContent = 'No equipment.';

		characterEquipment.appendChild(
			emptyEquipment
		);
	}

	characterMessage.hidden = true;
	characterContent.hidden = false;
	characterReviewsContent.hidden = false;
}

// =========================
// CHARACTER MESSAGES
// =========================

function showMessage(message) {
	characterMessage.textContent = message;
	characterMessage.hidden = false;
	characterContent.hidden = true;
	characterReviewsContent.hidden = true;
}

// =========================
// REVIEW FEEDBACK
// =========================

function showReviewFeedback(message, isError = false) {
	reviewFeedback.textContent = message;

	reviewFeedback.classList.toggle(
		'review-feedback-error',
		isError
	);

	reviewFeedback.hidden = false;
}

// =========================
// SUBMIT CHARACTER REVIEW
// =========================

let reviewSubmissionInProgress = false;

reviewForm.addEventListener('submit', async (event) => {
	event.preventDefault();

	if (reviewSubmissionInProgress) {
		return;
	}

	const id = Number(characterId);
	const rating = Number(reviewRating.value);
	const comment = reviewComment.value.trim();

	// Validate character ID.

	if (!Number.isSafeInteger(id) || id <= 0) {
		showReviewFeedback('Invalid character ID.', true);
		return;
	}

	// Validate rating.

	if (
		!Number.isInteger(rating) ||
		rating < 1 ||
		rating > 5
	) {
		showReviewFeedback(
			'Choose a rating from 1 to 5.',
			true
		);
		return;
	}

	// Validate review comment.

	if (
		comment === '' ||
		Array.from(comment).length > 2000
	) {
		showReviewFeedback(
			'Enter a comment of 1 to 2000 characters.',
			true
		);
		return;
	}

	reviewSubmissionInProgress = true;

	reviewSubmit.disabled = true;
	reviewSubmit.textContent = 'Submitting...';

	reviewFeedback.textContent = '';
	reviewFeedback.hidden = true;

	try {
		// =========================
		// REVIEW CSRF PROTECTION
		// =========================

		const sessionResponse = await fetch(
			'/FantasyRealm/Backend/api/session.php',
			{
				credentials: 'same-origin',
				cache: 'no-store'
			}
		);

		if (!sessionResponse.ok) {
			throw new Error('Unable to retrieve session.');
		}

		const sessionData = await sessionResponse.json();

		if (!sessionData.authenticated) {
			await loadSession();

			showReviewFeedback(
				'Please log in to submit a review.',
				true
			);

			return;
		}

		if (typeof sessionData.csrf_token !== 'string') {
			throw new Error(
				'Unable to verify session security.'
			);
		}

		// =========================
		// SUBMIT REVIEW
		// =========================

		const response = await fetch(
			'/FantasyRealm/Backend/api/submit-review.php',
			{
				method: 'POST',
				credentials: 'same-origin',

				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'X-CSRF-Token': sessionData.csrf_token
				},

				body: JSON.stringify({
					character_id: id,
					rating: rating,
					comment: comment
				})
			}
		);

		const data = await response.json();

		// Session expired.

		if (response.status === 401) {
			await loadSession();

			showReviewFeedback(
				'Please log in to submit a review.',
				true
			);

			return;
		}

		// Handle backend errors.

		if (!response.ok || !data.success) {
			showReviewFeedback(
				data.message || 'Unable to submit your review.',
				true
			);

			return;
		}

		// Review successfully submitted.

		reviewForm.reset();

		showReviewFeedback(
			'Your review has been submitted and is waiting for employee approval.'
		);

	} catch (error) {
		console.error('Unable to submit review:', error);

		showReviewFeedback(
			'Unable to confirm submission. Please check before submitting again.',
			true
		);

	} finally {
		reviewSubmissionInProgress = false;

		reviewSubmit.disabled = false;
		reviewSubmit.textContent = 'Submit Review';
	}
});

// =========================
// LOAD APPROVED REVIEWS
// =========================

async function loadReviews() {
	reviewsList.replaceChildren();

	reviewsMessage.textContent = 'Loading reviews...';
	reviewsMessage.hidden = false;

	try {
		const response = await fetch(
			`/FantasyRealm/Backend/api/reviews.php?character_id=${encodeURIComponent(characterId)}`
		);

		const data = await response.json();

		if (!response.ok || !data.success) {
			reviewsMessage.textContent =
				data.message || 'Unable to load reviews.';

			return;
		}

		if (data.reviews.length === 0) {
			reviewsMessage.textContent =
				'No approved reviews yet.';

			return;
		}

		data.reviews.forEach((review) => {
			reviewsList.appendChild(
				createReviewCard(review)
			);
		});

		reviewsMessage.hidden = true;

	} catch (error) {
		console.error('Unable to load reviews:', error);

		reviewsMessage.textContent =
			'Unable to load reviews.';
	}
}

// =========================
// REVIEW CARDS
// =========================

// Uses textContent to protect against XSS.

function createReviewCard(review) {
	const card = document.createElement('article');
	card.className = 'review-card';

	const header = document.createElement('div');
	header.className = 'review-card-header';

	const username = document.createElement('h3');
	username.className = 'review-author';
	username.textContent = review.reviewer_username;

	const rating = document.createElement('p');
	rating.className = 'review-rating';

	const stars = document.createElement('span');
	stars.setAttribute('aria-hidden', 'true');

	stars.textContent =
		'★'.repeat(review.rating) +
		'☆'.repeat(5 - review.rating);

	const score = document.createElement('span');
	score.textContent = ` ${review.rating}/5`;

	rating.appendChild(stars);
	rating.appendChild(score);

	const comment = document.createElement('p');
	comment.className = 'review-comment';
	comment.textContent = review.comment;

	const date = document.createElement('p');
	date.className = 'review-date';
	date.textContent = `Posted: ${review.created_at}`;

	header.appendChild(username);
	header.appendChild(rating);

	card.appendChild(header);
	card.appendChild(comment);
	card.appendChild(date);

	return card;
}

// =========================
// INITIALIZATION
// =========================

loadSession();
loadCharacter();

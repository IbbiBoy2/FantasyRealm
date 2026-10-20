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

const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutLink = document.getElementById('logout-link');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');

const reviewForm = document.getElementById('review-form');
const reviewLoginNotice = document.getElementById('review-login-notice');
const reviewRating = document.getElementById('review-rating');
const reviewComment = document.getElementById('review-comment');
const reviewSubmit = document.getElementById('review-submit');
const reviewFeedback = document.getElementById('review-feedback');

const reviewsMessage = document.getElementById('reviews-message');
const reviewsList = document.getElementById('reviews-list');

const employeeDashboardLink =
    document.getElementById('employee-dashboard-link');

// =========================
// CHARACTER ID FROM URL
// =========================

// Reads ?id= from character.html?id=...

const params = new URLSearchParams(window.location.search);
const characterId = params.get('id');

// =========================
// SESSION / NAVBAR
// =========================

// Checks whether the visitor is logged in and updates the navbar.

async function loadSession() {

        employeeDashboardLink.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();

        // Shows staff navigation only after a successful authenticated role check.

employeeDashboardLink.hidden = !(
    response.ok &&
    data.authenticated &&
    ['EMPLOYEE', 'ADMIN'].includes(data.user?.role)
);

        if (!response.ok) {
            throw new Error('Unable to verify session.');
        }

        if (data.authenticated) {
            loginLink.hidden = true;
            registerLink.hidden = true;

            usernameDisplay.textContent = data.user.username;
            usernameDisplay.hidden = false;

            settingsMenu.hidden = false;
            reviewForm.hidden = false;
            reviewLoginNotice.hidden = true;
        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.textContent = '';
            usernameDisplay.hidden = true;

            settingsMenu.hidden = true;
            reviewForm.hidden = true;
            reviewLoginNotice.hidden = false;

            reviewForm.reset();
            reviewFeedback.textContent = '';
            reviewFeedback.hidden = true; 
            setSettingsOpen(false);
        }

    } catch (error) {
        console.error('Unable to load session:', error);
    }
}

// =========================
// LOAD CHARACTER FROM API
// =========================

// Requests one approved and shared character from the REST API.

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

// Inserts the JSON returned by the API into the page using the DOM.

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


    characterEquipment.innerHTML = '';

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

        emptyEquipment.textContent =
            'No equipment.';

        characterEquipment.appendChild(
            emptyEquipment
        );
    }


    characterMessage.hidden = true;
    characterContent.hidden = false;
}

// Displays loading/error messages and hides the character content.

function showMessage(message) {
    characterMessage.textContent = message;
    characterMessage.hidden = false;
    characterContent.hidden = true;
}

// =========================
// SETTINGS MENU
// =========================

// Keeps dropdown visibility and its accessibility state synchronized.

function setSettingsOpen(isOpen) {
    settingsDropdown.hidden = !isOpen;

    settingsButton.setAttribute(
        'aria-expanded',
        String(isOpen)
    );
}

settingsButton.addEventListener('click', () => {
    setSettingsOpen(settingsDropdown.hidden);
});

// Closes the dropdown when clicking outside the settings container.

document.addEventListener('click', (event) => {
    if (!settingsMenu.contains(event.target)) {
        setSettingsOpen(false);
    }
});

// Returns keyboard focus to the gear when Escape closes the dropdown.

document.addEventListener('keydown', (event) => {
    if (
        event.key === 'Escape' &&
        !settingsDropdown.hidden
    ) {
        setSettingsOpen(false);
        settingsButton.focus();
    }
});

// =========================
// LOGOUT
// =========================

logoutLink.addEventListener('click', async (event) => {
    event.preventDefault();

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/logout.php',
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('Logout failed:', data.message);
            return;
        }

        await loadSession();

    } catch (error) {
        console.error('Unable to logout:', error);
    }
});

// =========================
// REVIEW FEEDBACK
// =========================

// Displays plain-text feedback without inserting user-supplied HTML.

function showReviewFeedback(message, isError = false) {
    reviewFeedback.textContent = message;
    reviewFeedback.classList.toggle('review-feedback-error', isError);
    reviewFeedback.hidden = false;
}

// =========================
// SUBMIT CHARACTER REVIEW
// =========================

let reviewSubmissionInProgress = false;

// Sends the rating and comment to the API; PHP determines reviewer and status.

reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (reviewSubmissionInProgress) {
        return;
    }

    const id = Number(characterId);
    const rating = Number(reviewRating.value);
    const comment = reviewComment.value.trim();

    if (!Number.isSafeInteger(id) || id <= 0) {
        showReviewFeedback('Invalid character ID.', true);
        return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        showReviewFeedback('Choose a rating from 1 to 5.', true);
        return;
    }

    if (comment === '' || Array.from(comment).length > 2000) {
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
        const response = await fetch(
            '/FantasyRealm/Backend/api/submit-review.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    character_id: id,
                    rating: rating,
                    comment: comment
                })
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            await loadSession();

            showReviewFeedback(
                'Please log in to submit a review.',
                true
            );
            return;
        }

        if (!response.ok || !data.success) {
            showReviewFeedback(
                data.message || 'Unable to submit your review.',
                true
            );
            return;
        }

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

// The REST API returns only approved reviews for an available public character.

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
            reviewsMessage.textContent = 'No approved reviews yet.';
            return;
        }

        data.reviews.forEach((review) => {
            reviewsList.appendChild(createReviewCard(review));
        });

        reviewsMessage.hidden = true;

    } catch (error) {
        console.error('Unable to load reviews:', error);

        reviewsMessage.textContent = 'Unable to load reviews.';
    }
}

// =========================
// REVIEW CARDS
// =========================

// Uses textContent so review comments are displayed as text, not executed as HTML.

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
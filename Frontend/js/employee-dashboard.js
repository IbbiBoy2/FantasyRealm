// =========================
// DOM REFERENCES
// =========================

const employeeMessage = document.getElementById('employee-message');
const employeeContent = document.getElementById('employee-content');

const usernameDisplay = document.getElementById('nav-username');
const employeeUsername = document.getElementById('employee-username');
const employeeRole = document.getElementById('employee-role');

const pendingCharactersCount =
    document.getElementById('pending-characters-count');

const pendingReviewsCount =
    document.getElementById('pending-reviews-count');

const activeAccessoriesCount =
    document.getElementById('active-accessories-count');

const playerAccountsCount =
    document.getElementById('player-accounts-count');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');
const logoutButton = document.getElementById('logout-link');

const pendingCharactersMessage =
    document.getElementById('pending-characters-message');

const pendingCharactersList =
    document.getElementById('pending-characters-list');

const moderationDialog = document.getElementById('moderation-dialog');
const moderationForm = document.getElementById('moderation-form');

const moderationDialogTitle =
    document.getElementById('moderation-dialog-title');

const moderationDialogDescription =
    document.getElementById('moderation-dialog-description');

const rejectionReasonField =
    document.getElementById('rejection-reason-field');

const rejectionReasonInput =
    document.getElementById('rejection-reason');

const moderationError = document.getElementById('moderation-error');
const moderationCancel = document.getElementById('moderation-cancel');
const moderationSubmit = document.getElementById('moderation-submit');

const pendingReviewsMessage =
    document.getElementById('pending-reviews-message');

const pendingReviewsList =
    document.getElementById('pending-reviews-list');

const reviewModerationDialog =
    document.getElementById('review-moderation-dialog');

const reviewModerationForm =
    document.getElementById('review-moderation-form');

const reviewModerationTitle =
    document.getElementById('review-moderation-dialog-title');

const reviewModerationDescription =
    document.getElementById('review-moderation-dialog-description');

const reviewModerationPreview =
    document.getElementById('review-moderation-preview');

const reviewModerationError =
    document.getElementById('review-moderation-error');

const reviewModerationCancel =
    document.getElementById('review-moderation-cancel');

const reviewModerationSubmit =
    document.getElementById('review-moderation-submit');

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

document.addEventListener('click', (event) => {
    if (!settingsMenu.contains(event.target)) {
        setSettingsOpen(false);
    }
});

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
// LOAD EMPLOYEE DASHBOARD
// =========================

// The PHP API checks the current database role before returning staff data.

async function loadEmployeeDashboard() {
    employeeContent.hidden = true;
    settingsMenu.hidden = true;
    await loadPendingCharacters();
    await loadPendingReviews();

    setSettingsOpen(false);

    employeeMessage.textContent = 'Checking employee access...';
    employeeMessage.hidden = false;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/employee-dashboard.php',
            {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (response.status === 403) {
            employeeMessage.textContent =
                'Access denied. An active employee or administrator account is required.';
            return;
        }

        if (!response.ok || !data.success) {
            employeeMessage.textContent =
                data.message || 'Unable to load employee dashboard.';
            return;
        }

        usernameDisplay.textContent = data.user.username;
        employeeUsername.textContent = data.user.username;
        employeeRole.textContent = `Role: ${data.user.role}`;

        pendingCharactersCount.textContent =
            data.statistics.pending_characters;

        pendingReviewsCount.textContent =
            data.statistics.pending_reviews;

        activeAccessoriesCount.textContent =
            data.statistics.active_accessories;

        playerAccountsCount.textContent =
            data.statistics.player_accounts;

        employeeMessage.hidden = true;
        employeeContent.hidden = false;
        settingsMenu.hidden = false;

    } catch (error) {
        console.error('Unable to load employee dashboard:', error);

        employeeMessage.textContent =
            'Unable to load employee dashboard. Please refresh to try again.';
    }
}

// =========================
// LOGOUT
// =========================

// Redirects only after the API confirms the PHP session has ended.

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;

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
            employeeMessage.textContent =
                data.message || 'Unable to log out. Please try again.';

            employeeMessage.hidden = false;
            return;
        }

        window.location.href = 'index.html';

    } catch (error) {
        console.error('Unable to logout:', error);

        employeeMessage.textContent =
            'Unable to log out. Please try again.';

        employeeMessage.hidden = false;

    } finally {
        logoutButton.disabled = false;
    }
});

// =========================
// LOAD PENDING CHARACTERS
// =========================

async function loadPendingCharacters() {
    pendingCharactersList.replaceChildren();

    pendingCharactersMessage.textContent = 'Loading pending characters...';
    pendingCharactersMessage.hidden = false;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/pending-characters.php',
            {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (response.status === 403) {
            employeeContent.hidden = true;
            settingsMenu.hidden = true;

            employeeMessage.textContent = 'Employee access required.';
            employeeMessage.hidden = false;
            return;
        }

        if (!response.ok || !data.success) {
            pendingCharactersMessage.textContent =
                data.message || 'Unable to load pending characters.';
            return;
        }

        if (data.characters.length === 0) {
            pendingCharactersMessage.textContent =
                'No character names are waiting for review.';
            return;
        }

        data.characters.forEach((character) => {
            pendingCharactersList.appendChild(
                createModerationCard(character)
            );
        });

        pendingCharactersMessage.hidden = true;

    } catch (error) {
        console.error('Unable to load pending characters:', error);

        pendingCharactersMessage.textContent =
            'Unable to load pending characters. Please refresh to try again.';
    }
}

// =========================
// CHARACTER MODERATION CARDS
// =========================

// Uses textContent so submitted names are displayed as plain text.

function createModerationCard(character) {
    const card = document.createElement('article');
    card.className = 'moderation-card';

    const name = document.createElement('h3');
    name.textContent = character.name;

    const creator = document.createElement('p');
    creator.className = 'character-meta';
    creator.textContent = `Created by ${character.creator_username}`;

    const date = document.createElement('p');
    date.className = 'character-meta';
    date.textContent = `Submitted: ${character.created_at}`;

    const actions = document.createElement('div');
    actions.className = 'character-actions';

    const approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.className = 'character-action moderation-approve';
    approveButton.textContent = 'Approve';

    approveButton.addEventListener('click', () => {
        openModerationDialog(character, 'APPROVED');
    });

    const rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.className = 'character-action moderation-reject';
    rejectButton.textContent = 'Reject';

    rejectButton.addEventListener('click', () => {
        openModerationDialog(character, 'REJECTED');
    });

    actions.appendChild(approveButton);
    actions.appendChild(rejectButton);

    card.appendChild(name);
    card.appendChild(creator);
    card.appendChild(date);
    card.appendChild(actions);

    return card;
}

// =========================
// MODERATION DIALOG
// =========================

let moderationTarget = null;
let moderationInProgress = false;

function openModerationDialog(character, status) {
    if (moderationDialog.open || moderationInProgress) {
        return;
    }

    moderationTarget = {
        id: character.id,
        status: status
    };

    const rejecting = status === 'REJECTED';

    moderationForm.reset();

    moderationError.textContent = '';
    moderationError.hidden = true;

    rejectionReasonInput.setCustomValidity('');
    rejectionReasonField.hidden = !rejecting;
    rejectionReasonInput.required = rejecting;
    rejectionReasonInput.disabled = !rejecting;

    moderationDialogTitle.textContent = rejecting
        ? 'Reject Character Name'
        : 'Approve Character Name';

    moderationDialogDescription.textContent = rejecting
        ? `Reject "${character.name}"? Explain the reason to its owner.`
        : `Approve "${character.name}"? The character will remain private until its owner shares it.`;

    moderationSubmit.textContent = rejecting
        ? 'Confirm Rejection'
        : 'Confirm Approval';

    moderationSubmit.classList.toggle('moderation-reject', rejecting);
    moderationSubmit.classList.toggle('moderation-approve', !rejecting);

    moderationDialog.showModal();

    if (rejecting) {
        rejectionReasonInput.focus();
    } else {
        moderationCancel.focus();
    }
}

moderationCancel.addEventListener('click', () => {
    if (!moderationInProgress) {
        moderationDialog.close();
    }
});

moderationDialog.addEventListener('cancel', (event) => {
    if (moderationInProgress) {
        event.preventDefault();
    }
});

moderationDialog.addEventListener('close', () => {
    moderationTarget = null;
});

rejectionReasonInput.addEventListener('input', () => {
    rejectionReasonInput.setCustomValidity('');
});

// =========================
// SAVE MODERATION DECISION
// =========================

moderationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!moderationTarget || moderationInProgress) {
        return;
    }

    const target = moderationTarget;
    const rejecting = target.status === 'REJECTED';
    const reason = rejectionReasonInput.value.trim();

    if (
        rejecting &&
        (reason === '' || Array.from(reason).length > 1000)
    ) {
        rejectionReasonInput.setCustomValidity(
            'Enter a rejection reason of 1 to 1000 characters.'
        );

        rejectionReasonInput.reportValidity();
        return;
    }

    const originalButtonText = moderationSubmit.textContent;

    moderationInProgress = true;

    moderationSubmit.disabled = true;
    moderationCancel.disabled = true;
    rejectionReasonInput.disabled = true;

    moderationSubmit.textContent = 'Saving...';

    moderationError.textContent = '';
    moderationError.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/moderate-character.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    character_id: target.id,
                    status: target.status,
                    rejection_reason: rejecting ? reason : null
                })
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (response.status === 403) {
            moderationDialog.close();

            employeeContent.hidden = true;
            settingsMenu.hidden = true;

            employeeMessage.textContent = 'Employee access required.';
            employeeMessage.hidden = false;
            return;
        }

        if (!response.ok || !data.success) {
            moderationError.textContent =
                data.message || 'Unable to save the moderation decision.';

            moderationError.hidden = false;
            return;
        }

        moderationDialog.close();

        await loadEmployeeDashboard();

    } catch (error) {
        console.error('Unable to save moderation decision:', error);

        moderationError.textContent =
            'Unable to confirm the decision. Close this dialog and refresh before trying again.';

        moderationError.hidden = false;

    } finally {
        moderationInProgress = false;

        moderationSubmit.disabled = false;
        moderationCancel.disabled = false;
        rejectionReasonInput.disabled = !rejecting;

        moderationSubmit.textContent = originalButtonText;

        if (moderationDialog.open) {
            if (rejecting) {
                rejectionReasonInput.focus();
            } else {
                moderationCancel.focus();
            }
        }
    }
});

// =========================
// REVIEW MODERATION ACCESS
// =========================

// Handles expired sessions or staff permissions removed while the page is open.

function handleReviewAccessError(response) {
    if (response.status === 401) {
        window.location.href = 'login.html';
        return true;
    }

    if (response.status === 403) {
        if (reviewModerationDialog.open) {
            reviewModerationDialog.close();
        }

        employeeContent.hidden = true;
        settingsMenu.hidden = true;

        employeeMessage.textContent = 'Employee access required.';
        employeeMessage.hidden = false;

        return true;
    }

    return false;
}

// =========================
// LOAD PENDING REVIEWS
// =========================

async function loadPendingReviews() {
    pendingReviewsList.replaceChildren();

    pendingReviewsMessage.textContent = 'Loading pending reviews...';
    pendingReviewsMessage.hidden = false;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/pending-reviews.php',
            {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        if (handleReviewAccessError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            pendingReviewsMessage.textContent =
                data.message || 'Unable to load pending reviews.';
            return;
        }

        if (data.reviews.length === 0) {
            pendingReviewsMessage.textContent =
                'No reviews are waiting for approval.';
            return;
        }

        data.reviews.forEach((review) => {
            pendingReviewsList.appendChild(
                createReviewModerationCard(review)
            );
        });

        pendingReviewsMessage.hidden = true;

    } catch (error) {
        console.error('Unable to load pending reviews:', error);

        pendingReviewsMessage.textContent =
            'Unable to load pending reviews. Please refresh to try again.';
    }
}

// =========================
// REVIEW MODERATION CARDS
// =========================

// Displays submitted comments as plain text rather than interpreting HTML.

function createReviewModerationCard(review) {
    const card = document.createElement('article');
    card.className = 'moderation-card';

    const characterName = document.createElement('h3');
    characterName.textContent = review.character_name;

    const reviewer = document.createElement('p');
    reviewer.className = 'character-meta';
    reviewer.textContent = `Review by ${review.reviewer_username}`;

    const rating = document.createElement('p');
    rating.className = 'moderation-review-rating';
    rating.textContent = `Rating: ${review.rating}/5`;

    const comment = document.createElement('blockquote');
    comment.className = 'moderation-review-comment';
    comment.textContent = review.comment;

    const date = document.createElement('p');
    date.className = 'character-meta';
    date.textContent = `Submitted: ${review.created_at}`;

    const actions = document.createElement('div');
    actions.className = 'character-actions';

    const approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.className = 'character-action moderation-approve';
    approveButton.textContent = 'Approve';

    approveButton.addEventListener('click', () => {
        openReviewModerationDialog(review, 'APPROVED');
    });

    const rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.className = 'character-action moderation-reject';
    rejectButton.textContent = 'Reject';

    rejectButton.addEventListener('click', () => {
        openReviewModerationDialog(review, 'REJECTED');
    });

    actions.appendChild(approveButton);
    actions.appendChild(rejectButton);

    card.appendChild(characterName);
    card.appendChild(reviewer);
    card.appendChild(rating);
    card.appendChild(comment);
    card.appendChild(date);
    card.appendChild(actions);

    return card;
}

// =========================
// REVIEW DECISION DIALOG
// =========================

let reviewModerationTarget = null;
let reviewModerationInProgress = false;

function openReviewModerationDialog(review, status) {
    if (
        reviewModerationDialog.open ||
        reviewModerationInProgress
    ) {
        return;
    }

    reviewModerationTarget = {
        id: review.id,
        status: status
    };

    const rejecting = status === 'REJECTED';

    reviewModerationError.textContent = '';
    reviewModerationError.hidden = true;

    reviewModerationTitle.textContent = rejecting
        ? 'Reject Review'
        : 'Approve Review';

    reviewModerationDescription.textContent =
        `Review by ${review.reviewer_username} for "${review.character_name}", rated ${review.rating}/5. ` +
        (rejecting
            ? 'Rejecting will keep this review hidden.'
            : 'Approving allows this review to appear on the public character page.');

    reviewModerationPreview.textContent = review.comment;

    reviewModerationSubmit.textContent = rejecting
        ? 'Confirm Rejection'
        : 'Confirm Approval';

    reviewModerationSubmit.classList.toggle(
        'moderation-reject',
        rejecting
    );

    reviewModerationSubmit.classList.toggle(
        'moderation-approve',
        !rejecting
    );

    reviewModerationDialog.showModal();
    reviewModerationCancel.focus();
}

reviewModerationCancel.addEventListener('click', () => {
    if (!reviewModerationInProgress) {
        reviewModerationDialog.close();
    }
});

reviewModerationDialog.addEventListener('cancel', (event) => {
    if (reviewModerationInProgress) {
        event.preventDefault();
    }
});

reviewModerationDialog.addEventListener('close', () => {
    reviewModerationTarget = null;
});

// =========================
// SAVE REVIEW DECISION
// =========================

reviewModerationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (
        !reviewModerationTarget ||
        reviewModerationInProgress
    ) {
        return;
    }

    const target = reviewModerationTarget;
    const originalButtonText = reviewModerationSubmit.textContent;

    reviewModerationInProgress = true;

    reviewModerationSubmit.disabled = true;
    reviewModerationCancel.disabled = true;

    reviewModerationSubmit.textContent = 'Saving...';

    reviewModerationError.textContent = '';
    reviewModerationError.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/moderate-review.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    review_id: target.id,
                    status: target.status
                })
            }
        );

        if (handleReviewAccessError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            reviewModerationError.textContent =
                data.message || 'Unable to save the review decision.';

            reviewModerationError.hidden = false;
            return;
        }

        reviewModerationDialog.close();

        await loadEmployeeDashboard();

    } catch (error) {
        console.error('Unable to moderate review:', error);

        reviewModerationError.textContent =
            'Unable to confirm the decision. Close this dialog and refresh before trying again.';

        reviewModerationError.hidden = false;

    } finally {
        reviewModerationInProgress = false;

        reviewModerationSubmit.disabled = false;
        reviewModerationCancel.disabled = false;

        reviewModerationSubmit.textContent = originalButtonText;

        if (reviewModerationDialog.open) {
            reviewModerationCancel.focus();
        }
    }
});

// =========================
// INITIALIZATION
// =========================

loadEmployeeDashboard();
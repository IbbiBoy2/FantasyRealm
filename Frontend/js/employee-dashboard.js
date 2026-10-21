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

    const accessoryForm = document.getElementById('accessory-form');
const accessoryNameInput = document.getElementById('accessory-name');
const accessoryTypeInput = document.getElementById('accessory-type');
const accessoryAddButton = document.getElementById('accessory-add-button');
const accessoryFeedback = document.getElementById('accessory-feedback');

const accessoriesMessage = document.getElementById('accessories-message');
const accessoriesList = document.getElementById('accessories-list');

const accessoryDeleteDialog =
    document.getElementById('accessory-delete-dialog');

const accessoryDeleteForm =
    document.getElementById('accessory-delete-form');

const accessoryDeleteDescription =
    document.getElementById('accessory-delete-description');

const accessoryDeleteError =
    document.getElementById('accessory-delete-error');

const accessoryDeleteCancel =
    document.getElementById('accessory-delete-cancel');

const accessoryDeleteSubmit =
    document.getElementById('accessory-delete-submit');

    const usersMessage = document.getElementById('users-message');
const managedUsersList = document.getElementById('managed-users-list');

const userManagementFeedback =
    document.getElementById('user-management-feedback');

const userActionDialog = document.getElementById('user-action-dialog');
const userActionForm = document.getElementById('user-action-form');
const userActionTitle = document.getElementById('user-action-title');

const userActionDescription =
    document.getElementById('user-action-description');

const userActionError = document.getElementById('user-action-error');
const userActionCancel = document.getElementById('user-action-cancel');
const userActionSubmit = document.getElementById('user-action-submit');

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
    await loadAccessories();
    await loadManagedUsers();

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
// LOAD ACCESSORY CATALOGUE
// =========================

async function loadAccessories() {
    accessoriesList.replaceChildren();

    accessoriesMessage.textContent = 'Loading accessories...';
    accessoriesMessage.hidden = false;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/employee-accessories.php',
            {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (response.status === 403) {
            if (accessoryDeleteDialog.open) {
                accessoryDeleteDialog.close();
            }

            employeeContent.hidden = true;
            settingsMenu.hidden = true;

            employeeMessage.textContent = 'Employee access required.';
            employeeMessage.hidden = false;
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            accessoriesMessage.textContent =
                data.message || 'Unable to load accessories.';
            return;
        }

        if (data.accessories.length === 0) {
            accessoriesMessage.textContent = 'No accessories yet.';
            return;
        }

        data.accessories.forEach((accessory) => {
            accessoriesList.appendChild(
                createAccessoryCard(accessory)
            );
        });

        accessoriesMessage.hidden = true;

    } catch (error) {
        console.error('Unable to load accessories:', error);

        accessoriesMessage.textContent =
            'Unable to load accessories. Please refresh to try again.';
    }
}

// =========================
// ACCESSORY CARDS
// =========================

// Displays catalogue values as plain text.

function createAccessoryCard(accessory) {
    const card = document.createElement('article');
    card.className = 'moderation-card accessory-card';

    const name = document.createElement('h3');
    name.textContent = accessory.name;

    const type = document.createElement('p');
    type.className = 'character-meta';
    type.textContent = `Type: ${accessory.type}`;

    const availability = document.createElement('p');
    availability.className = 'character-meta';
    availability.textContent = accessory.active
        ? 'Availability: Active'
        : 'Availability: Disabled';

    const usage = document.createElement('p');
    usage.className = 'character-meta';
    usage.textContent =
        `Used by ${accessory.usage_count} saved character(s)`;

    card.appendChild(name);
    card.appendChild(type);
    card.appendChild(availability);
    card.appendChild(usage);

    // Changes availability without removing existing character equipment.

    const actions = document.createElement('div');
    actions.className = 'character-actions';

    const availabilityButton = document.createElement('button');

    availabilityButton.type = 'button';
    availabilityButton.className = 'character-action';

    availabilityButton.textContent = accessory.active
        ? 'Disable'
        : 'Enable';

    availabilityButton.addEventListener('click', async () => {
        availabilityButton.disabled = true;

        try {
            await setAccessoryAvailability(
                accessory,
                !accessory.active
            );
        } finally {
            availabilityButton.disabled = false;
        }
    });

    actions.appendChild(availabilityButton);

    // Used items must be disabled instead of deleted.

    const deleteButton = document.createElement('button');

    deleteButton.type = 'button';
    deleteButton.className = 'character-action moderation-reject';
    deleteButton.textContent = 'Delete';

    deleteButton.disabled = accessory.usage_count > 0;

    if (deleteButton.disabled) {
        deleteButton.title =
            'Used by saved characters. Disable this item instead.';
    }

    deleteButton.addEventListener('click', () => {
        openAccessoryDeleteDialog(accessory);
    });

    actions.appendChild(deleteButton);
    card.appendChild(actions);

    return card;
}


// =========================
// ACCESSORY AVAILABILITY
// =========================

// Sends the requested state instead of blindly toggling the database value.

async function setAccessoryAvailability(accessory, active) {
    accessoryFeedback.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/set-accessory-active.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    accessory_id: accessory.id,
                    active: active
                })
            }
        );

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

        const data = await response.json();

        if (!response.ok || !data.success) {
            showAccessoryFeedback(
                data.message || 'Unable to update accessory availability.',
                true
            );
            return;
        }

        showAccessoryFeedback(
            active ? 'Accessory enabled.' : 'Accessory disabled.'
        );

        await loadEmployeeDashboard();

    } catch (error) {
        console.error('Unable to update accessory availability:', error);

        showAccessoryFeedback(
            'Unable to confirm the change. Refresh the catalogue before trying again.',
            true
        );
    }
}

// =========================
// ACCESSORY DELETION DIALOG
// =========================

let accessoryDeleteTarget = null;
let accessoryDeleteInProgress = false;

function openAccessoryDeleteDialog(accessory) {
    if (
        accessoryDeleteDialog.open ||
        accessoryDeleteInProgress
    ) {
        return;
    }

    accessoryDeleteTarget = {
        id: accessory.id
    };

    accessoryDeleteDescription.textContent =
        `Permanently delete "${accessory.name}"? This cannot be undone.`;

    accessoryDeleteError.textContent = '';
    accessoryDeleteError.hidden = true;

    accessoryDeleteDialog.showModal();
    accessoryDeleteCancel.focus();
}

accessoryDeleteCancel.addEventListener('click', () => {
    if (!accessoryDeleteInProgress) {
        accessoryDeleteDialog.close();
    }
});

// Prevents closing while the deletion request is processing.

accessoryDeleteDialog.addEventListener('cancel', (event) => {
    if (accessoryDeleteInProgress) {
        event.preventDefault();
    }
});

accessoryDeleteDialog.addEventListener('close', () => {
    accessoryDeleteTarget = null;
});

// =========================
// DELETE ACCESSORY
// =========================

accessoryDeleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (
        !accessoryDeleteTarget ||
        accessoryDeleteInProgress
    ) {
        return;
    }

    const accessoryId = accessoryDeleteTarget.id;

    accessoryDeleteInProgress = true;

    accessoryDeleteSubmit.disabled = true;
    accessoryDeleteCancel.disabled = true;

    accessoryDeleteSubmit.textContent = 'Deleting...';

    accessoryDeleteError.textContent = '';
    accessoryDeleteError.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/delete-accessory.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    accessory_id: accessoryId
                })
            }
        );

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (response.status === 403) {
            accessoryDeleteDialog.close();

            employeeContent.hidden = true;
            settingsMenu.hidden = true;

            employeeMessage.textContent = 'Employee access required.';
            employeeMessage.hidden = false;
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            accessoryDeleteError.textContent =
                data.message || 'Unable to delete accessory.';

            accessoryDeleteError.hidden = false;
            return;
        }

        accessoryDeleteDialog.close();

        showAccessoryFeedback('Accessory deleted permanently.');

        await loadEmployeeDashboard();

    } catch (error) {
        console.error('Unable to delete accessory:', error);

        accessoryDeleteError.textContent =
            'Unable to confirm deletion. Close this dialog and refresh before trying again.';

        accessoryDeleteError.hidden = false;

    } finally {
        accessoryDeleteInProgress = false;

        accessoryDeleteSubmit.disabled = false;
        accessoryDeleteCancel.disabled = false;

        accessoryDeleteSubmit.textContent = 'Permanently Delete';

        if (accessoryDeleteDialog.open) {
            accessoryDeleteCancel.focus();
        }
    }
});

// =========================
// ACCESSORY FEEDBACK
// =========================

// Displays catalogue action feedback as plain text.

function showAccessoryFeedback(message, isError = false) {
    accessoryFeedback.textContent = message;

    accessoryFeedback.classList.toggle(
        'accessory-feedback-error',
        isError
    );

    accessoryFeedback.hidden = false;
}

// =========================
// ADD ACCESSORY
// =========================

// Sends the new catalogue item's name and type to the protected REST API.

let accessoryAddInProgress = false;

accessoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (accessoryAddInProgress) {
        return;
    }

    const name = accessoryNameInput.value.trim();
    const type = accessoryTypeInput.value;

    if (name === '' || Array.from(name).length > 100) {
        showAccessoryFeedback(
            'Enter an item name of 1 to 100 characters.',
            true
        );
        return;
    }

    if (!['weapon', 'armor', 'clothing', 'accessory'].includes(type)) {
        showAccessoryFeedback('Choose an item type.', true);
        return;
    }

    accessoryAddInProgress = true;

    accessoryAddButton.disabled = true;
    accessoryNameInput.disabled = true;
    accessoryTypeInput.disabled = true;

    accessoryAddButton.textContent = 'Adding...';
    accessoryFeedback.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/add-accessory.php',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    type: type
                })
            }
        );

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

        const data = await response.json();

        if (!response.ok || !data.success) {
            showAccessoryFeedback(
                data.message || 'Unable to add accessory.',
                true
            );
            return;
        }

        accessoryForm.reset();

        showAccessoryFeedback('Accessory added successfully.');

        await loadEmployeeDashboard();

    } catch (error) {
        console.error('Unable to add accessory:', error);

        showAccessoryFeedback(
            'Unable to confirm creation. Refresh the catalogue before trying again.',
            true
        );

    } finally {
        accessoryAddInProgress = false;

        accessoryAddButton.disabled = false;
        accessoryNameInput.disabled = false;
        accessoryTypeInput.disabled = false;

        accessoryAddButton.textContent = '✦ Add Item';
    }
});

// =========================
// USER MANAGEMENT ACCESS
// =========================

// Handles expired sessions and staff permissions removed while the page is open.

function handleUserManagementAccessError(response) {
    if (response.status === 401) {
        window.location.href = 'login.html';
        return true;
    }

    if (response.status === 403) {
        if (userActionDialog.open) {
            userActionDialog.close();
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
// LOAD PLAYER ACCOUNTS
// =========================

async function loadManagedUsers() {
    managedUsersList.replaceChildren();

    usersMessage.textContent = 'Loading player accounts...';
    usersMessage.hidden = false;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/employee-users.php',
            {
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            }
        );

        if (handleUserManagementAccessError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            usersMessage.textContent =
                data.message || 'Unable to load player accounts.';
            return;
        }

        if (data.users.length === 0) {
            usersMessage.textContent = 'No player accounts found.';
            return;
        }

        data.users.forEach((user) => {
            managedUsersList.appendChild(
                createManagedUserCard(user)
            );
        });

        usersMessage.hidden = true;

    } catch (error) {
        console.error('Unable to load player accounts:', error);

        usersMessage.textContent =
            'Unable to load player accounts. Please refresh to try again.';
    }
}

// =========================
// PLAYER ACCOUNT CARDS
// =========================

// Displays account information as plain text.

function createManagedUserCard(user) {
    const card = document.createElement('article');
    card.className = 'moderation-card managed-user-card';

    const username = document.createElement('h3');
    username.textContent = user.username;

    const email = document.createElement('p');
    email.className = 'character-meta';
    email.textContent = user.email;

    const createdDate = document.createElement('p');
    createdDate.className = 'character-meta';
    createdDate.textContent = `Joined: ${user.created_at}`;

    const status = document.createElement('span');

    status.className = user.suspended
        ? 'status-badge status-rejected'
        : 'status-badge status-approved';

    status.textContent = user.suspended
        ? 'Suspended'
        : 'Active';

    card.appendChild(username);
    card.appendChild(email);
    card.appendChild(createdDate);
     card.appendChild(status);

    // Opens confirmation before changing or deleting the selected account.

    const actions = document.createElement('div');
    actions.className = 'character-actions';

    const suspensionButton = document.createElement('button');
    suspensionButton.type = 'button';
    suspensionButton.className = 'character-action';

    suspensionButton.textContent = user.suspended
        ? 'Reactivate'
        : 'Suspend';

    suspensionButton.addEventListener('click', () => {
        openUserActionDialog(
            user,
            user.suspended ? 'reactivate' : 'suspend'
        );
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'character-action moderation-reject';
    deleteButton.textContent = 'Delete Account';

    deleteButton.addEventListener('click', () => {
        openUserActionDialog(user, 'delete');
    });

    actions.appendChild(suspensionButton);
    actions.appendChild(deleteButton);

    card.appendChild(actions);

    return card;
}

// =========================
// USER MANAGEMENT FEEDBACK
// =========================

function showUserManagementFeedback(message, isError = false) {
    userManagementFeedback.textContent = message;

    userManagementFeedback.classList.toggle(
        'accessory-feedback-error',
        isError
    );

    userManagementFeedback.hidden = false;
}

// =========================
// ACCOUNT ACTION DIALOG
// =========================

let userActionTarget = null;
let userActionInProgress = false;

function openUserActionDialog(user, action) {
    if (userActionDialog.open || userActionInProgress) {
        return;
    }

    const descriptions = {
        suspend: {
            title: 'Suspend Account',
            message:
                `Suspend "${user.username}"? They will be blocked from logging in and making protected requests. Their characters and reviews will be preserved.`,
            button: 'Confirm Suspension'
        },
        reactivate: {
            title: 'Reactivate Account',
            message:
                `Reactivate "${user.username}"? They will be able to log in again.`,
            button: 'Reactivate Account'
        },
        delete: {
            title: 'Permanently Delete Account',
            message:
                `Permanently delete "${user.username}"? This removes the account, all its characters, and reviews written by the user or received on their characters. This cannot be undone.`,
            button: 'Permanently Delete'
        }
    };

    const details = descriptions[action];

    if (!details) {
        return;
    }

    userActionTarget = {
        id: user.id,
        action: action
    };

    userActionTitle.textContent = details.title;
    userActionDescription.textContent = details.message;
    userActionSubmit.textContent = details.button;

    userActionSubmit.classList.toggle(
        'moderation-reject',
        action !== 'reactivate'
    );

    userActionSubmit.classList.toggle(
        'moderation-approve',
        action === 'reactivate'
    );

    userActionError.textContent = '';
    userActionError.hidden = true;

    userManagementFeedback.hidden = true;

    userActionDialog.showModal();
    userActionCancel.focus();
}

userActionCancel.addEventListener('click', () => {
    if (!userActionInProgress) {
        userActionDialog.close();
    }
});

// Prevents closing while the account request is processing.

userActionDialog.addEventListener('cancel', (event) => {
    if (userActionInProgress) {
        event.preventDefault();
    }
});

userActionDialog.addEventListener('close', () => {
    userActionTarget = null;
});

// =========================
// SAVE ACCOUNT ACTION
// =========================

userActionForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!userActionTarget || userActionInProgress) {
        return;
    }

    const target = userActionTarget;
    const deleting = target.action === 'delete';

    const endpoint = deleting
        ? '/FantasyRealm/Backend/api/delete-user.php'
        : '/FantasyRealm/Backend/api/set-user-suspended.php';

    const payload = {
        user_id: target.id
    };

    if (!deleting) {
        payload.suspended = target.action === 'suspend';
    }

    const originalButtonText = userActionSubmit.textContent;

    userActionInProgress = true;

    userActionSubmit.disabled = true;
    userActionCancel.disabled = true;
    userActionSubmit.textContent = 'Processing...';

    userActionError.textContent = '';
    userActionError.hidden = true;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (handleUserManagementAccessError(response)) {
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            userActionError.textContent =
                data.message || 'Unable to complete account action.';

            userActionError.hidden = false;
            return;
        }

        userActionDialog.close();

        showUserManagementFeedback(data.message);

        await loadEmployeeDashboard();

    } catch (error) {
        console.error('Unable to manage account:', error);

        userActionError.textContent =
            'Unable to confirm the action. Close this dialog and refresh before trying again.';

        userActionError.hidden = false;

    } finally {
        userActionInProgress = false;

        userActionSubmit.disabled = false;
        userActionCancel.disabled = false;
        userActionSubmit.textContent = originalButtonText;

        if (userActionDialog.open) {
            userActionCancel.focus();
        }
    }
});

// =========================
// INITIALIZATION
// =========================

loadEmployeeDashboard();
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
// INITIALIZATION
// =========================

loadEmployeeDashboard();
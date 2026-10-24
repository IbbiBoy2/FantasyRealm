// =========================
// DOM REFERENCES
// =========================

const usernameDisplay =
    document.getElementById('nav-username');

const dashboardUsername =
    document.getElementById('dashboard-username');

const logoutLink =
    document.getElementById('logout-link');

const characterList =
    document.getElementById('character-list');

const dashboardMessage =
    document.getElementById('dashboard-message');

const totalCount =
    document.getElementById('total-count');

const pendingCount =
    document.getElementById('pending-count');

const approvedCount =
    document.getElementById('approved-count');

const rejectedCount =
    document.getElementById('rejected-count');

const deletedCharacterList =
document.getElementById('deleted-character-list');

const deletedMessage =
    document.getElementById('deleted-message');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');

const duplicateDialog = document.getElementById('duplicate-dialog');
const duplicateForm = document.getElementById('duplicate-form');
const duplicateNameInput = document.getElementById('duplicate-name');
const duplicateError = document.getElementById('duplicate-error');
const duplicateCancel = document.getElementById('duplicate-cancel');
const duplicateSubmit = document.getElementById('duplicate-submit');

const deleteDialog = document.getElementById('delete-dialog');
const deleteForm = document.getElementById('delete-form');
const deleteDialogTitle = document.getElementById('delete-dialog-title');
const deleteDialogDescription = document.getElementById('delete-dialog-description');
const deleteError = document.getElementById('delete-error');
const deleteCancel = document.getElementById('delete-cancel');
const deleteSubmit = document.getElementById('delete-submit');

const employeeDashboardLink =
    document.getElementById('employee-dashboard-link');

// =========================
// SESSION
// =========================

// Verifies the PHP session before displaying the dashboard account controls.

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

        if (!data.authenticated) {
            window.location.href = 'login.html';
            return false;
        }

        usernameDisplay.textContent = data.user.username;
        dashboardUsername.textContent = data.user.username;

        settingsMenu.hidden = false;

        return true;

    } catch (error) {
        console.error('Unable to load session:', error);

        window.location.href = 'login.html';

        return false;
    }
}

// =========================
// LOAD USER CHARACTERS
// =========================

async function loadCharacters() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/my-characters.php'
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok || !data.success) {
            showMessage(
                data.message ||
                'Unable to load your characters.'
            );

            return;
        }

        updateStatistics(data.characters);

        renderCharacters(data.characters);

    } catch (error) {
        console.error(
            'Unable to load characters:',
            error
        );

        showMessage(
            'Unable to load your characters.'
        );
    }
}

// =========================
// LOAD DELETED CHARACTERS
// =========================

async function loadDeletedCharacters() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/deleted-characters.php'
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showDeletedMessage(
                data.message ||
                'Unable to load deleted characters.'
            );

            return;
        }

        renderDeletedCharacters(data.characters);

    } catch (error) {
        console.error(
            'Unable to load deleted characters:',
            error
        );

        showDeletedMessage(
            'Unable to load deleted characters.'
        );
    }
}

// =========================
// STATISTICS
// =========================

function updateStatistics(characters) {
    const pending =
        characters.filter(
            character =>
                character.status === 'PENDING'
        ).length;

    const approved =
        characters.filter(
            character =>
                character.status === 'APPROVED'
        ).length;

    const rejected =
        characters.filter(
            character =>
                character.status === 'REJECTED'
        ).length;

    totalCount.textContent =
        characters.length;

    pendingCount.textContent =
        pending;

    approvedCount.textContent =
        approved;

    rejectedCount.textContent =
        rejected;
}


// =========================
// CHARACTER CARDS
// =========================

function renderCharacters(characters) {
    characterList.innerHTML = '';

    if (characters.length === 0) {
        showMessage(
            'You have not created any characters yet.'
        );

        return;
    }

    dashboardMessage.hidden = true;

    characters.forEach(character => {
        const card =
            createCharacterCard(character);

        characterList.appendChild(card);
    });
}

function createCharacterCard(character) {
    const card =
        document.createElement('article');

    card.className =
        'dashboard-character-card';


    // Character preview

    const preview =
        document.createElement('div');

    preview.className =
        'character-preview';


    if (character.image_path) {
        const image =
            document.createElement('img');

        image.src =
            `../${character.image_path}`;

        image.alt =
            character.name;

        preview.appendChild(image);

    } else {
        const placeholder =
            document.createElement('span');

        placeholder.className =
            'character-placeholder';

        placeholder.textContent =
            '✦';

        preview.appendChild(placeholder);
    }


    // Character information

    const body =
        document.createElement('div');

    body.className =
        'character-card-body';


    const name =
        document.createElement('h3');

    name.textContent =
        character.name;


    const details =
        document.createElement('p');

    details.className =
        'character-meta';

    details.textContent =
        `${character.gender} • ${character.hair_style} hair • ${character.eye_color} eyes`;


    const visibility =
        document.createElement('p');

    visibility.className =
        'character-meta';

    visibility.textContent =
        character.shared
            ? 'Visibility: Shared'
            : 'Visibility: Private';


    const status =
        document.createElement('span');

    status.className =
        `status-badge ${getStatusClass(character.status)}`;

    status.textContent =
        character.status;


    body.appendChild(name);
    body.appendChild(details);
    body.appendChild(visibility);
    body.appendChild(status);

    // Shows the employee's explanation to the owner of a rejected character.

if (
    character.status === 'REJECTED' &&
    character.rejection_reason
) {
    const rejectionReason = document.createElement('p');

    rejectionReason.className = 'rejection-reason';
    rejectionReason.textContent =
        `Rejection reason: ${character.rejection_reason}`;

    body.appendChild(rejectionReason);
}


    // Character management actions

const actions =
    document.createElement('div');

actions.className =
    'character-actions';


// View is available for approved + shared characters.

if (
    character.status === 'APPROVED' &&
    character.shared
) {
    const viewLink =
        document.createElement('a');

    viewLink.className =
        'character-action';

    viewLink.href =
        `character.html?id=${encodeURIComponent(character.id)}`;

    viewLink.textContent =
        'View';

    actions.appendChild(viewLink);
}


// Delete button

const deleteButton =
    document.createElement('button');

deleteButton.type =
    'button';

deleteButton.className =
    'character-action';

deleteButton.textContent =
    'Delete';

deleteButton.addEventListener(
    'click',
    () => deleteCharacter(character)
);

// Opens duplication for this character using a new name.

const duplicateButton = document.createElement('button');

duplicateButton.type = 'button';
duplicateButton.className = 'character-action';
duplicateButton.textContent = 'Duplicate';

duplicateButton.addEventListener('click', async () => {
    duplicateButton.disabled = true;

    try {
        await duplicateCharacter(character);
    } finally {
        duplicateButton.disabled = false;
    }
});

// Owners can share approved characters or unshare an existing shared character.

if (character.status === 'APPROVED' || character.shared) {
    const shareButton = document.createElement('button');

    shareButton.type = 'button';
    shareButton.className = 'character-action';

    shareButton.textContent = character.shared
        ? 'Unshare'
        : 'Share';

    shareButton.addEventListener('click', async () => {
        shareButton.disabled = true;

        try {
            await setCharacterVisibility(
                character,
                !character.shared
            );
        } finally {
            shareButton.disabled = false;
        }
    });

    actions.appendChild(shareButton);
}

actions.appendChild(duplicateButton);

actions.appendChild(deleteButton);

body.appendChild(actions);


    card.appendChild(preview);
    card.appendChild(body);

    return card;
}


function getStatusClass(status) {
    if (status === 'APPROVED') {
        return 'status-approved';
    }

    if (status === 'REJECTED') {
        return 'status-rejected';
    }

    return 'status-pending';
}

// =========================
// CHARACTER VISIBILITY
// =========================

// Sends the desired visibility to the API, then refreshes cards and actions.

async function setCharacterVisibility(character, shared) {
    try {
                // SECURITY: Retrieve the current CSRF token.
        const sessionResponse = await fetch(
            '/FantasyRealm/Backend/api/session.php',
            {
                credentials: 'same-origin',
                cache: 'no-store'
            }
        );

        const sessionData = await sessionResponse.json();

        if (
            !sessionResponse.ok ||
            !sessionData.authenticated ||
            typeof sessionData.csrf_token !== 'string'
        ) {
            alert('Your session has expired. Please log in again.');
            return;
        }

        const response = await fetch(
            '/FantasyRealm/Backend/api/share-character.php',
            {
                method: 'POST',
headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-Token': sessionData.csrf_token
},
                body: JSON.stringify({
                    character_id: character.id,
                    shared: shared
                })
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok || !data.success) {
            alert(
                data.message || 'Unable to update character visibility.'
            );
            return;
        }

        await loadCharacters();

    } catch (error) {
        console.error('Unable to update visibility:', error);

        alert(
            'Unable to confirm the change. Refresh the dashboard before trying again.'
        );
    }
}

// =========================
// DUPLICATE CHARACTER
// =========================

// Stores the selected source character while the dialog is open.

let duplicateSource = null;
let duplicationInProgress = false;

// Opens the dialog instead of the browser's plain prompt.

function duplicateCharacter(character) {
    if (duplicateDialog.open || duplicationInProgress) {
        return;
    }

    duplicateSource = character;

    duplicateForm.reset();
    duplicateError.textContent = '';
    duplicateError.hidden = true;

    duplicateNameInput.setCustomValidity('');

    duplicateDialog.showModal();
    duplicateNameInput.focus();
}

// =========================
// DUPLICATE DIALOG CONTROLS
// =========================

duplicateCancel.addEventListener('click', () => {
    if (!duplicationInProgress) {
        duplicateDialog.close();
    }
});

// Prevents closing with Escape while the API request is processing.

duplicateDialog.addEventListener('cancel', (event) => {
    if (duplicationInProgress) {
        event.preventDefault();
    }
});

duplicateDialog.addEventListener('close', () => {
    duplicateSource = null;
});

duplicateNameInput.addEventListener('input', () => {
    duplicateNameInput.setCustomValidity('');

    duplicateError.textContent = '';
    duplicateError.hidden = true;
});

// =========================
// DUPLICATE FORM SUBMISSION
// =========================

duplicateForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!duplicateSource || duplicationInProgress) {
        return;
    }

    const name = duplicateNameInput.value.trim();

    if (name === '' || Array.from(name).length > 50) {
        duplicateNameInput.setCustomValidity(
            'Enter a character name of 1 to 50 characters.'
        );

        duplicateNameInput.reportValidity();
        return;
    }

    const sourceId = duplicateSource.id;

    duplicationInProgress = true;

    duplicateSubmit.disabled = true;
    duplicateCancel.disabled = true;
    duplicateNameInput.disabled = true;

    duplicateSubmit.textContent = 'Duplicating...';

    duplicateError.textContent = '';
    duplicateError.hidden = true;

    try {
// SECURITY: Retrieve the current CSRF token.
const sessionResponse = await fetch(
    '/FantasyRealm/Backend/api/session.php',
    {
        credentials: 'same-origin',
        cache: 'no-store'
    }
);

const sessionData = await sessionResponse.json();

if (
    !sessionResponse.ok ||
    !sessionData.authenticated ||
    typeof sessionData.csrf_token !== 'string'
) {
    throw new Error('Unable to verify session security.');
}

        const response = await fetch(
            '/FantasyRealm/Backend/api/duplicate-character.php',
            {
                method: 'POST',
headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-Token': sessionData.csrf_token
},
                body: JSON.stringify({
                    character_id: sourceId,
                    name: name
                })
            }
        );

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok || !data.success) {
            duplicateError.textContent =
                data.message || 'Unable to duplicate character.';

            duplicateError.hidden = false;
            return;
        }

        duplicateDialog.close();

        await loadCharacters();

    } catch (error) {
        console.error('Unable to duplicate character:', error);

        duplicateError.textContent =
            'Unable to confirm duplication. Close this dialog and refresh the dashboard before trying again.';

        duplicateError.hidden = false;

    } finally {
        duplicationInProgress = false;

        duplicateSubmit.disabled = false;
        duplicateCancel.disabled = false;
        duplicateNameInput.disabled = false;

        duplicateSubmit.textContent = '✦ Duplicate Character';

        if (duplicateDialog.open) {
            duplicateNameInput.focus();
        }
    }
});

// =========================
// DELETION CONFIRMATION
// =========================

// Stores the selected character and deletion mode while the dialog is open.

let deletionTarget = null;
let deletionInProgress = false;

function openDeleteDialog(character, permanent) {
    if (deleteDialog.open || deletionInProgress) {
        return;
    }

    deletionTarget = {
        id: character.id,
        permanent: permanent
    };

    deleteError.textContent = '';
    deleteError.hidden = true;

    deleteDialogTitle.textContent = permanent
        ? 'Permanently Delete Character'
        : 'Delete Character';

    deleteDialogDescription.textContent = permanent
        ? `Permanently delete "${character.name}"? This removes the character and its related data. This action cannot be undone.`
        : `Move "${character.name}" to Deleted Characters? You can restore it later.`;

    deleteSubmit.textContent = permanent
        ? 'Permanently Delete'
        : 'Move to Deleted Characters';

    deleteDialog.showModal();

    // Starts keyboard focus on the non-destructive action.
    deleteCancel.focus();
}

// Keeps the existing card button handlers connected to the new dialog.

function deleteCharacter(character) {
    openDeleteDialog(character, false);
}

// =========================
// DELETION DIALOG CONTROLS
// =========================

deleteCancel.addEventListener('click', () => {
    if (!deletionInProgress) {
        deleteDialog.close();
    }
});

deleteDialog.addEventListener('cancel', (event) => {
    if (deletionInProgress) {
        event.preventDefault();
    }
});

deleteDialog.addEventListener('close', () => {
    deletionTarget = null;
});

// =========================
// DELETION REQUEST
// =========================

// Calls the existing PHP endpoint for the selected deletion mode.

deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!deletionTarget || deletionInProgress) {
        return;
    }

    const target = deletionTarget;
    const originalButtonText = deleteSubmit.textContent;

    const endpoint = target.permanent
        ? '/FantasyRealm/Backend/api/permanent-delete-character.php'
        : '/FantasyRealm/Backend/api/delete-character.php';

    deletionInProgress = true;

    deleteSubmit.disabled = true;
    deleteCancel.disabled = true;
    deleteSubmit.textContent = 'Deleting...';

    deleteError.textContent = '';
    deleteError.hidden = true;

    try {

// SECURITY: Retrieve the current CSRF token.
const sessionResponse = await fetch(
    '/FantasyRealm/Backend/api/session.php',
    {
        credentials: 'same-origin',
        cache: 'no-store'
    }
);

const sessionData = await sessionResponse.json();

if (
    !sessionResponse.ok ||
    !sessionData.authenticated ||
    typeof sessionData.csrf_token !== 'string'
) {
    throw new Error('Unable to verify session security.');
}
// SECURITY: Send CSRF token with character deletion.
const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': sessionData.csrf_token
    },
            body: JSON.stringify({
                character_id: target.id
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        if (!response.ok || !data.success) {
            deleteError.textContent =
                data.message || 'Unable to delete character.';

            deleteError.hidden = false;
            return;
        }

        deleteDialog.close();

        if (!target.permanent) {
            await loadCharacters();
        }

        await loadDeletedCharacters();

    } catch (error) {
        console.error('Unable to delete character:', error);

        deleteError.textContent =
            'Unable to confirm deletion. Close this dialog and refresh the dashboard before trying again.';

        deleteError.hidden = false;

    } finally {
        deletionInProgress = false;

        deleteSubmit.disabled = false;
        deleteCancel.disabled = false;
        deleteSubmit.textContent = originalButtonText;

        if (deleteDialog.open) {
            deleteCancel.focus();
        }
    }
});

// =========================
// DELETED CHARACTER CARDS
// =========================

function renderDeletedCharacters(characters) {
    deletedCharacterList.innerHTML = '';

    if (characters.length === 0) {
        showDeletedMessage(
            'No deleted characters.'
        );

        return;
    }

    deletedMessage.hidden = true;

    characters.forEach(character => {
        const card =
            createDeletedCharacterCard(character);
            

            

        deletedCharacterList.appendChild(card);
    });
}


function createDeletedCharacterCard(character) {
    const card =
        document.createElement('article');

    card.className =
        'dashboard-character-card';


    const preview =
        document.createElement('div');

    preview.className =
        'character-preview';


    const placeholder =
        document.createElement('span');

    placeholder.className =
        'character-placeholder';

    placeholder.textContent =
        '✦';

    preview.appendChild(placeholder);


    const body =
        document.createElement('div');

    body.className =
        'character-card-body';


    const name =
        document.createElement('h3');

    name.textContent =
        character.name;


    const details =
        document.createElement('p');

    details.className =
        'character-meta';

    details.textContent =
        `${character.gender} • ${character.hair_style} hair • ${character.eye_color} eyes`;


    const deletedDate =
        document.createElement('p');

    deletedDate.className =
        'character-meta';

    deletedDate.textContent =
        `Deleted: ${character.deleted_at}`;


    body.appendChild(name);
    body.appendChild(details);
    body.appendChild(deletedDate);


    const actions =
        document.createElement('div');

    actions.className =
        'character-actions';


    const restoreButton =
        document.createElement('button');

    restoreButton.type =
        'button';

    restoreButton.className =
        'character-action';

    restoreButton.textContent =
        'Restore';

    restoreButton.addEventListener(
        'click',
        () => restoreCharacter(character)
    );

    actions.appendChild(restoreButton);


    const permanentDeleteButton =
        document.createElement('button');

    permanentDeleteButton.type =
        'button';

    permanentDeleteButton.className =
        'character-action';

    permanentDeleteButton.textContent =
        'Permanently Delete';

    permanentDeleteButton.addEventListener(
        'click',
        () => permanentlyDeleteCharacter(character)
    );

    actions.appendChild(permanentDeleteButton);


    body.appendChild(actions);

    card.appendChild(preview);
    card.appendChild(body);

    return card;
}

function showDeletedMessage(message) {
    deletedMessage.textContent =
        message;

    deletedMessage.hidden =
        false;
}

// =========================
// RESTORE CHARACTER
// =========================

async function restoreCharacter(character) {
    try {
                // SECURITY: Retrieve the current CSRF token.
        const sessionResponse = await fetch(
            '/FantasyRealm/Backend/api/session.php',
            {
                credentials: 'same-origin',
                cache: 'no-store'
            }
        );

        const sessionData = await sessionResponse.json();

        if (
            !sessionResponse.ok ||
            !sessionData.authenticated ||
            typeof sessionData.csrf_token !== 'string'
        ) {
            throw new Error('Unable to verify session security.');
        }

        const response = await fetch(
            '/FantasyRealm/Backend/api/restore-character.php',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },

                body: JSON.stringify({
                    character_id: character.id
                })
            }
        );

        const data =
            await response.json();


        if (!response.ok || !data.success) {

            alert(
                data.message ||
                'Unable to restore character.'
            );

            return;
        }


        await loadCharacters();
        await loadDeletedCharacters();


    } catch (error) {

        console.error(
            'Unable to restore character:',
            error
        );

        alert(
            'Unable to restore character.'
        );
    }
}

// =========================
// PERMANENT DELETE
// =========================

// Opens the shared dialog with the permanent-deletion warning.

function permanentlyDeleteCharacter(character) {
    openDeleteDialog(character, true);
}

// =========================
// FEEDBACK
// =========================

function showMessage(message) {
    dashboardMessage.textContent =
        message;

    dashboardMessage.hidden =
        false;
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

// Redirects only after the REST API confirms the PHP session has ended.

logoutLink.addEventListener('click', async () => {
    try {
      
// =========================
// CSRF PROTECTION
// =========================

// Retrieve the current session security token.
const sessionResponse = await fetch(
    '/FantasyRealm/Backend/api/session.php',
    {
        credentials: 'same-origin',
        cache: 'no-store'
    }
);

const sessionData = await sessionResponse.json();

if (
    !sessionResponse.ok ||
    !sessionData.authenticated ||
    typeof sessionData.csrf_token !== 'string'
) {
    throw new Error('Unable to verify session security.');
}

        const response = await fetch(
            '/FantasyRealm/Backend/api/logout.php',
            {
                method: 'POST',
headers: {
    'Accept': 'application/json',
    'X-CSRF-Token': sessionData.csrf_token
}
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            alert(
                data.message || 'Unable to log out. Please try again.'
            );
            return;
        }

        window.location.href = 'index.html';

    } catch (error) {
        console.error('Unable to logout:', error);

        alert(
            'Unable to log out. Please try again.'
        );
    }
});


// =========================
// INITIALIZATION
// =========================

async function initializeDashboard() {
    const authenticated =
        await loadSession();

    if (!authenticated) {
        return;
    }

    await loadCharacters();
    await loadDeletedCharacters();
}

initializeDashboard();
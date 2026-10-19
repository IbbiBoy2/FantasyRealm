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

// =========================
// SESSION
// =========================

// Verifies the PHP session before displaying the dashboard account controls.

async function loadSession() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();

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
// DELETE CHARACTER
// =========================

async function deleteCharacter(character) {

    const confirmed = window.confirm(
        `Delete "${character.name}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/delete-character.php',
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
                'Unable to delete character.'
            );

            return;
        }


        await loadCharacters();


    } catch (error) {

        console.error(
            'Unable to delete character:',
            error
        );

        alert(
            'Unable to delete character.'
        );
    }
}

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

async function permanentlyDeleteCharacter(character) {

    const confirmed = window.confirm(
        `Permanently delete "${character.name}"? This cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/permanent-delete-character.php',
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

        const data = await response.json();

        if (!response.ok || !data.success) {
            alert(
                data.message ||
                'Unable to permanently delete character.'
            );

            return;
        }

        await loadDeletedCharacters();

    } catch (error) {
        console.error(
            'Unable to permanently delete character:',
            error
        );

        alert(
            'Unable to permanently delete character.'
        );
    }
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
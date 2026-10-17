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


// =========================
// SESSION
// =========================

async function loadSession() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = 'login.html';
            return false;
        }

        usernameDisplay.textContent =
            data.user.username;

        dashboardUsername.textContent =
            data.user.username;

        return true;

    } catch (error) {
        console.error(
            'Unable to load session:',
            error
        );

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
// FEEDBACK
// =========================

function showMessage(message) {
    dashboardMessage.textContent =
        message;

    dashboardMessage.hidden =
        false;
}


// =========================
// LOGOUT
// =========================

logoutLink.addEventListener(
    'click',
    async event => {
        event.preventDefault();

        try {
            await fetch(
                '/FantasyRealm/Backend/api/logout.php',
                {
                    method: 'POST',
                    headers: {
                        'Accept':
                            'application/json'
                    }
                }
            );

        } catch (error) {
            console.error(
                'Unable to logout:',
                error
            );
        }

        window.location.href =
            'index.html';
    }
);


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
}

initializeDashboard();
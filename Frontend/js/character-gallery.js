
// =========================
// DOM REFERENCES
// =========================

const galleryGrid = document.getElementById('gallery-grid');
const galleryMessage = document.getElementById('gallery-message');
const galleryPagination = document.getElementById('gallery-pagination');

const creatorFilter = document.getElementById('creator-filter');
const dateFilter = document.getElementById('date-filter');
const clearFiltersButton = document.getElementById('clear-filters');

const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutLink = document.getElementById('logout-link');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');

const employeeDashboardLink =
    document.getElementById('employee-dashboard-link');

// =========================
// GALLERY STATE
// =========================

const charactersPerPage = 60;

let allCharacters = [];
let filteredCharacters = [];
let currentPage = 1;

// =========================
// SESSION / NAVBAR
// =========================

// The gallery is public, so both logged-in and
// logged-out visitors must be able to use it.

async function loadSession() {
    employeeDashboardLink.hidden = true;

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php',
            {
                credentials: 'same-origin',
                cache: 'no-store'
            }
        );

        if (!response.ok) {
            throw new Error('Unable to verify session.');
        }

        const data = await response.json();

        // Show staff navigation only to employees
        // and administrators.

        employeeDashboardLink.hidden = !(
            data.authenticated &&
            ['EMPLOYEE', 'ADMIN'].includes(data.user?.role)
        );

        if (data.authenticated) {
            loginLink.hidden = true;
            registerLink.hidden = true;

            usernameDisplay.textContent = data.user.username;
            usernameDisplay.hidden = false;

            settingsMenu.hidden = false;
        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.textContent = '';
            usernameDisplay.hidden = true;

            settingsMenu.hidden = true;
            setSettingsOpen(false);
        }

    } catch (error) {
        console.error('Unable to load session:', error);
    }
}

// =========================
// LOAD GALLERY DATA
// =========================

// Fetches approved and shared characters.

async function loadCharacters() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/gallery.php',
            {
                credentials: 'same-origin'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showGalleryMessage(
                data.message || 'Unable to load gallery.'
            );
            return;
        }

        allCharacters = Array.isArray(data.characters)
            ? data.characters
            : [];

        applyFilters();

    } catch (error) {
        console.error('Unable to load characters:', error);

        showGalleryMessage(
            'Unable to load characters.'
        );
    }
}

// =========================
// CLIENT-SIDE FILTERING
// =========================

// Filters characters by creator and creation date.

function applyFilters() {
    const creatorValue = creatorFilter.value
        .trim()
        .toLowerCase();

    const dateValue = dateFilter.value;

    filteredCharacters = allCharacters.filter((character) => {
        const creatorName =
            String(character.creator_username || '')
                .toLowerCase();

        const creatorMatches =
            creatorValue === '' ||
            creatorName.includes(creatorValue);

        const characterDate = character.created_at
            ? character.created_at.slice(0, 10)
            : '';

        const dateMatches =
            dateValue === '' ||
            characterDate === dateValue;

        return creatorMatches && dateMatches;
    });

    currentPage = 1;

    renderCharacters();
}

// =========================
// CHARACTER RENDERING
// =========================

// Displays 60 characters per page.

function renderCharacters() {
    galleryGrid.replaceChildren();

    if (filteredCharacters.length === 0) {
        showGalleryMessage(
            'No characters match these filters.'
        );

        galleryPagination.replaceChildren();
        return;
    }

    galleryMessage.hidden = true;

    const startIndex =
        (currentPage - 1) * charactersPerPage;

    const endIndex =
        startIndex + charactersPerPage;

    const charactersForPage =
        filteredCharacters.slice(startIndex, endIndex);

    charactersForPage.forEach((character) => {
        const card = createCharacterCard(character);

        galleryGrid.appendChild(card);
    });

    renderPagination();
}

// =========================
// CREATE CHARACTER CARD
// =========================

// Uses DOM methods and textContent for XSS protection.

function createCharacterCard(character) {
    const card = document.createElement('article');
    card.className = 'character-card';

    // Character display stage.

    const stage = document.createElement('div');
    stage.className = 'character-stage';

    if (character.image_path) {
        const image = document.createElement('img');

        image.src = `../${character.image_path}`;
        image.alt = character.name;
        image.loading = 'lazy';

        stage.appendChild(image);
    }

    // Decorative ring.

    const stageRing = document.createElement('span');
    stageRing.className = 'stage-ring';

    stage.appendChild(stageRing);

    // Character information.

    const info = document.createElement('div');
    info.className = 'character-info';

    const name = document.createElement('h3');
    name.textContent = character.name;

    const creator = document.createElement('p');
    creator.className = 'creator';
    creator.textContent =
        `Created by ${character.creator_username}`;

    const createdDate = document.createElement('p');
    createdDate.className = 'created-date';
    createdDate.textContent = character.created_at;

    // Character details link.

    const viewButton = document.createElement('a');
    viewButton.className = 'view-button';

    viewButton.href =
        `character.html?id=${encodeURIComponent(character.id)}`;

    viewButton.textContent = 'View Character';

    info.appendChild(name);
    info.appendChild(creator);
    info.appendChild(createdDate);
    info.appendChild(viewButton);

    card.appendChild(stage);
    card.appendChild(info);

    return card;
}

// =========================
// PAGINATION
// =========================

// Creates page buttons when more than 60
// characters match the current filters.

function renderPagination() {
    galleryPagination.replaceChildren();

    const totalPages = Math.ceil(
        filteredCharacters.length / charactersPerPage
    );

    if (totalPages <= 1) {
        return;
    }

    for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement('button');

        button.type = 'button';
        button.textContent = page;
        button.className = 'pagination-button';

        if (page === currentPage) {
            button.classList.add('active');

            button.setAttribute(
                'aria-current',
                'page'
            );
        }

        button.addEventListener('click', () => {
            currentPage = page;

            renderCharacters();

            window.scrollTo({
                top: galleryGrid.offsetTop - 120,
                behavior: 'smooth'
            });
        });

        galleryPagination.appendChild(button);
    }
}

// =========================
// GALLERY MESSAGES
// =========================

function showGalleryMessage(message) {
    galleryMessage.textContent = message;
    galleryMessage.hidden = false;
}

// =========================
// SETTINGS MENU
// =========================

function setSettingsOpen(isOpen) {
    settingsDropdown.hidden = !isOpen;

    settingsButton.setAttribute(
        'aria-expanded',
        String(isOpen)
    );
}

// Open or close the settings dropdown.

settingsButton.addEventListener('click', () => {
    setSettingsOpen(settingsDropdown.hidden);
});

// Close when clicking outside.

document.addEventListener('click', (event) => {
    if (!settingsMenu.contains(event.target)) {
        setSettingsOpen(false);
    }
});

// Close with Escape.

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
// GALLERY FILTER EVENTS
// =========================

creatorFilter.addEventListener(
    'input',
    applyFilters
);

dateFilter.addEventListener(
    'change',
    applyFilters
);

clearFiltersButton.addEventListener('click', () => {
    creatorFilter.value = '';
    dateFilter.value = '';

    applyFilters();
});

// =========================
// SECURE LOGOUT
// =========================

// Retrieves the session's CSRF token and uses
// it to authorize the logout request.

logoutLink.addEventListener('click', async (event) => {
    event.preventDefault();

    try {
        // =========================
        // GET CURRENT SESSION
        // =========================

        const sessionResponse = await fetch(
            '/FantasyRealm/Backend/api/session.php',
            {
                credentials: 'same-origin',
                cache: 'no-store'
            }
        );

        if (!sessionResponse.ok) {
            throw new Error(
                'Unable to retrieve session.'
            );
        }

        const sessionData =
            await sessionResponse.json();

        // If the user is already logged out,
        // refresh the navbar.

        if (!sessionData.authenticated) {
            await loadSession();
            return;
        }

        // =========================
        // VALIDATE CSRF TOKEN
        // =========================

        if (typeof sessionData.csrf_token !== 'string') {
            throw new Error(
                'Missing CSRF token.'
            );
        }

        // =========================
        // SEND LOGOUT REQUEST
        // =========================

        const response = await fetch(
            '/FantasyRealm/Backend/api/logout.php',
            {
                method: 'POST',
                credentials: 'same-origin',

                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-Token': sessionData.csrf_token
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'Logout failed.'
            );
        }

        // =========================
        // REFRESH AFTER LOGOUT
        // =========================

        window.location.reload();

    } catch (error) {
        console.error(
            'Unable to logout:',
            error
        );
    }
});

// =========================
// INITIALIZATION
// =========================

loadSession();
loadCharacters();

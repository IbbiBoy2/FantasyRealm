
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

// =========================
// GALLERY STATE
// =========================

// Stores the full API result, the filtered result, and the current page.

const charactersPerPage = 60;

let allCharacters = [];
let filteredCharacters = [];
let currentPage = 1;

// =========================
// SESSION / NAVBAR
// =========================

async function loadSession() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/session.php'
        );

        const data = await response.json();

        if (data.authenticated) {
            loginLink.hidden = true;
            registerLink.hidden = true;

            usernameDisplay.textContent = data.user.username;
            usernameDisplay.hidden = false;

            logoutLink.hidden = false;
        } else {
            loginLink.hidden = false;
            registerLink.hidden = false;

            usernameDisplay.hidden = true;
            logoutLink.hidden = true;
        }

    } catch (error) {
        console.error('Unable to load session:', error);
    }
}

// =========================
// LOAD GALLERY DATA
// =========================

// Fetches approved and shared characters from the REST API.

async function loadCharacters() {
    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/gallery.php'
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showGalleryMessage(
                data.message || 'Unable to load gallery.'
            );
            return;
        }

        allCharacters = data.characters;

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

// Filters the already-loaded characters by creator and creation date.

function applyFilters() {
    const creatorValue = creatorFilter.value
        .trim()
        .toLowerCase();

    const dateValue = dateFilter.value;


    filteredCharacters = allCharacters.filter((character) => {

        const creatorMatches =
            creatorValue === '' ||
            character.creator_username
                .toLowerCase()
                .includes(creatorValue);


        const characterDate =
            character.created_at
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

// Displays only the characters belonging to the current pagination page.

function renderCharacters() {
    galleryGrid.innerHTML = '';

    if (filteredCharacters.length === 0) {
        showGalleryMessage(
            'No characters match these filters.'
        );

        galleryPagination.innerHTML = '';
        return;
    }


    galleryMessage.hidden = true;


    const startIndex =
        (currentPage - 1) * charactersPerPage;

    const endIndex =
        startIndex + charactersPerPage;


    const charactersForPage =
        filteredCharacters.slice(
            startIndex,
            endIndex
        );


    charactersForPage.forEach((character) => {
        const card = createCharacterCard(character);

        galleryGrid.appendChild(card);
    });


    renderPagination();
}

// Builds one gallery card using DOM methods and textContent.

function createCharacterCard(character) {
    const card = document.createElement('article');
    card.className = 'character-card';


    const stage = document.createElement('div');
    stage.className = 'character-stage';


    if (character.image_path) {
        const image = document.createElement('img');

        image.src = `../${character.image_path}`;
        image.alt = character.name;

        stage.appendChild(image);
    }


    const stageRing = document.createElement('span');
    stageRing.className = 'stage-ring';

    stage.appendChild(stageRing);


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

// Creates one pagination button for each required page.

function renderPagination() {
    galleryPagination.innerHTML = '';

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


function showGalleryMessage(message) {
    galleryMessage.textContent = message;
    galleryMessage.hidden = false;
}

// =========================
// EVENT LISTENERS
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
            console.error(
                'Logout failed:',
                data.message
            );

            return;
        }

        await loadSession();

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
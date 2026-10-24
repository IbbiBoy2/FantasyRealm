// =========================
// DOM REFERENCES
// =========================

const creatorForm = document.getElementById('creator-form');
const formMessage = document.getElementById('form-message');
const createButton = document.getElementById('create-button');

const characterNameInput = document.getElementById('character-name');
const selectedWeaponInput = document.getElementById('selected-weapon');

const previewName = document.getElementById('preview-name');
const baseLayer = document.getElementById('base-layer');
const hairLayer = document.getElementById('hair-layer');
const eyesLayer = document.getElementById('eyes-layer');
const weaponLayer = document.getElementById('weapon-layer');

const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const usernameDisplay = document.getElementById('nav-username');
const logoutLink = document.getElementById('logout-link');

const settingsMenu = document.getElementById('settings-menu');
const settingsButton = document.getElementById('settings-button');
const settingsDropdown = document.getElementById('settings-dropdown');

const genderCards = document.querySelectorAll('.gender-card');
const imageChoices = document.querySelectorAll('.image-choice');
const eyeChoices = document.querySelectorAll('.eye-choice');
const colorChoices = document.querySelectorAll('.color-choice');
const weaponChoices = document.querySelectorAll('.weapon-choice');

const employeeDashboardLink =
    document.getElementById('employee-dashboard-link');

    const equipmentMessage = document.getElementById('equipment-message');

const equipmentSelects = {
    weapon: document.getElementById('equipment-weapon'),
    armor: document.getElementById('equipment-armor'),
    clothing: document.getElementById('equipment-clothing'),
    accessory: document.getElementById('equipment-accessory')
};

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
// SESSION CHECK
// =========================

// Checks the PHP session and redirects unauthenticated visitors to Login.

async function loadSession() {

    employeeDashboardLink.hidden = true;

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
            return;
        }

        loginLink.hidden = true;
        registerLink.hidden = true;

        usernameDisplay.textContent = data.user.username;
        usernameDisplay.hidden = false;

        settingsMenu.hidden = false;

    } catch (error) {
        console.error('Unable to load session:', error);

        showMessage(
            'Unable to verify your login session.'
        );
    }
}

// =========================
// CHARACTER CUSTOMIZATION
// =========================

// Returns the selected value from a radio-button group.

function getSelectedValue(name) {
    const selected = document.querySelector(
        `input[name="${name}"]:checked`
    );

    return selected ? selected.value : '';
}

// Builds the live character preview from the selected appearance options.

function updatePreview() {
    const gender = getSelectedValue('gender');
    const hairStyle = getSelectedValue('hair-style');
    const hairColor = getSelectedValue('hair-color');
    const skinTone = getSelectedValue('skin-tone');
    const eyeColor = getSelectedValue('eye-color');

    const weapon = selectedWeaponInput.value;


    if (gender && skinTone) {
        baseLayer.src =
            `../assets/character-parts/base/${gender}-${skinTone}.png`;
    }


    if (hairStyle && hairColor) {
        hairLayer.src =
            `../assets/character-parts/hair/${hairStyle}-${hairColor}.png`;
    }


    if (eyeColor) {
        eyesLayer.src =
            `../assets/character-parts/eyes/${eyeColor}.png`;
    }


    if (weapon) {
        weaponLayer.src =
            `../assets/character-parts/weapons/${weapon}.png`;

        weaponLayer.hidden = false;
    } else {
        weaponLayer.removeAttribute('src');
        weaponLayer.hidden = true;
    }


    const characterName =
        characterNameInput.value.trim();

    previewName.textContent =
        characterName || 'Your Legend';
}

// Updates the visual state of the selected customization controls.

function updateSelectedStyles() {
    genderCards.forEach((card) => {
        const input = card.querySelector('input');

        card.classList.toggle(
            'selected-card',
            input.checked
        );
    });


    imageChoices.forEach((choice) => {
        const input = choice.querySelector('input');

        choice.classList.toggle(
            'selected-choice',
            input.checked
        );
    });


    eyeChoices.forEach((choice) => {
        const input = choice.querySelector('input');

        choice.classList.toggle(
            'selected-choice',
            input.checked
        );
    });


    colorChoices.forEach((choice) => {
        const input = choice.querySelector('input');

        choice.classList.toggle(
            'selected-color',
            input.checked
        );
    });


    weaponChoices.forEach((button) => {
        const isSelected =
            button.dataset.weapon ===
            selectedWeaponInput.value;

        button.classList.toggle(
            'selected-weapon',
            isSelected
        );

        button.setAttribute(
            'aria-pressed',
            isSelected ? 'true' : 'false'
        );
    });
}


function handleAppearanceChange() {
    updateSelectedStyles();
    updatePreview();
}

// =========================
// EVENT LISTENERS
// =========================
document
    .querySelectorAll(
        'input[name="gender"], ' +
        'input[name="hair-style"], ' +
        'input[name="hair-color"], ' +
        'input[name="skin-tone"], ' +
        'input[name="eye-style"], ' +
        'input[name="eye-color"]'
    )
    .forEach((input) => {
        input.addEventListener(
            'change',
            handleAppearanceChange
        );
    });


characterNameInput.addEventListener(
    'input',
    updatePreview
);


weaponChoices.forEach((button) => {
    button.addEventListener('click', () => {
        selectedWeaponInput.value =
            button.dataset.weapon;

        updateSelectedStyles();
        updatePreview();
    });
});

// =========================
// CREATE CHARACTER
// =========================

// Sends the selected character data as JSON to the REST API.

creatorForm.addEventListener(
    'submit',
    async (event) => {
        event.preventDefault();

        // Prevents submission before the available equipment has loaded.

if (!equipmentLoaded) {
    showMessage('Please wait for equipment to load, or refresh if loading failed.');
    return;
}
        
        const characterData = {
            name: characterNameInput.value.trim(),

            gender:
                getSelectedValue('gender'),

            hair_style:
                getSelectedValue('hair-style'),

            hair_color:
                getSelectedValue('hair-color'),

            skin_tone:
                getSelectedValue('skin-tone'),

            eye_style:
                getSelectedValue('eye-style'),

            eye_color:
                getSelectedValue('eye-color'),

accessory_ids: Object.values(equipmentSelects)
    .map(select => select.value)
    .filter(value => value !== '')
    .map(value => Number(value))
        };


        if (
            characterData.name === '' ||
            characterData.gender === '' ||
            characterData.hair_style === '' ||
            characterData.hair_color === '' ||
            characterData.skin_tone === '' ||
            characterData.eye_style === '' ||
            characterData.eye_color === ''
        ) {
            showMessage(
                'Please complete all required character fields.'
            );

            return;
        }


        createButton.disabled = true;
        createButton.textContent =
            'Creating...';

        hideMessage();


        try {

// =========================
// CSRF PROTECTION
// =========================

// Retrieve the authenticated user's CSRF token.
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
                '/FantasyRealm/Backend/api/characters.php',
                {
                    method: 'POST',

headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-Token': sessionData.csrf_token
},

                    body: JSON.stringify(
                        characterData
                    )
                }
            );


            const data = await response.json();


            if (!response.ok || !data.success) {
                showMessage(
                    data.message ||
                    'Unable to create character.'
                );

                return;
            }


            showMessage(
                'Character created successfully and is waiting for approval.'
            );


            creatorForm.reset();

            selectedWeaponInput.value = '';

            updateSelectedStyles();
            updatePreview();


        } catch (error) {
            console.error(
                'Unable to create character:',
                error
            );

            showMessage(
                'Unable to create character.'
            );

        } finally {
            createButton.disabled = false;

            createButton.textContent =
                '✦ Create Character';
        }
    }
);

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
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRF-Token': sessionData.csrf_token
},

            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            showMessage(
                data.message || 'Unable to log out. Please try again.'
            );
            return;
        }

        window.location.href = 'index.html';

    } catch (error) {
        console.error('Unable to logout:', error);

        showMessage(
            'Unable to log out. Please try again.'
        );
    }
});

// =========================
// FORM FEEDBACK
// =========================

function showMessage(message) {
    formMessage.textContent = message;
    formMessage.hidden = false;
}


function hideMessage() {
    formMessage.textContent = '';
    formMessage.hidden = true;
}

// =========================
// LOAD AVAILABLE EQUIPMENT
// =========================

let equipmentLoaded = false;
let availableEquipment = [];

async function loadEquipment() {
    equipmentLoaded = false;
    createButton.disabled = true;

    equipmentMessage.textContent = 'Loading available equipment...';
    equipmentMessage.hidden = false;

    Object.values(equipmentSelects).forEach((select) => {
        select.disabled = true;
        select.replaceChildren(new Option('None', ''));
    });

    try {
        const response = await fetch(
            '/FantasyRealm/Backend/api/accessories.php',
            {
headers: {
    'Accept': 'application/json'
},

                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            equipmentMessage.textContent =
                data.message || 'Unable to load equipment. Please refresh.';
            return;
        }

        availableEquipment = data.accessories;

        availableEquipment.forEach((item) => {
            const select = equipmentSelects[item.type];

            if (select) {
                select.appendChild(
                    new Option(item.name, String(item.id))
                );
            }
        });

        Object.values(equipmentSelects).forEach((select) => {
            select.disabled = false;
        });

        equipmentLoaded = true;
        createButton.disabled = false;

        equipmentMessage.textContent = availableEquipment.length
            ? 'Choose optional equipment for your character.'
            : 'No equipment is currently available. You can create a character without it.';

    } catch (error) {
        console.error('Unable to load equipment:', error);

        equipmentMessage.textContent =
            'Unable to load equipment. Please refresh to try again.';
    }
}

// =========================
// CATALOGUE WEAPON PREVIEW
// =========================

// These weapons already have image files in the project.
// Other catalogue items can be selected without inventing an image path.

equipmentSelects.weapon.addEventListener('change', () => {
    const selectedId = Number(equipmentSelects.weapon.value);

    const weapon = availableEquipment.find(
        item => item.id === selectedId && item.type === 'weapon'
    );

    const previewFiles = new Map([
        ['Iron Sword', 'iron-sword'],
        ['Steel Sword', 'steel-sword'],
        ['Magic Staff', 'magic-staff']
    ]);

    selectedWeaponInput.value = weapon
        ? previewFiles.get(weapon.name) || ''
        : '';

    updatePreview();
});

// =========================
// INITIALIZATION
// =========================

loadSession();

updateSelectedStyles();
updatePreview();
loadEquipment();
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


const params = new URLSearchParams(window.location.search);
const characterId = params.get('id');


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

    } catch (error) {
        console.error('Unable to load character:', error);

        showMessage('Unable to load character.');
    }
}


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


function showMessage(message) {
    characterMessage.textContent = message;
    characterMessage.hidden = false;
    characterContent.hidden = true;
}


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


loadSession();
loadCharacter();
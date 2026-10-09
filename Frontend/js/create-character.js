const baseLayer = document.getElementById('base-layer');
const hairLayer = document.getElementById('hair-layer');
const eyesLayer = document.getElementById('eyes-layer');
const weaponLayer = document.getElementById('weapon-layer');

const hairColorOptions = document.querySelectorAll(
  'input[name="hair-color"]'
);

hairColorOptions.forEach((option) => {
  option.addEventListener('change', () => {
    const color = option.value;

    hairLayer.src =
      `../assets/character-parts/hair/short-${color}.png`;
  });
});

const eyeColorOptions = document.querySelectorAll(
  'input[name="eye-color"]'
);

eyeColorOptions.forEach((option) => {
  option.addEventListener('change', () => {
    const color = option.value;

    eyesLayer.src =
      `../assets/character-parts/eyes/${color}.png`;
  });
});

const weaponChoices = document.querySelectorAll('.weapon-choice');
const selectedWeapon = document.getElementById('selected-weapon');

weaponChoices.forEach((button) => {
  button.addEventListener('click', () => {
    const weapon = button.dataset.weapon;

    selectedWeapon.value = weapon;

    weaponChoices.forEach((choice) => {
      choice.classList.remove('selected-weapon');
    });

    button.classList.add('selected-weapon');

    if (weapon === '') {
      weaponLayer.removeAttribute('src');
    } else {
      weaponLayer.src =
        `../assets/character-parts/weapons/${weapon}.png`;
    }
  });
});


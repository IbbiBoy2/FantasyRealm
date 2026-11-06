/**
 * FANTASYREALM - APPROVED CHARACTER EDIT MODE
 *
 * Activates only with create-character.html?edit=ID.
 * Reuses the existing creator for face, hair and skin controls.
 * Adds compatible equipment choices and mandatory audited saving.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const characterId = Number(params.get('edit'));
  if (!Number.isSafeInteger(characterId) || characterId <= 0) return;

  const API = '/FantasyRealm/Backend/api/';
  const byId = id => document.getElementById(id);
  let equipment = [];
  let currentCharacter = null;
  let selected = new Set();
  let loading = true;
  let saving = false;
  let previewCounter = 0;
  let equipmentCanvas;
  const imageCache = new Map();
  const WIDTH = 568;
  const HEIGHT = 1275;

  function feedback(message, error = false) {
    const target = byId('form-feedback');
    target.hidden = false;
    target.textContent = message;
    target.classList.toggle('is-error', error);
  }

  async function getJSON(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.message || 'Unable to load data.');
    return result;
  }

  function setColor(kind, hex) {
    const picker = byId(`${kind}-color`);
    picker.value = hex;
    picker.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function selectStyle(feature, number) {
    const candidate = Array.from(byId(`${feature}-options`).querySelectorAll('button'))
      .find(button => button.getAttribute('aria-label') === `${feature} style ${number}`);
    if (!candidate) throw new Error(`Unavailable ${feature} style: ${number}`);
    candidate.click();
  }

  /** Read the actual visible creator controls; no duplicate editing state. */
  function appearance() {
    const chosen = feature => {
      const node = byId(`${feature}-options`).querySelector('[aria-pressed="true"]');
      return node ? Number(node.getAttribute('aria-label').match(/\d+$/)?.[0]) : NaN;
    };
    return {
      nose_style: chosen('nose'), mouth_style: chosen('mouth'),
      eye_style: chosen('eyes'), hair_style: chosen('hair'),
      skin_color: byId('skin-color').value,
      eye_color: byId('eye-color').value,
      hair_color: byId('hair-color').value
    };
  }

  function equipmentGroup(type) {
    return equipment.filter(item => item.type === type &&
      (type === 'armor' || type === 'clothing' ? item.gender === currentCharacter.gender : item.gender === null));
  }

  function addEquipmentControls() {
    const form = byId('character-creator-form');
    const actions = form.querySelector('.creator-form-actions');
    const section = document.createElement('section');
    section.className = 'creator-group';
    section.id = 'edit-equipment-section';
    const title = document.createElement('h3');
    title.textContent = 'Equipment';
    section.appendChild(title);
    const hint = document.createElement('p');
    hint.className = 'creator-hint';
    hint.textContent = 'Choose one armor or clothing item, up to one weapon, and optional accessories. Armor and clothing match your character body type.';
    section.appendChild(hint);
    for (const [type, label] of [['armor', 'Armor'], ['clothing', 'Clothing'], ['weapon', 'Weapons'], ['accessory', 'Accessories']]) {
      const heading = document.createElement('h4');
      heading.textContent = label;
      section.appendChild(heading);
      const items = equipmentGroup(type);
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'creator-hint';
        empty.textContent = 'No available items.';
        section.appendChild(empty);
        continue;
      }
      const holder = document.createElement('div');
      holder.className = 'edit-equipment-grid';
      for (const item of items) {
        const labelNode = document.createElement('label');
        labelNode.className = 'edit-equipment-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = selected.has(item.id);
        input.value = String(item.id);
        const name = document.createElement('span');
        name.textContent = item.name;
        labelNode.append(input, name);
        holder.appendChild(labelNode);
        input.addEventListener('change', () => {
          if (input.checked) {
            if (['armor', 'clothing', 'weapon'].includes(item.type)) {
              for (const old of Array.from(selected)) {
                const oldItem = equipment.find(entry => entry.id === old);
                if (oldItem && (item.type === 'weapon' ? oldItem.type === 'weapon' : ['armor', 'clothing'].includes(oldItem.type))) selected.delete(old);
              }
            }
            selected.add(item.id);
          } else selected.delete(item.id);
          section.querySelectorAll('input[type="checkbox"]').forEach(node => { node.checked = selected.has(Number(node.value)); });
          updateEquipmentPreview();
        });
      }
      section.appendChild(holder);
    }
    actions.before(section);
  }

  function safeImageURL(path) {
    if (typeof path !== 'string' || !/^\/FantasyRealm\/Frontend\/assets\/accessories\/[a-zA-Z0-9_.-]+$/.test(path)) {
      throw new Error('Invalid equipment image path.');
    }
    return path;
  }

  function loadImage(path, strictSize = true) {
    const key = `${path}:${strictSize}`;
    if (!imageCache.has(key)) {
      imageCache.set(key, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => (!strictSize || (image.naturalWidth === WIDTH && image.naturalHeight === HEIGHT))
          ? resolve(image) : reject(new Error('Equipment artwork must be 568 × 1275.'));
        image.onerror = () => reject(new Error('Unable to load character artwork.'));
        image.src = path;
      }).catch(error => { imageCache.delete(key); throw error; }));
    }
    return imageCache.get(key);
  }

  function freshCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH; canvas.height = HEIGHT;
    return canvas;
  }

  /** Same grayscale-preserving skin tint as the saved-character renderer. */
  function tintSkin(canvas, hex) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.getImageData(0, 0, WIDTH, HEIGHT);
    const data = image.data;
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const weight = Math.max(0, Math.min(1, (38 - chroma) / 25)) * 0.91;
      if (!weight) continue;
      const luminance = .2126 * r + .7152 * g + .0722 * b;
      const shade = Math.pow(luminance / 245, .83);
      data[i] = r * (1 - weight) + rgb[0] * shade * weight;
      data[i + 1] = g * (1 - weight) + rgb[1] * shade * weight;
      data[i + 2] = b * (1 - weight) + rgb[2] * shade * weight;
    }
    context.putImageData(image, 0, 0);
  }

  function tintedCopy(image, color) {
    const canvas = freshCanvas(), ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  async function composeEquipped() {
    const wearable = equipment.find(item => selected.has(item.id) && ['armor', 'clothing'].includes(item.type));
    const folder = currentCharacter.gender === 'male' ? 'homme' : 'femme';
    const male = currentCharacter.gender === 'male';
    const root = `../assets/character-creator/${folder}/`;
    const a = appearance();
    const paths = [
      wearable ? safeImageURL(wearable.body_image_path) : `${root}${folder}.png`,
      `${root}nez_${folder}_${a.nose_style}.png`,
      `${root}${male ? 'bouches' : 'bouche'}_${folder}_${a.mouth_style}.png`,
      `${root}yeux_${folder}_${a.eye_style}.png`,
      `${root}cheveux_${folder}_${a.hair_style}.png`
    ];
    const [body, nose, mouth, eyes, hair] = await Promise.all(paths.map(loadImage));
    const output = freshCanvas(), context = output.getContext('2d');
    if (wearable) context.drawImage(await loadImage(safeImageURL(wearable.image_path)), 0, 0);
    const skin = freshCanvas(), skinCtx = skin.getContext('2d');
    skinCtx.drawImage(body, 0, 0); skinCtx.drawImage(nose, 0, 0);
    tintSkin(skin, a.skin_color);
    context.drawImage(skin, 0, 0);
    context.drawImage(mouth, 0, 0);
    context.drawImage(eyes, 0, 0);
    const iris = tintedCopy(eyes, a.eye_color), mask = freshCanvas(), maskCtx = mask.getContext('2d');
    maskCtx.fillStyle = 'white';
    for (const centerX of [269, 309]) {
      maskCtx.beginPath(); maskCtx.ellipse(centerX, male ? 176 : 206, 7, 9, 0, 0, Math.PI * 2); maskCtx.fill();
    }
    const irisCtx = iris.getContext('2d');
    irisCtx.globalCompositeOperation = 'destination-in'; irisCtx.drawImage(mask, 0, 0);
    context.drawImage(iris, 0, 0);
    context.drawImage(tintedCopy(hair, a.hair_color), 0, 0);
    const top = equipment.filter(item => selected.has(item.id) && ['weapon', 'accessory'].includes(item.type));
    for (const item of top) context.drawImage(await loadImage(safeImageURL(item.image_path), false), 0, 0);
    return output;
  }

  async function updateEquipmentPreview() {
    if (loading) return;
    const serial = ++previewCounter;
    const original = byId('character-preview');
    try {
      const rendered = await composeEquipped();
      if (serial !== previewCounter) return;
      equipmentCanvas.getContext('2d').clearRect(0, 0, WIDTH, HEIGHT);
      equipmentCanvas.getContext('2d').drawImage(rendered, 0, 0);
      original.style.visibility = 'hidden';
      equipmentCanvas.hidden = false;
    } catch (error) {
      if (serial !== previewCounter) return;
      console.warn('Equipment preview:', error);
      equipmentCanvas.hidden = true;
      original.style.visibility = '';
      feedback(error.message || 'Unable to render equipment.', true);
    }
  }

  async function initialize() {
    const form = byId('character-creator-form');
    if (!form) return;
    form.addEventListener('submit', async event => {
      // Capture phase runs before the existing creator submit handler.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (loading || saving || !form.reportValidity()) return;
      saving = true;
      byId('create-button').disabled = true;
      feedback('Saving changes and recording the history…');
      try {
        const session = await getJSON(`${API}session.php`);
        if (!session.authenticated || typeof session.csrf_token !== 'string') throw new Error('Please sign in again.');
        const response = await fetch(`${API}edit-character.php`, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': session.csrf_token },
          body: JSON.stringify({ character_id: characterId, ...appearance(), equipment_ids: [...selected] })
        });
        const result = await response.json();
        if (!response.ok || !result.success || result.history_logged !== true) throw new Error(result.message || 'Unable to save the character.');
        feedback('Character saved and added to the customization history.');
        location.assign('dashboard.html');
      } catch (error) {
        feedback(error.message || 'Unable to save the character.', true);
      } finally {
        saving = false;
        byId('create-button').disabled = false;
      }
    }, true);

    const title = document.querySelector('.creator-title-bar h1');
    if (title) title.textContent = 'Edit Your Hero';
    document.title = 'Edit Character | FantasyRealm';
    byId('create-button').textContent = '✦ Save Changes';
    byId('create-button').disabled = true;
    equipmentCanvas = freshCanvas();
    equipmentCanvas.id = 'edit-equipment-preview';
    equipmentCanvas.setAttribute('role', 'img');
    equipmentCanvas.setAttribute('aria-label', 'Equipped character preview');
    equipmentCanvas.hidden = true;
    byId('character-preview').after(equipmentCanvas);

    try {
      const [characterResponse, catalogue] = await Promise.all([
        getJSON(`${API}edit-character.php?id=${encodeURIComponent(characterId)}`),
        getJSON(`${API}accessories.php`)
      ]);
      currentCharacter = characterResponse.character;
      equipment = catalogue.accessories;
      selected = new Set(currentCharacter.equipment_ids);
      byId('character-name').value = currentCharacter.name;
      byId('character-name').readOnly = true;
      byId('character-name').dispatchEvent(new Event('input', { bubbles: true }));
      const genderInput = form.querySelector(`input[name="gender"][value="${currentCharacter.gender}"]`);
      if (!genderInput) throw new Error('Invalid saved character body type.');
      genderInput.checked = true;
      genderInput.dispatchEvent(new Event('change', { bubbles: true }));
      form.querySelectorAll('input[name="gender"]').forEach(input => { input.disabled = true; });
      selectStyle('nose', currentCharacter.nose_shape);
      selectStyle('mouth', currentCharacter.mouth_shape);
      selectStyle('eyes', currentCharacter.eye_shape);
      selectStyle('hair', currentCharacter.hair_style);
      setColor('skin', currentCharacter.skin_color);
      setColor('eye', currentCharacter.eye_color);
      setColor('hair', currentCharacter.hair_color);
      addEquipmentControls();
      loading = false;
      byId('create-button').disabled = false;
      await updateEquipmentPreview();

      // Any existing creator control triggers an updated equipped preview.
      form.addEventListener('click', event => {
        if (event.target.closest('#edit-equipment-section')) return;
        queueMicrotask(updateEquipmentPreview);
      });
      form.addEventListener('input', event => {
        if (event.target.type === 'color') queueMicrotask(updateEquipmentPreview);
      });
    } catch (error) {
      feedback(error.message || 'Unable to load the approved character.', true);
      byId('create-button').disabled = true;
    }
  }

  // The standard creator registers DOMContentLoaded before this companion script.
  document.addEventListener('DOMContentLoaded', initialize);
})();

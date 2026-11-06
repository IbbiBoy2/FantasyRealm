/**
 * FANTASYREALM - SHARED CHARACTER RENDERER
 *
 * One composition pipeline for the dashboard, gallery, detail page and
 * saved appearances. The nose and body are tinted together.
 *
 * Render order (bottom to top): armor/clothing, replacement body,
 * nose + skin tint, mouth, eyes + iris tint, hair + hair tint,
 * weapon, accessories.
 *
 * The PHP endpoints supply character.equipment as an array of items with
 * type, gender, image_path and body_image_path. No extra browser API requests.
 */
(() => {
  'use strict';

  const WIDTH = 568;
  const HEIGHT = 1275;
  const ROOT = '../assets/character-creator/';
  const LIMITS = { nose_shape: 10, mouth_shape: 7, eye_shape: 7, hair_style: 10 };
  const imageCache = new Map();

  /** Validate appearance values before attempting to build image paths. */
  function isRenderable(character) {
    if (!character || !['male', 'female'].includes(character.gender)) return false;
    for (const [field, maximum] of Object.entries(LIMITS)) {
      const value = Number(character[field]);
      if (!Number.isInteger(value) || value < 1 || value > maximum) return false;
    }
    return ['skin_color', 'eye_color', 'hair_color'].every(
      key => typeof character[key] === 'string' && /^#[0-9a-f]{6}$/i.test(character[key])
    );
  }

  /** Never load arbitrary external image URLs supplied by API data. */
  function equipmentURL(value) {
    if (typeof value !== 'string') throw new Error('Missing equipment image path.');
    if (!/^\/FantasyRealm\/Frontend\/assets\/accessories\/[A-Za-z0-9_.-]+$/.test(value)) {
      throw new Error('Unexpected equipment image path.');
    }
    return value;
  }

  function appearancePaths(character, replacementBody) {
    const male = character.gender === 'male';
    const folder = male ? 'homme' : 'femme';
    const root = `${ROOT}${folder}/`;
    return [
      replacementBody || `${root}${folder}.png`,
      `${root}nez_${folder}_${Number(character.nose_shape)}.png`,
      `${root}${male ? 'bouches' : 'bouche'}_${folder}_${Number(character.mouth_shape)}.png`,
      `${root}yeux_${folder}_${Number(character.eye_shape)}.png`,
      `${root}cheveux_${folder}_${Number(character.hair_style)}.png`
    ];
  }

  /** Cache successful downloads and retry after transient failures. */
  function loadImage(url, requireCanvasSize = true) {
    const key = `${url}|${requireCanvasSize}`;
    if (!imageCache.has(key)) {
      imageCache.set(key, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (requireCanvasSize && (img.naturalWidth !== WIDTH || img.naturalHeight !== HEIGHT)) {
            reject(new Error(`Invalid character artwork dimensions: ${url}`));
          } else {
            resolve(img);
          }
        };
        img.onerror = () => reject(new Error(`Unable to load character artwork: ${url}`));
        img.src = url;
      }).catch(error => {
        imageCache.delete(key);
        throw error;
      }));
    }
    return imageCache.get(key);
  }

  function makeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    return canvas;
  }

  /** Preserve original skin shadows while applying the saved color. */
  function tintSkin(canvas, hex) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    const pixels = image.data;
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < pixels.length; i += 4) {
      if (!pixels[i + 3]) continue;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const weight = Math.max(0, Math.min(1, (38 - chroma) / 25)) * 0.91;
      if (!weight) continue;
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const shade = Math.pow(luminance / 245, 0.83);
      pixels[i] = r * (1 - weight) + rgb[0] * shade * weight;
      pixels[i + 1] = g * (1 - weight) + rgb[1] * shade * weight;
      pixels[i + 2] = b * (1 - weight) + rgb[2] * shade * weight;
    }
    ctx.putImageData(image, 0, 0);
  }

  /** Multiply tint on a transparent layer without losing its alpha. */
  function tintedCopy(image, hex) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  /** Color iris regions without altering the rest of the eye artwork. */
  function drawEyes(ctx, image, color, gender) {
    ctx.drawImage(image, 0, 0);
    const tinted = tintedCopy(image, color);
    const mask = makeCanvas();
    const maskCtx = mask.getContext('2d');
    maskCtx.fillStyle = 'white';
    for (const centerX of [269, 309]) {
      maskCtx.beginPath();
      maskCtx.ellipse(centerX, gender === 'male' ? 176 : 206, 7, 9, 0, 0, Math.PI * 2);
      maskCtx.fill();
    }
    const tintCtx = tinted.getContext('2d');
    tintCtx.globalCompositeOperation = 'destination-in';
    tintCtx.drawImage(mask, 0, 0);
    tintCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tinted, 0, 0);
  }

  /**
   * Normalize equipment and ignore incompatible legacy items.
   * Backend validation prevents new invalid combinations; this validation
   * makes historical or inconsistent saved records safe to display.
   */
  function getEquipment(character) {
    const entries = Array.isArray(character.equipment) ? character.equipment : [];
    const valid = entries.filter(item => item &&
      ['armor', 'clothing', 'weapon', 'accessory'].includes(item.type));
    const wearable = valid.find(item =>
      ['armor', 'clothing'].includes(item.type) && item.gender === character.gender);
    const weapon = valid.find(item => item.type === 'weapon');
    const accessories = valid.filter(item => item.type === 'accessory');
    return { wearable, weapon, accessories };
  }

  /** Compose one 568 x 1275 character with every equipped layer. */
  async function compose(character) {
    if (!isRenderable(character)) return null;
    const { wearable, weapon, accessories } = getEquipment(character);
    const paths = appearancePaths(
      character,
      wearable ? equipmentURL(wearable.body_image_path) : null
    );
    const [body, nose, mouth, eyes, hair] = await Promise.all(paths.map(url => loadImage(url)));

    const result = makeCanvas();
    const ctx = result.getContext('2d');

    // Equipment artwork is the bottommost layer and is never skin-tinted.
    if (wearable) ctx.drawImage(await loadImage(equipmentURL(wearable.image_path)), 0, 0);

    // Body AND nose share precisely one tinting pass.
    const skin = makeCanvas();
    const skinCtx = skin.getContext('2d');
    skinCtx.drawImage(body, 0, 0);
    skinCtx.drawImage(nose, 0, 0);
    tintSkin(skin, character.skin_color);
    ctx.drawImage(skin, 0, 0);

    ctx.drawImage(mouth, 0, 0);
    drawEyes(ctx, eyes, character.eye_color, character.gender);
    ctx.drawImage(tintedCopy(hair, character.hair_color), 0, 0);

    // Unisex weapon and accessories always appear on top.
    if (weapon) {
      ctx.drawImage(await loadImage(equipmentURL(weapon.image_path), false), 0, 0, WIDTH, HEIGHT);
    }
    for (const item of accessories) {
      ctx.drawImage(await loadImage(equipmentURL(item.image_path), false), 0, 0, WIDTH, HEIGHT);
    }
    return result;
  }

  /** Drop-in replacement for the existing dashboard/gallery/detail calls. */
  async function render(container, character) {
    if (!container || !isRenderable(character)) return false;
    try {
      const canvas = await compose(character);
      if (!canvas || !container.isConnected) return false;
      canvas.className = 'saved-character-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Appearance of ${character.name || 'character'}`);
      container.querySelectorAll('.saved-character-canvas').forEach(node => node.remove());
      container.prepend(canvas);
      return true;
    } catch (error) {
      console.warn('FantasyRealm: saved character renderer failed', error);
      return false;
    }
  }

  window.FantasyRealmCharacterRenderer = Object.freeze({ render, compose, isRenderable });
})();

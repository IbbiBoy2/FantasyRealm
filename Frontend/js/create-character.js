/**
 * FANTASYREALM - CHARACTER CREATOR
 *
 * This file manages the interactive character creation interface.
 *
 * Main responsibilities:
 * 1. Load the PNG assets for the selected body type.
 * 2. Display selectable facial features and hairstyles.
 * 3. Apply skin, eye and hair colors.
 * 4. Compose the character using the Canvas API.
 * 5. Update the live preview when customization options change.
 * 6. Export the character preview as a PNG image.
 * 7. Send the validated character data to the PHP API.
 *
 * CHARACTER PERSISTENCE:
 * The PHP API validates and stores character information
 * in MariaDB using the characters and appearances tables.
 *
 * Newly created characters receive the PENDING status
 * and must be approved by an employee or administrator
 * before further customization and sharing.
 *
 * A character creation event is also recorded in MongoDB
 * when the history logging service is available.
 */

(() => {
	'use strict';

	// =========================================================
	// 1. IMAGE DIMENSIONS AND ASSET CONFIGURATION
	// =========================================================

	// All source images share the same canvas dimensions.
	// Drawing them at the same coordinates preserves alignment.
	const WIDTH = 568;
	const HEIGHT = 1275;

	// Folder names must match GitHub exactly.
	// Linux and Docker paths are case-sensitive.
	const ASSET_ROOT = '../assets/character-creator/';

	/**
	 * Available image indexes for each body type.
	 *
	 * The male mouth files use "bouches_homme".
	 * The female mouth files use "bouche_femme".
	 *
	 * New hairstyles can be added by extending these arrays.
	 */
	const CATALOGUE = {
		male: {
			folder: 'homme',
			nose: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			mouth: [1, 2, 3, 4, 5, 6, 7],
			eyes: [1, 2, 3, 4, 5, 6, 7],
			hair: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			mouthPrefix: 'bouches'
		},

		female: {
			folder: 'femme',
			nose: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			mouth: [1, 2, 3, 4, 5, 6, 7],
			eyes: [1, 2, 3, 4, 5, 6, 7],
			hair: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			mouthPrefix: 'bouche'
		}
	};

	// Suggested colors displayed as clickable swatches.
	// Players can also choose any HEX color using the color picker.
	const COLOR_PRESETS = {
		skin: [
			'#f2d5bf',
			'#d8b39a',
			'#b78060',
			'#8b5846',
			'#57392f',
			'#d9a17b'
		],

		eye: [
			'#57b8ff',
			'#4c9f78',
			'#8c6ad9',
			'#b58c4e',
			'#7d5348',
			'#a8a9af'
		],

		hair: [
			'#d3b278',
			'#3e3042',
			'#8b513c',
			'#d4d3d8',
			'#a64d78',
			'#aa8ce0'
		]
	};

	const FEATURES = ['nose', 'mouth', 'eyes', 'hair'];
	const COLOR_KINDS = ['skin', 'eye', 'hair'];

	// =========================================================
	// 2. APPLICATION STATE
	// =========================================================

	/**
	 * Store the currently selected visual configuration.
	 *
	 * Numeric styles identify the selected PNG.
	 * HEX colors must eventually be stored in MariaDB.
	 *
	 * Keeping state separate from the DOM makes future
	 * editing and reloading of saved characters easier.
	 */
	const state = {
		gender: 'male',
		name: '',
		nose: 1,
		mouth: 1,
		eyes: 1,
		hair: 1,
		skin: '#d8b39a',
		eye: '#57b8ff',
		hairColor: '#d3b278'
	};

	// Cache image-loading promises to avoid duplicate requests.
	const imageCache = new Map();

	let previewCanvas;
	let previewContext;
	let previewIsReady = false;

	// Prevent older asynchronous renders from overwriting new ones.
	let latestPreviewRequest = 0;

	const byId = (id) => document.getElementById(id);

	// =========================================================
	// 3. BUILD IMAGE PATHS
	// =========================================================

	/**
	 * Return the full path of a selected feature PNG.
	 *
	 * Examples:
	 * - homme/nez_homme_3.png
	 * - femme/bouche_femme_2.png
	 * - femme/cheveux_femme_5.png
	 */
	function featurePath(feature, number) {
		const config = CATALOGUE[state.gender];

		const prefixes = {
			nose: 'nez',
			mouth: config.mouthPrefix,
			eyes: 'yeux',
			hair: 'cheveux'
		};

		return (
			`${ASSET_ROOT}${config.folder}/` +
			`${prefixes[feature]}_${config.folder}_${number}.png`
		);
	}

	/**
	 * Return the base body PNG for the selected gender.
	 */
	function bodyPath() {
		const folder = CATALOGUE[state.gender].folder;

		return `${ASSET_ROOT}${folder}/${folder}.png`;
	}

	// =========================================================
	// 4. IMAGE LOADING AND CACHING
	// =========================================================

	/**
	 * Load an image asynchronously.
	 *
	 * Checks:
	 * - The file must exist.
	 * - Its dimensions must match the other layers.
	 *
	 * Successful promises are cached.
	 * Failed requests are removed so they can be retried.
	 */
	function loadImage(path) {
		if (!imageCache.has(path)) {
			const promise = new Promise((resolve, reject) => {
				const image = new Image();

				image.onload = () => {
					if (
						image.naturalWidth !== WIDTH ||
						image.naturalHeight !== HEIGHT
					) {
						reject(
							new Error(`Invalid PNG dimensions: ${path}`)
						);
						return;
					}

					resolve(image);
				};

				image.onerror = () => {
					reject(new Error(`PNG not found: ${path}`));
				};

				image.src = path;
			}).catch((error) => {
				imageCache.delete(path);
				throw error;
			});

			imageCache.set(path, promise);
		}

		return imageCache.get(path);
	}

	/**
	 * Create a temporary canvas matching the source artwork.
	 *
	 * Temporary canvases allow color adjustments without
	 * directly modifying the visible preview.
	 */
	function makeLayerCanvas() {
		const canvas = document.createElement('canvas');

		canvas.width = WIDTH;
		canvas.height = HEIGHT;

		return canvas;
	}

	/**
	 * Convert a HEX color such as #d8b39a to RGB values.
	 */
	function hexToRgb(hex) {
		return [1, 3, 5].map((position) => {
			return parseInt(hex.slice(position, position + 2), 16);
		});
	}

	// =========================================================
	// 5. SKIN COLORING
	// =========================================================

	/**
	 * Apply the selected skin color to grayscale pixels.
	 *
	 * IMPORTANT LAYER ORDER:
	 * The base body and nose are drawn together BEFORE calling
	 * this function. Both therefore receive the same skin tone.
	 *
	 * The algorithm preserves grayscale shading by using the
	 * original luminance to calculate the resulting color.
	 *
	 * The base artwork contains colored underwear.
	 * Chroma detection reduces recoloring on those areas.
	 *
	 * This is an approximation rather than a dedicated skin mask.
	 * A manually prepared skin mask would provide more precise
	 * control over which anatomical areas can be colored.
	 */
	function tintNeutralPixels(canvas, color) {
		const context = canvas.getContext('2d', {
			willReadFrequently: true
		});

		const imageData = context.getImageData(
			0, 0, WIDTH, HEIGHT
		);

		const pixels = imageData.data;
		const [red, green, blue] = hexToRgb(color);

		for (let offset = 0; offset < pixels.length; offset += 4) {
			// Skip transparent pixels.
			if (pixels[offset + 3] === 0) {
				continue;
			}

			const originalR = pixels[offset];
			const originalG = pixels[offset + 1];
			const originalB = pixels[offset + 2];

			// Detect colored pixels using channel differences.
			const chroma =
				Math.max(originalR, originalG, originalB) -
				Math.min(originalR, originalG, originalB);

			// Reduce the tint on saturated regions.
			const neutralWeight = Math.max(
				0,
				Math.min(1, (38 - chroma) / 25)
			);

			if (neutralWeight === 0) {
				continue;
			}

			// Preserve light and shadow variations.
			const luminance =
				0.2126 * originalR +
				0.7152 * originalG +
				0.0722 * originalB;

			const shading = Math.pow(
				luminance / 245,
				0.83
			);

			const opacity = neutralWeight * 0.91;

			pixels[offset] =
				originalR * (1 - opacity) +
				red * shading * opacity;

			pixels[offset + 1] =
				originalG * (1 - opacity) +
				green * shading * opacity;

			pixels[offset + 2] =
				originalB * (1 - opacity) +
				blue * shading * opacity;
		}

		context.putImageData(imageData, 0, 0);

		return canvas;
	}

	// =========================================================
	// 6. IRIS COLORING
	// =========================================================

	/**
	 * Draw the selected eye image and apply the chosen iris color.
	 *
	 * Male and female eye assets have different vertical positions:
	 * - Male eyes are approximately 30 pixels higher.
	 * - Female eyes are approximately 30 pixels lower.
	 *
	 * The iris mask is built independently from the eye image.
	 * It limits color changes to the iris regions while preserving
	 * the original eyebrows, eyelashes, pupils and shading.
	 *
	 * The mask is approximate because the source files do not yet
	 * include dedicated iris masks for each individual eye style.
	 *
	 * @param {HTMLCanvasElement} destination
	 * @param {HTMLImageElement} eyeImage
	 * @param {string} color - Selected HEX iris color.
	 */
	function drawTintedEyes(destination, eyeImage, color) {
		const destinationContext = destination.getContext('2d');

		// Step 1: draw the unmodified eye artwork.
		// This keeps the original outlines and facial details.
		destinationContext.drawImage(eyeImage, 0, 0);

		// Step 2: select the appropriate vertical position.
		// The male eye sprites sit about 30 pixels higher.
		const irisCenterY = state.gender === 'male'
			? 176
			: 206;

		// Horizontal iris positions are approximately shared.
		const irisCentersX = [269, 309];

		// Step 3: create a transparent canvas for the iris mask.
		const maskCanvas = makeLayerCanvas();
		const maskContext = maskCanvas.getContext('2d');

		maskContext.fillStyle = '#ffffff';

		// Draw one ellipse for each iris.
		for (const centerX of irisCentersX) {
			maskContext.beginPath();

			maskContext.ellipse(
				centerX,
				irisCenterY,
				7,
				9,
				0,
				0,
				Math.PI * 2
			);

			maskContext.fill();
		}

		// Step 4: create a temporary colored copy of the eyes.
		const tintedCanvas = makeLayerCanvas();
		const tintedContext = tintedCanvas.getContext('2d');

		tintedContext.drawImage(eyeImage, 0, 0);

		// Multiply keeps dark pupils and grayscale shadows.
		tintedContext.globalCompositeOperation = 'multiply';
		tintedContext.fillStyle = color;
		tintedContext.fillRect(0, 0, WIDTH, HEIGHT);

		// Step 5: restore the original PNG transparency.
		// Pixels outside the eye artwork become transparent.
		tintedContext.globalCompositeOperation = 'destination-in';
		tintedContext.drawImage(eyeImage, 0, 0);

		// Step 6: intersect the colored image with the iris mask.
		//
		// This second destination-in operation is essential:
		// only pixels inside BOTH the eye image and iris mask
		// can remain visible.
		tintedContext.globalCompositeOperation = 'destination-in';
		tintedContext.drawImage(maskCanvas, 0, 0);

		// Step 7: restore the normal drawing mode.
		tintedContext.globalCompositeOperation = 'source-over';

		// Step 8: place only the tinted iris regions over
		// the original eye artwork in the character preview.
		destinationContext.drawImage(tintedCanvas, 0, 0);
	}

	// =========================================================
	// 7. HAIR COLORING
	// =========================================================

	/**
	 * Color a hairstyle PNG independently of the skin.
	 *
	 * Multiply blending preserves the original strand shading.
	 * The destination-in operation restores PNG transparency.
	 */
	function drawTintedHair(destination, hairImage, color) {
		const tintedCanvas = makeLayerCanvas();
		const context = tintedCanvas.getContext('2d');

		// Start from the original hairstyle.
		context.drawImage(hairImage, 0, 0);

		// Apply the selected color.
		context.globalCompositeOperation = 'multiply';
		context.fillStyle = color;
		context.fillRect(0, 0, WIDTH, HEIGHT);

		// Restore the hair image's alpha boundaries.
		context.globalCompositeOperation = 'destination-in';
		context.drawImage(hairImage, 0, 0);

		context.globalCompositeOperation = 'source-over';

		destination.getContext('2d').drawImage(
			tintedCanvas,
			0,
			0
		);
	}

	// =========================================================
	// 8. MAIN CHARACTER COMPOSITION
	// =========================================================

	/**
	 * Render the full character.
	 *
	 * Drawing order:
	 * 1. Body.
	 * 2. Nose.
	 * 3. Skin coloring applied to body AND nose.
	 * 4. Mouth.
	 * 5. Eyes with iris coloring.
	 * 6. Hair with hairstyle coloring.
	 *
	 * All images are loaded before drawing the final frame.
	 * A request ID prevents outdated previews from appearing.
	 */
	async function drawPreview() {
		const requestId = ++latestPreviewRequest;

		previewIsReady = false;
		byId('preview-status').textContent =
			'Composing character…';

		try {
			const paths = [
				bodyPath(),
				...FEATURES.map((feature) => {
					return featurePath(feature, state[feature]);
				})
			];

			// Load all five images concurrently.
			const [
				bodyImage,
				noseImage,
				mouthImage,
				eyesImage,
				hairImage
			] = await Promise.all(paths.map(loadImage));

			// Ignore results from an older selection.
			if (requestId !== latestPreviewRequest) {
				return;
			}

			const composition = makeLayerCanvas();
			const compositionContext =
				composition.getContext('2d');

			const skinCanvas = makeLayerCanvas();
			const skinContext = skinCanvas.getContext('2d');

			// Combine the body and nose before coloring.
			skinContext.drawImage(bodyImage, 0, 0);
			skinContext.drawImage(noseImage, 0, 0);

			// Apply the same skin tone to both layers.
			tintNeutralPixels(skinCanvas, state.skin);

			compositionContext.drawImage(skinCanvas, 0, 0);

			// Add facial features after skin coloring.
			compositionContext.drawImage(mouthImage, 0, 0);

			drawTintedEyes(
				composition,
				eyesImage,
				state.eye
			);

			// Hair is the uppermost appearance layer.
			drawTintedHair(
				composition,
				hairImage,
				state.hairColor
			);

			// Update the visible canvas only when ready.
			previewContext.clearRect(
				0,
				0,
				WIDTH,
				HEIGHT
			);

			previewContext.drawImage(
				composition,
				0,
				0
			);

			previewIsReady = true;

			byId('preview-status').textContent =
				'Preview ready · 568 × 1275';

		} catch (error) {
			// Ignore errors belonging to an obsolete render.
			if (requestId !== latestPreviewRequest) {
				return;
			}

			previewIsReady = false;

			byId('preview-status').textContent =
				'Unable to load character artwork.';

			showFeedback(error.message, true);

			console.error(
				'FantasyRealm preview error:',
				error
			);
		}
	}

	// =========================================================
	// 9. FEATURE THUMBNAILS
	// =========================================================

	/**
	 * Cropping areas for the selection cards.
	 *
	 * The original PNGs are full-body images.
	 * Cropping prevents the facial details from appearing
	 * too small in the thumbnail buttons.
	 *
	 * Format: [left, top, width, height].
	 */
	const THUMBNAIL_CROPS = {
		nose: [230, 170, 115, 110],
		mouth: [230, 220, 115, 87],
		eyes: [225, 155, 140, 104],
		hair: [90, 65, 390, 410]
	};

	/**
	 * Draw a cropped image inside a selection button.
	 *
	 * Thumbnails that belong to an old gender selection
	 * are discarded after an asynchronous image load.
	 */
	async function drawThumbnail(
		thumbnailCanvas,
		feature,
		number,
		genderAtCreation
	) {
		const path = featurePath(feature, number);

		try {
			const image = await loadImage(path);

			if (
				state.gender !== genderAtCreation ||
				!thumbnailCanvas.isConnected
			) {
				return;
			}

			const [left, top, width, height] =
				THUMBNAIL_CROPS[feature];

			const context = thumbnailCanvas.getContext('2d');

			context.clearRect(
				0,
				0,
				thumbnailCanvas.width,
				thumbnailCanvas.height
			);

			context.drawImage(
				image,
				left,
				top,
				width,
				height,
				0,
				0,
				thumbnailCanvas.width,
				thumbnailCanvas.height
			);

		} catch (error) {
			console.warn(
				'FantasyRealm thumbnail error:',
				error.message
			);
		}
	}

	/**
	 * Create one selectable button per available image.
	 *
	 * aria-pressed communicates selection state.
	 * Native buttons allow keyboard interaction automatically.
	 */
	function buildFeatureChoices(feature) {
		const holder = byId(`${feature}-options`);

		holder.replaceChildren();

		const availableStyles =
			CATALOGUE[state.gender][feature];

		byId(`${feature}-count`).textContent =
			`${availableStyles.length} styles`;

		for (const number of availableStyles) {
			const button = document.createElement('button');

			button.type = 'button';
			button.className = 'creator-choice';

			button.setAttribute(
				'aria-label',
				`${feature} style ${number}`
			);

			button.setAttribute(
				'aria-pressed',
				String(state[feature] === number)
			);

			const thumbnail = document.createElement('canvas');

			thumbnail.width = 120;
			thumbnail.height = 100;
			thumbnail.setAttribute('aria-hidden', 'true');

			const label = document.createElement('span');

			label.textContent =
				`Style ${String(number).padStart(2, '0')}`;

			button.append(thumbnail, label);

			button.addEventListener('click', () => {
				state[feature] = number;

				// Update the selected state of every button.
				holder.querySelectorAll('button').forEach(
					(candidate) => {
						candidate.setAttribute(
							'aria-pressed',
							String(candidate === button)
						);
					}
				);

				drawPreview();
			});

			holder.appendChild(button);

			drawThumbnail(
				thumbnail,
				feature,
				number,
				state.gender
			);
		}
	}

	// =========================================================
	// 10. COLOR PRESETS AND CUSTOM COLORS
	// =========================================================

	/**
	 * Convert a UI color category to its state property.
	 *
	 * Skin and eyes use simple names.
	 * Hair uses hairColor to avoid confusion with hairstyle.
	 */
	function stateColorKey(kind) {
		return kind === 'hair' ? 'hairColor' : kind;
	}

	/**
	 * Build the clickable predefined color swatches.
	 *
	 * Selecting a preset updates the native color picker
	 * and triggers a new character preview.
	 */
	function buildColorSwatches(kind) {
		const holder = byId(`${kind}-swatches`);
		const picker = byId(`${kind}-color`);

		holder.replaceChildren();

		COLOR_PRESETS[kind].forEach((color) => {
			const button = document.createElement('button');

			button.type = 'button';
			button.className = 'creator-swatch';

			button.style.setProperty(
				'--swatch-color',
				color
			);

			button.setAttribute(
				'aria-label',
				`${kind} color ${color}`
			);

			button.setAttribute(
				'aria-pressed',
				String(state[stateColorKey(kind)] === color)
			);

			button.addEventListener('click', () => {
				picker.value = color;
				state[stateColorKey(kind)] = color;

				refreshColorControls();
				drawPreview();
			});

			holder.appendChild(button);
		});
	}

	/**
	 * Synchronize color labels and pressed states.
	 */
	function refreshColorControls() {
		COLOR_KINDS.forEach((kind) => {
			const color = state[stateColorKey(kind)];

			byId(`${kind}-value`).textContent =
				color.toUpperCase();

			byId(`${kind}-swatches`)
				.querySelectorAll('.creator-swatch')
				.forEach((button) => {
					const preset = button.style.getPropertyValue(
						'--swatch-color'
					);

					button.setAttribute(
						'aria-pressed',
						String(preset === color)
					);
				});
		});
	}

	// =========================================================
	// 11. FEEDBACK AND FUTURE API PAYLOAD
	// =========================================================

	/**
	 * Display feedback without injecting HTML.
	 *
	 * textContent safely handles dynamic error messages.
	 */
	function showFeedback(message, isError = false) {
		const feedback = byId('form-feedback');

		feedback.hidden = false;
		feedback.textContent = message;

		feedback.classList.toggle(
			'is-error',
			isError
		);
	}

	/**
	 * Prepare the configuration intended for future persistence.
	 *
	 * This object is NOT currently sent to the server.
	 * The PHP endpoint must first support these numeric
	 * styles and custom HEX values.
	 */
	function appearancePayload() {
		return {
			name: state.name,
			gender: state.gender,
			nose_style: state.nose,
			mouth_style: state.mouth,
			eye_style: state.eyes,
			hair_style: state.hair,
			skin_color: state.skin,
			eye_color: state.eye,
			hair_color: state.hairColor
		};
	}

	// =========================================================
	// 12. INITIALIZATION AND EVENT HANDLERS
	// =========================================================

	/**
	 * Initialize the editor after the HTML has loaded.
	 *
	 * The shared header and footer are handled separately.
	 */
	function initializeCreator() {
		previewCanvas = byId('character-preview');

		previewContext = previewCanvas.getContext('2d');

		// Update the displayed character name in real time.
		byId('character-name').addEventListener(
			'input',
			(event) => {
				state.name = event.target.value.trim();

				byId('preview-name').textContent =
					state.name || 'Your Legend';
			}
		);

		/**
		 * Switching body type changes the underlying PNG set.
		 *
		 * Preserve a selected style number when the new body
		 * type provides that number. Otherwise select style 1.
		 */
		document.querySelectorAll(
			'input[name="gender"]'
		).forEach((input) => {
			input.addEventListener('change', () => {
				if (!input.checked) {
					return;
				}

				state.gender = input.value;

				byId('preview-gender').textContent =
					state.gender === 'male'
						? 'Male body'
						: 'Female body';

				FEATURES.forEach((feature) => {
					const allowed =
						CATALOGUE[state.gender][feature];

					if (!allowed.includes(state[feature])) {
						state[feature] = allowed[0];
					}

					buildFeatureChoices(feature);
				});

				drawPreview();
			});
		});

		/**
		 * Synchronize the three custom HTML color inputs.
		 */
		COLOR_KINDS.forEach((kind) => {
			buildColorSwatches(kind);

			byId(`${kind}-color`).addEventListener(
				'input',
				(event) => {
					state[stateColorKey(kind)] =
						event.target.value;

					refreshColorControls();
					drawPreview();
				}
			);
		});

		/**
		 * Export the fully rendered canvas to a PNG.
		 *
		 * This downloads a local image only.
		 * It does not save the character to the database.
		 */
		byId('export-preview').addEventListener('click', () => {
			if (!previewIsReady) {
				showFeedback(
					'The preview is not ready yet.',
					true
				);
				return;
			}

			const link = document.createElement('a');

			link.download = 'fantasyrealm-character-preview.png';
			link.href = previewCanvas.toDataURL('image/png');

			link.click();
		});

		/**
 * Validate the creation form and send character data
 * to the PHP API using the current session CSRF token.
 *
 * On success, the new character is stored with
 * PENDING status and the user returns to the dashboard.
 */
		byId('character-creator-form').addEventListener(
			'submit',
			async (event) => {
				event.preventDefault();

				const form = event.currentTarget;
				if (!form.reportValidity()) {
					return;
				}

				if (!previewIsReady) {
					showFeedback('The character preview is still loading.', true);
					return;
				}

				// Verify the PHP session and get the anti-CSRF token.
				const createButton = byId('create-button');
				createButton.disabled = true;
				showFeedback('Creating your character…');

				try {
					const sessionResponse = await fetch(
						'/FantasyRealm/Backend/api/session.php',
						{
							credentials: 'same-origin',
							cache: 'no-store',
							headers: { Accept: 'application/json' }
						}
					);
					const session = await sessionResponse.json();
					if (
						!sessionResponse.ok ||
						!session.authenticated ||
						typeof session.csrf_token !== 'string'
					) {
						throw new Error('Please sign in before creating a character.');
					}

					// The server validates every field again; the browser is not trusted.
					const response = await fetch(
						'/FantasyRealm/Backend/api/characters.php',
						{
							method: 'POST',
							credentials: 'same-origin',
							headers: {
								'Content-Type': 'application/json',
								Accept: 'application/json',
								'X-CSRF-Token': session.csrf_token
							},
							body: JSON.stringify({
								...appearancePayload(),
								name: byId('character-name').value.trim()
							})
						}
					);

					const result = await response.json();
					if (!response.ok || result.success !== true) {
						throw new Error(result.message || 'Unable to create character.');
					}

					// Name approval happens in the employee dashboard.
					// Keep the character private until approved.
					showFeedback('Character saved! Its name is awaiting staff approval.');
					window.location.assign('dashboard.html');
				} catch (error) {
					console.error('Character creation failed:', error);
					showFeedback(error.message || 'Unable to create character.', true);
					createButton.disabled = false;
				}
			}
		);

		// Build every available facial feature and hairstyle.
		FEATURES.forEach(buildFeatureChoices);

		// Initialize the color labels.
		refreshColorControls();

		// Render the initial character immediately.
		drawPreview();
	}

	// Wait until all required HTML controls exist.
	document.addEventListener(
		'DOMContentLoaded',
		initializeCreator
	);
})();

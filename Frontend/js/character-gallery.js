
/*
 * FANTASYREALM - PUBLIC CHARACTER GALLERY
 *
 * Loads approved, shared characters and provides
 * filtering by creator, gender and creation date.
 *
 * Shared navigation and authentication are handled
 * by the header component.
 */

(() => {
	'use strict';

	const GALLERY_URL = '/FantasyRealm/Backend/api/gallery.php';
	const CHARACTERS_PER_PAGE = 60;

	const grid = document.getElementById('gallery-grid');
	const message = document.getElementById('gallery-message');
	const pagination = document.getElementById('gallery-pagination');
	const count = document.getElementById('gallery-count');

	const filtersForm = document.getElementById('gallery-filters');
	const creatorFilter = document.getElementById('creator-filter');
	const genderFilter = document.getElementById('gender-filter');
	const dateFromFilter = document.getElementById('date-from-filter');
	const dateToFilter = document.getElementById('date-to-filter');

	if (
		!grid || !message || !pagination || !count ||
		!filtersForm || !creatorFilter || !genderFilter ||
		!dateFromFilter || !dateToFilter
	) {
		return;
	}

	let allCharacters = [];
	let filteredCharacters = [];
	let currentPage = 1;
	let hasLoaded = false;

	/*
	 * Display feedback using textContent to avoid
	 * interpreting API messages as HTML.
	 */
	function showMessage(text) {
		message.textContent = text;
		message.hidden = false;
	}

	function hideMessage() {
		message.textContent = '';
		message.hidden = true;
	}

	/*
	 * Use the YYYY-MM-DD portion of the database date
	 * without timezone conversion.
	 */
	function getDatePart(value) {
		return typeof value === 'string'
			? value.slice(0, 10)
			: '';
	}

	/*
	 * Display only the distinct genders returned
	 * by the public gallery API.
	 */
	function populateGenderOptions(characters) {
		const selectedValue = genderFilter.value;

		const genders = [...new Set(
			characters
				.map(character => String(character.gender ?? '').trim())
				.filter(Boolean)
		)].sort((a, b) => a.localeCompare(b));

		genderFilter.replaceChildren();

		const defaultOption = document.createElement('option');
		defaultOption.value = '';
		defaultOption.textContent = 'All genders';
		genderFilter.appendChild(defaultOption);

		genders.forEach(gender => {
			const option = document.createElement('option');
			option.value = gender;
			option.textContent = gender;
			genderFilter.appendChild(option);
		});

		if (genders.includes(selectedValue)) {
			genderFilter.value = selectedValue;
		}
	}

	/*
	 * Load characters without requiring a login session.
	 */
	async function loadCharacters() {
		showMessage('Loading characters...');
		count.hidden = true;
		grid.replaceChildren();
		pagination.replaceChildren();

		try {
			const response = await fetch(GALLERY_URL, {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: {
					Accept: 'application/json'
				}
			});

			const data = await response.json();

			if (
				!response.ok ||
				data.success !== true ||
				!Array.isArray(data.characters)
			) {
				throw new Error('Invalid gallery response.');
			}

			allCharacters = data.characters;
			hasLoaded = true;

			populateGenderOptions(allCharacters);
			applyFilters();

		} catch (error) {
			console.error('Unable to load gallery:', error);

			hasLoaded = false;
			showMessage('Unable to load characters. Please try again.');
		}
	}

	/*
	 * Apply all active filters to public characters.
	 * Date boundaries are inclusive.
	 */
	function applyFilters() {
		if (!hasLoaded) {
			return;
		}

		const creator = creatorFilter.value.trim().toLocaleLowerCase();
		const gender = genderFilter.value;
		const dateFrom = dateFromFilter.value;
		const dateTo = dateToFilter.value;

		if (dateFrom && dateTo && dateFrom > dateTo) {
			grid.replaceChildren();
			pagination.replaceChildren();

			count.hidden = true;
			showMessage('The start date must be before the end date.');
			return;
		}

		filteredCharacters = allCharacters.filter(character => {
			const creatorName = String(
				character.creator_username ?? ''
			).toLocaleLowerCase();

			const characterGender = String(character.gender ?? '');
			const creationDate = getDatePart(character.created_at);

			const matchesCreator =
				!creator || creatorName.includes(creator);

			const matchesGender =
				!gender || characterGender === gender;

			const matchesFrom =
				!dateFrom || (creationDate && creationDate >= dateFrom);

			const matchesTo =
				!dateTo || (creationDate && creationDate <= dateTo);

			return (
				matchesCreator &&
				matchesGender &&
				matchesFrom &&
				matchesTo
			);
		});

		currentPage = 1;
		renderCharacters();
	}

	/*
	 * Create one accessible character card using
	 * DOM nodes instead of HTML string interpolation.
	 */
	function createCharacterCard(character) {
		const card = document.createElement('article');
		card.className = 'character-card';

		const stage = document.createElement('div');
		stage.className = 'character-stage';

		if (character.image_path) {
			const imagePath = String(character.image_path);

			/*
			 * Accept application-relative asset paths only.
			 * Reject absolute URLs and path traversal.
			 */
			if (
				!imagePath.startsWith('/') &&
				!imagePath.includes('..') &&
				!imagePath.includes('\\') &&
				!imagePath.includes(':')
			) {
				const image = document.createElement('img');

				image.src = `../${imagePath}`;
				image.alt = `Portrait of ${character.name}`;
				image.loading = 'lazy';

				stage.appendChild(image);
			}
		}

		/**
		 * Rebuild the public character preview from saved PNG layers.
		 *
		 * Legacy image files remain a fallback if the appearance
		 * cannot be reconstructed.
		 */
		window.FantasyRealmCharacterRenderer
			.render(stage, character)
			.then((rendered) => {
				if (rendered) {
					stage
						.querySelectorAll('img')
						.forEach((image) => image.remove());
				}
			});

		const info = document.createElement('div');
		info.className = 'character-info';

		const name = document.createElement('h3');
		name.textContent = String(character.name ?? 'Unnamed character');

		const creator = document.createElement('p');
		creator.className = 'creator';
		creator.textContent =
			`Created by ${character.creator_username ?? 'Unknown'}`;

		const gender = document.createElement('p');
		gender.className = 'character-gender';
		gender.textContent = character.gender
			? `Gender: ${character.gender}`
			: 'Gender unspecified';

		const date = document.createElement('p');
		date.className = 'created-date';

		const dateValue = getDatePart(character.created_at);
		date.textContent = dateValue
			? `Created: ${dateValue}`
			: '';

		const viewLink = document.createElement('a');
		viewLink.className = 'view-button';

		viewLink.href =
			`character.html?id=${encodeURIComponent(character.id)}`;

		viewLink.textContent = 'View Character';
		viewLink.setAttribute(
			'aria-label',
			`View ${character.name ?? 'character'} details`
		);

		info.append(name, creator, gender, date, viewLink);
		card.append(stage, info);

		return card;
	}

	/*
	 * Render the currently selected results page.
	 */
	function renderCharacters() {
		grid.replaceChildren();
		pagination.replaceChildren();

		count.hidden = false;

		const total = filteredCharacters.length;
		count.textContent =
			`${total} character${total === 1 ? '' : 's'} found`;

		if (total === 0) {
			showMessage(
				allCharacters.length === 0
					? 'No public characters are available yet.'
					: 'No characters match your filters.'
			);
			return;
		}

		hideMessage();

		const startIndex =
			(currentPage - 1) * CHARACTERS_PER_PAGE;

		const pageCharacters = filteredCharacters.slice(
			startIndex,
			startIndex + CHARACTERS_PER_PAGE
		);

		const fragment = document.createDocumentFragment();

		pageCharacters.forEach(character => {
			fragment.appendChild(createCharacterCard(character));
		});

		grid.appendChild(fragment);
		renderPagination();
	}

	/*
	 * Build pagination buttons and preserve focus
	 * after a page change.
	 */
	function renderPagination() {
		pagination.replaceChildren();

		const pageCount = Math.ceil(
			filteredCharacters.length / CHARACTERS_PER_PAGE
		);

		if (pageCount <= 1) {
			return;
		}

		for (let page = 1; page <= pageCount; page++) {
			const button = document.createElement('button');

			button.type = 'button';
			button.className = 'pagination-button';
			button.textContent = String(page);

			button.setAttribute(
				'aria-label',
				`Go to page ${page}`
			);

			if (page === currentPage) {
				button.classList.add('active');
				button.setAttribute('aria-current', 'page');
			}

			button.addEventListener('click', () => {
				currentPage = page;

				renderCharacters();

				const activeButton = [...pagination.children].find(
					item => item.getAttribute('aria-current') === 'page'
				);

				activeButton?.focus({ preventScroll: true });

				grid.scrollIntoView({
					behavior: window.matchMedia(
						'(prefers-reduced-motion: reduce)'
					).matches ? 'instant' : 'smooth',
					block: 'start'
				});
			});

			pagination.appendChild(button);
		}
	}

	/*
	 * Filter on field changes and prevent the
	 * browser from submitting the filter form.
	 */
	creatorFilter.addEventListener('input', applyFilters);
	genderFilter.addEventListener('change', applyFilters);
	dateFromFilter.addEventListener('change', applyFilters);
	dateToFilter.addEventListener('change', applyFilters);

	filtersForm.addEventListener('submit', event => {
		event.preventDefault();
		applyFilters();
	});

	filtersForm.addEventListener('reset', () => {
		/*
		 * Browser reset completes after the event.
		 * Queue the filter refresh for the next microtask.
		 */
		queueMicrotask(applyFilters);
	});

	loadCharacters();
})();

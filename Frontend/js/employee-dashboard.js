/*
 * FANTASYREALM - EMPLOYEE DASHBOARD CONTROLLER
 *
 * Handles staff moderation, accessory management and player accounts.
 * Navigation, account menu and logout are owned by the shared header.
 * All privileged actions are validated again by the PHP APIs.
 */
(() => {
	'use strict';
	const API = '/FantasyRealm/Backend/api/';
	const el = (id) => document.getElementById(id);
	const state = { characters: [], reviews: [], accessories: [], users: [], action: null, busy: false };

	/* Display safe, text-only feedback without inserting server HTML. */
	function feedback(id, message = '', error = false) {
		const node = el(id);
		node.textContent = message;
		node.hidden = !message;
		node.classList.toggle('is-error', Boolean(error));
		node.classList.toggle('is-success', Boolean(message) && !error);
	}

	/* Send JSON or multipart requests with the existing session CSRF token. */
	async function request(endpoint, body) {
		const isPost = body !== undefined;
		const headers = { Accept: 'application/json' };
		const isMultipart = body instanceof FormData;

		if (isPost) {
			if (!isMultipart) {
				headers['Content-Type'] = 'application/json';
			}

			const sessionResponse = await fetch(API + 'session.php', {
				credentials: 'same-origin',
				cache: 'no-store'
			});

			if (!sessionResponse.ok) {
				throw new Error('Unable to verify your session.');
			}

			const session = await sessionResponse.json();
			if (!session.authenticated || !session.csrf_token) {
				throw new Error('Your session has expired. Please sign in again.');
			}

			headers['X-CSRF-Token'] = session.csrf_token;
		}

		const response = await fetch(API + endpoint, {
			method: isPost ? 'POST' : 'GET',
			headers,
			credentials: 'same-origin',
			cache: 'no-store',
			...(isPost ? { body: isMultipart ? body : JSON.stringify(body) } : {})
		});

		let data;
		try {
			data = await response.json();
		} catch {
			throw new Error('Unexpected server response.');
		}

		if (response.status === 401) {
			window.location.assign('login.html');
			throw new Error('Authentication required.');
		}

		if (response.status === 403) {
			el('employee-content').hidden = true;
		}

		if (!response.ok || data.success !== true) {
			throw new Error(data.message || 'Unable to complete the request.');
		}

		return data;
	}

	/* Normalize server dates for the staff interface. */
	const dateText = (value) => {
		if (!value) return '—';
		const date = new Date(String(value).replace(' ', 'T'));
		return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
	};
	/* Build DOM elements safely using textContent. */
	function node(tag, cls, value) {
		const result = document.createElement(tag);
		if (cls) result.className = cls;
		if (value !== undefined) result.textContent = String(value);
		return result;
	}
	function detail(card, label, value) { card.appendChild(node('p', 'employee-meta', `${label}: ${value ?? '—'}`)); }
	function button(label, style, handler, disabled = false) {
		const b = node('button', style, label);
		b.type = 'button'; b.disabled = disabled; b.addEventListener('click', handler);
		return b;
	}
	function cardBase(title) { const card = node('article', 'employee-card'); card.appendChild(node('h3', '', title)); return card; }
	function actions(card, entries) {
		const bar = node('div', 'employee-card-actions');
		entries.forEach((entry) => bar.appendChild(button(...entry)));
		card.appendChild(bar);
	}
	function renderCards(id, cards, emptyMessage) {
		const root = el(id);
		root.replaceChildren();
		if (!cards.length) root.appendChild(node('p', 'employee-feedback', emptyMessage));
		else root.append(...cards);
	}
	/* Verify employee/admin access and populate dashboard counters. */
	async function overview() {
		try {
			const data = await request('employee-dashboard.php');
			el('employee-username').textContent = data.user.username;
			el('employee-role').textContent = data.user.role;
			const fields = {
				'pending-characters-count': 'pending_characters',
				'pending-reviews-count': 'pending_reviews',
				'active-accessories-count': 'active_accessories',
				'player-accounts-count': 'player_accounts'
			};
			for (const [id, key] of Object.entries(fields)) el(id).textContent = Number(data.statistics[key] || 0).toLocaleString();
			el('employee-content').hidden = false;
			feedback('employee-message');
			return true;
		} catch (e) { feedback('employee-message', e.message, true); return false; }
	}
	/* Load pending character names and render approval/rejection actions. */
	async function loadCharacters() {
		try {
			const data = await request('pending-characters.php');
			state.characters = data.characters;
			const cards = data.characters.map((c) => {
				const card = cardBase(c.name);
				detail(card, 'Character ID', c.id);
				detail(card, 'Creator', c.creator_username);
				detail(card, 'Submitted', dateText(c.created_at));
				actions(card, [
					['Approve', 'employee-button-primary', () => openAction('character', c, 'APPROVED')],
					['Reject', 'employee-button-danger', () => openAction('character', c, 'REJECTED')]
				]);
				return card;
			});
			renderCards('pending-characters-list', cards, 'No pending characters.');
			feedback('pending-characters-message');
		} catch (e) { feedback('pending-characters-message', e.message, true); }
	}
	/* Load reviews awaiting publication decisions. */
	async function loadReviews() {
		try {
			const data = await request('pending-reviews.php');
			state.reviews = data.reviews;
			const cards = data.reviews.map((r) => {
				const card = cardBase(`Review #${r.id}`);
				detail(card, 'Character', `${r.character_name} (#${r.character_id})`);
				detail(card, 'Reviewer', r.reviewer_username);
				detail(card, 'Rating', `${r.rating}/5`);
				card.appendChild(node('p', '', r.comment));
				actions(card, [
					['Approve', 'employee-button-primary', () => openAction('review', r, 'APPROVED')],
					['Reject', 'employee-button-danger', () => openAction('review', r, 'REJECTED')]
				]);
				return card;
			});
			renderCards('pending-reviews-list', cards, 'No pending reviews.');
			feedback('pending-reviews-message');
		} catch (e) { feedback('pending-reviews-message', e.message, true); }
	}
	/* Load accessory catalogue, including unavailable and in-use items. */
	async function loadAccessories() {
		try {
			const data = await request('employee-accessories.php');
			state.accessories = data.accessories;
			const cards = data.accessories.map((a) => {
				const card = cardBase(a.name);
				/* Put the thumbnail in the heading so employee-tables.js retains it. */
				if (
					typeof a.image_path === 'string' &&
					a.image_path.startsWith('/FantasyRealm/Frontend/assets/accessories/')
				) {
					const image = document.createElement('img');
					image.className = 'employee-accessory-thumbnail';
					image.src = a.image_path;
					image.alt = '';
					image.loading = 'lazy';
					image.decoding = 'async';
					card.querySelector('h3').prepend(image);
				}
				detail(card, 'ID', a.id);
				detail(card, 'Type', a.type);
				detail(card, 'Used by characters', a.usage_count);
				card.appendChild(node('span', `employee-status${a.active ? '' : ' inactive'}`, a.active ? 'Active' : 'Disabled'));
				actions(card, [
					[a.active ? 'Disable' : 'Enable', 'employee-button-secondary', () => updateAccessory(a), false],
					['Delete', 'employee-button-danger', () => openAction('accessory', a, 'delete'), Number(a.usage_count) > 0]
				]);
				return card;
			});
			renderCards('accessories-list', cards, 'No accessories in the library.');
			feedback('accessories-message');
		} catch (e) { feedback('accessories-message', e.message, true); }
	}
	/* Apply the player search filter before creating account cards. */
	function renderUsers() {
		const query = el('employee-player-search').value.trim().toLocaleLowerCase();
		const matches = state.users.filter(u => `${u.id} ${u.username} ${u.email}`.toLocaleLowerCase().includes(query));
		const cards = matches.map((u) => {
			const card = cardBase(u.username);
			detail(card, 'ID', u.id);
			detail(card, 'Email', u.email);
			detail(card, 'Joined', dateText(u.created_at));
			card.appendChild(node('span', `employee-status${u.suspended ? ' inactive' : ''}`, u.suspended ? 'Suspended' : 'Active'));
			actions(card, [
				[u.suspended ? 'Reactivate' : 'Suspend', 'employee-button-secondary', () => openAction('user', u, u.suspended ? 'reactivate' : 'suspend')],
				['Delete Account', 'employee-button-danger', () => openAction('user', u, 'delete')]
			]);
			return card;
		});
		renderCards('managed-users-list', cards, 'No matching player accounts.');
	}
	/* Retrieve player accounts; staff accounts are excluded by the API. */
	async function loadUsers() {
		try {
			const data = await request('employee-users.php');
			state.users = data.users;
			renderUsers();
			feedback('users-message');
		} catch (e) { feedback('users-message', e.message, true); }
	}
	/* Centralize dialog IDs so confirmation workflows remain consistent. */
	const dialogs = {
		character: { root: 'moderation-dialog', form: 'moderation-form', error: 'moderation-error', confirm: 'moderation-submit', cancel: 'moderation-cancel' },
		review: { root: 'review-moderation-dialog', form: 'review-moderation-form', error: 'review-moderation-error', confirm: 'review-moderation-submit', cancel: 'review-moderation-cancel' },
		accessory: { root: 'accessory-delete-dialog', form: 'accessory-delete-form', error: 'accessory-delete-error', confirm: 'accessory-delete-submit', cancel: 'accessory-delete-cancel' },
		user: { root: 'user-action-dialog', form: 'user-action-form', error: 'user-action-error', confirm: 'user-action-submit', cancel: 'user-action-cancel' }
	};
	/* Open a native HTML dialog without performing the action yet. */
	function openAction(kind, item, action) {
		if (state.busy || state.action) return;
		state.action = { kind, item, action };
		const config = dialogs[kind];
		feedback(config.error);
		if (kind === 'character') {
			const reject = action === 'REJECTED';
			el('moderation-dialog-title').textContent = reject ? 'Reject Character Name' : 'Approve Character Name';
			el('moderation-dialog-description').textContent = `${reject ? 'Reject' : 'Approve'} "${item.name}" (#${item.id})?`;
			el('rejection-reason-field').hidden = !reject;
			el('rejection-reason').required = reject;
			el('rejection-reason').value = '';
			el('moderation-submit').textContent = reject ? 'Confirm Rejection' : 'Confirm Approval';
		} else if (kind === 'review') {
			el('review-moderation-dialog-title').textContent = action === 'APPROVED' ? 'Approve Review' : 'Reject Review';
			el('review-moderation-dialog-description').textContent = `Moderate review #${item.id} for ${item.character_name}?`;
			el('review-moderation-preview').textContent = item.comment;
			el('review-moderation-submit').textContent = action === 'APPROVED' ? 'Approve Review' : 'Reject Review';
		} else if (kind === 'accessory') {
			el('accessory-delete-description').textContent = `Permanently delete "${item.name}" (#${item.id})?`;
		} else {
			el('user-action-title').textContent = action === 'delete' ? 'Delete Player Account' : action === 'suspend' ? 'Suspend Player' : 'Reactivate Player';
			el('user-action-description').textContent = `${action === 'delete' ? 'Permanently delete' : action === 'suspend' ? 'Suspend' : 'Reactivate'} ${item.username} (#${item.id})?`;
			el('user-action-submit').textContent = action === 'delete' ? 'Delete Account' : 'Confirm';
		}
		el(config.root).showModal();
	}
	/* Toggle accessory availability without deleting existing equipment links. */
	async function updateAccessory(item) {
		if (state.busy) return;
		state.busy = true;
		try {
			await request('set-accessory-active.php', { accessory_id: Number(item.id), active: !item.active });
			feedback('accessory-feedback', `${item.name} is now ${item.active ? 'disabled' : 'active'}.`);
			await Promise.allSettled([loadAccessories(), overview()]);
		} catch (e) { feedback('accessory-feedback', e.message, true); }
		finally { state.busy = false; }
	}
	/* Validate dialog input before submitting a privileged action. */
	async function confirmAction(event, kind) {
		event.preventDefault();
		if (!state.action || state.action.kind !== kind || state.busy) return;
		const { item, action } = state.action;
		const config = dialogs[kind];
		const confirm = el(config.confirm), cancel = el(config.cancel);
		let endpoint, payload, reload, messageId;
		if (kind === 'character') {
			const reason = el('rejection-reason').value.trim();
			if (action === 'REJECTED' && (!reason || Array.from(reason).length > 1000)) {
				feedback(config.error, 'Enter a rejection reason of 1 to 1000 characters.', true); return;
			}
			endpoint = 'moderate-character.php';
			payload = { character_id: Number(item.id), status: action, rejection_reason: action === 'REJECTED' ? reason : null };
			reload = loadCharacters; messageId = 'pending-characters-message';
		} else if (kind === 'review') {
			endpoint = 'moderate-review.php'; payload = { review_id: Number(item.id), status: action };
			reload = loadReviews; messageId = 'pending-reviews-message';
		} else if (kind === 'accessory') {
			endpoint = 'delete-accessory.php'; payload = { accessory_id: Number(item.id) };
			reload = loadAccessories; messageId = 'accessory-feedback';
		} else {
			endpoint = action === 'delete' ? 'delete-user.php' : 'set-user-suspended.php';
			payload = action === 'delete' ? { user_id: Number(item.id) } : { user_id: Number(item.id), suspended: action === 'suspend' };
			reload = loadUsers; messageId = 'user-management-feedback';
		}
		state.busy = true; confirm.disabled = cancel.disabled = true;
		try {
			const result = await request(endpoint, payload);
			el(config.root).close();
			await Promise.allSettled([reload(), overview()]);
			feedback(messageId, result.message || 'Action completed successfully.');
		} catch (e) { feedback(config.error, e.message, true); }
		finally { state.busy = false; confirm.disabled = cancel.disabled = false; }
	}
	for (const [kind, config] of Object.entries(dialogs)) {
		el(config.form).addEventListener('submit', (e) => confirmAction(e, kind));
		el(config.cancel).addEventListener('click', () => { if (!state.busy) el(config.root).close(); });
		el(config.root).addEventListener('cancel', (e) => { if (state.busy) e.preventDefault(); });
		el(config.root).addEventListener('close', () => { if (state.action?.kind === kind) state.action = null; });
	}
	/* Create catalogue items with an uploaded image and CSRF protection. */
	el('accessory-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		if (state.busy) return;

		const name = el('accessory-name').value.trim();
		const type = el('accessory-type').value;
		const imageFile = el('accessory-image').files[0];

		if (!name || Array.from(name).length > 100 ||
			!['weapon', 'armor', 'clothing', 'accessory'].includes(type)) {
			feedback('accessory-feedback', 'Enter a valid name and item type.', true);
			return;
		}

		if (!imageFile || imageFile.size === 0 || imageFile.size > 2 * 1024 * 1024 ||
			!['image/png', 'image/jpeg', 'image/webp'].includes(imageFile.type)) {
			feedback('accessory-feedback', 'Choose a PNG, JPEG or WebP image up to 2 MB.', true);
			return;
		}

		const payload = new FormData();
		payload.append('name', name);
		payload.append('type', type);
		payload.append('image', imageFile);

		state.busy = true;
		const submit = el('accessory-add-button');
		submit.disabled = true;

		try {
			const data = await request('add-accessory.php', payload);
			el('accessory-form').reset();
			await Promise.allSettled([loadAccessories(), overview()]);
			feedback('accessory-feedback', data.message || 'Accessory added successfully.');
		} catch (error) {
			feedback('accessory-feedback', error.message, true);
		} finally {
			state.busy = false;
			submit.disabled = false;
		}
	});
	const loaders = { characters: loadCharacters, reviews: loadReviews, accessories: loadAccessories, users: loadUsers };
	document.querySelectorAll('[data-refresh]').forEach((b) => b.addEventListener('click', async () => {
		b.disabled = true;
		try { await Promise.allSettled([loaders[b.dataset.refresh](), overview()]); } finally { b.disabled = false; }
	}));
	el('employee-player-search').addEventListener('input', renderUsers);
	/* Check authorization before loading protected lists. */
	async function initialize() {
		if (!await overview()) return;
		await Promise.allSettled([loadCharacters(), loadReviews(), loadAccessories(), loadUsers()]);
	}
	initialize();
})();
